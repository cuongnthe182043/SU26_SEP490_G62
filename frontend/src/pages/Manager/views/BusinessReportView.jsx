import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner, Select, SelectItem, Button } from "@heroui/react";
import { confirmDialog } from "../../../components/shared-ui/confirm";
import {
  RiLineChartLine, RiWallet3Line, RiFundsLine, RiPercentLine,
  RiAlertLine, RiTruckLine, RiTimeLine, RiCoinLine,
  RiGroupLine, RiUserStarLine, RiArrowUpLine, RiArrowDownLine,
  RiErrorWarningLine, RiLockLine, RiShieldCheckLine, RiLockUnlockLine,
  RiSave3Line, RiFileExcel2Line, RiFileList3Line,
} from "react-icons/ri";
import { managerService } from "../services/manager.service";
import { notify } from "../../../components/shared-ui/Toast";
import { exportBusinessReportToExcel } from "../utils/exportBusinessReport";
import { StatCard } from "../../../components/shared-ui/StatCard";
import { Section } from "../../../components/shared-ui/Section";
import {
  VND, VND_FULL, VehicleRevenueChart, DebtAgingBars,
  DriverHoldingsList, TopCustomersTable,
} from "../../../components/shared-ui/reportCharts";

// 12 kỳ gần nhất (tháng) tính từ tháng hiện tại theo giờ VN.
function buildPeriodOptions() {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  let y = vnNow.getUTCFullYear();
  let m = vnNow.getUTCMonth() + 1;
  const out = [];
  for (let i = 0; i < 12; i++) {
    out.push({ key: `${y}-${m}`, year: y, month: m, label: `Tháng ${m}/${y}` });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return out;
}

// Chênh lệch tương đối so kỳ trước cho các chỉ số tiền/số lượng.
function Delta({ cur, prev, goodWhenUp = true }) {
  if (prev === null || prev === undefined || Number(prev) === 0) {
    return <span className="text-[11px] text-gray-400 dark:text-gray-400">chưa có kỳ trước</span>;
  }
  const pct = ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? RiArrowUpLine : RiArrowDownLine;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${good ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}`}>
      <Icon size={12} />
      {Math.abs(pct).toFixed(1)}% <span className="text-gray-400 dark:text-gray-400 font-normal">so kỳ trước</span>
    </span>
  );
}

export default function BusinessReportView() {
  const periodOptions = useMemo(buildPeriodOptions, []);
  const [periodKey, setPeriodKey] = useState(periodOptions[0].key);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [acting, setActing] = useState(false);
  const [actionErr, setActionErr] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (key) => {
    const opt = periodOptions.find((p) => p.key === key) ?? periodOptions[0];
    setLoading(true);
    setError(null);
    try {
      const res = await managerService.getBusinessReport(opt.year, opt.month);
      setData(res);
    } catch (err) {
      setError(err.message ?? "Không thể tải báo cáo.");
    } finally {
      setLoading(false);
    }
  }, [periodOptions]);

  useEffect(() => { load(periodKey); }, [periodKey, load]);

  // Chốt / ký duyệt / mở lại kỳ. serviceFn(year, month) → trả report mới, cập nhật thẳng.
  const runAction = useCallback(async (serviceFn, successMessage) => {
    const opt = periodOptions.find((p) => p.key === periodKey) ?? periodOptions[0];
    setActing(true);
    setActionErr(null);
    try {
      const res = await serviceFn(opt.year, opt.month);
      if (res?.report) setData(res.report);
      else await load(periodKey);
      notify.success(successMessage);
    } catch (err) {
      const message = err.message ?? "Thao tác không thành công.";
      setActionErr(message);
      notify.error(message);
    } finally {
      setActing(false);
    }
  }, [periodOptions, periodKey, load]);

  const handleExport = useCallback(async () => {
    if (!data) return;
    const opt = periodOptions.find((p) => p.key === periodKey) ?? periodOptions[0];
    setExporting(true);
    try {
      await exportBusinessReportToExcel(data, { periodLabel: opt.label });
      notify.success("Đã xuất báo cáo kinh doanh.");
    } catch {
      setActionErr("Xuất file không thành công.");
      notify.error("Xuất file không thành công.");
    } finally {
      setExporting(false);
    }
  }, [data, periodOptions, periodKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner color="primary" label="Đang tải báo cáo kinh doanh..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
          <RiAlertLine size={22} className="text-red-400" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  const pnl = data?.pnl ?? {};
  const prev = pnl.prev ?? {};
  const totalCost = Number(pnl.operating_cost || 0) + Number(pnl.payroll_cost || 0);
  const prevCost = Number(prev.operating_cost || 0) + Number(prev.payroll_cost || 0);
  const marginPP = (Number(pnl.margin_pct || 0) - Number(prev.margin_pct || 0));
  const cash = data?.cashflow ?? {};
  const ops = data?.fleet_ops ?? {};
  const meta = data?.meta ?? { status: "open" };

  return (
    <div className="flex flex-col gap-5">

      {/* Kỳ báo cáo */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-gray-400">
          Kết quả kinh doanh · Doanh thu cước hoàn thành trừ chi phí vận hành và lương
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="flat" color="success" className="h-8"
            isLoading={exporting} onPress={handleExport} isDisabled={!data}
            startContent={!exporting && <RiFileExcel2Line size={15} />}
          >
            Xuất Excel
          </Button>
          <Select
            size="sm"
            selectedKeys={new Set([periodKey])}
            onSelectionChange={(keys) => setPeriodKey([...keys][0])}
            classNames={{ base: "w-44", trigger: "h-8 bg-white dark:bg-[#161922] border border-gray-200 dark:border-white/10 rounded-lg text-xs" }}
            aria-label="Kỳ báo cáo"
          >
            {periodOptions.map(({ key, label }) => (
              <SelectItem key={key}>{label}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      {/* Phase 3: trạng thái chốt kỳ + thao tác */}
      <PeriodStatusBar
        meta={meta}
        acting={acting}
        actionErr={actionErr}
        onClose={() => runAction(managerService.closeReportPeriod, "Đã chốt kỳ báo cáo.")}
        onSignOff={async () => {
          if (await confirmDialog({
            title: "Ký duyệt kỳ báo cáo",
            description: "Ký duyệt sẽ KHOÁ CỨNG số liệu kỳ này (không mở lại được). Tiếp tục?",
            confirmLabel: "Ký duyệt",
            danger: true,
          }))
            runAction(managerService.signOffReportPeriod, "Đã ký duyệt kỳ báo cáo.");
        }}
        onReopen={async () => {
          if (await confirmDialog({
            title: "Mở lại kỳ báo cáo",
            description: "Mở lại sẽ xoá bản chốt, số liệu quay về tính động. Tiếp tục?",
            confirmLabel: "Mở lại",
            danger: true,
          }))
            runAction(managerService.reopenReportPeriod, "Đã mở lại kỳ báo cáo.");
        }}
      />

      {/* A. P&L */}
      <div className="grid grid-cols-4 gap-4">
        <div className="flex flex-col gap-1">
          <StatCard
            label="Doanh thu"
            value={VND(pnl.revenue)}
            icon={RiLineChartLine}
            sub={`${pnl.completed_trips ?? 0} chuyến hoàn thành`}
            gradient="from-blue-500 to-blue-600"
            lightBg="bg-blue-50 dark:bg-blue-500/10" text="text-blue-600 dark:text-blue-300" border="border-blue-100 dark:border-blue-500/20"
          />
          <div className="px-1"><Delta cur={pnl.revenue} prev={prev.revenue} /></div>
        </div>
        <div className="flex flex-col gap-1">
          <StatCard
            label="Tổng chi phí"
            value={VND(totalCost)}
            icon={RiWallet3Line}
            sub="Vận hành + lương"
            gradient="from-orange-500 to-orange-600"
            lightBg="bg-orange-50 dark:bg-orange-500/10" text="text-orange-600 dark:text-orange-300" border="border-orange-100 dark:border-orange-500/20"
          />
          <div className="px-1"><Delta cur={totalCost} prev={prevCost} goodWhenUp={false} /></div>
        </div>
        <div className="flex flex-col gap-1">
          <StatCard
            label="Lợi nhuận gộp"
            value={VND(pnl.gross_profit)}
            icon={RiFundsLine}
            sub={Number(pnl.gross_profit) >= 0 ? "Doanh thu − chi phí" : "Đang lỗ trong kỳ"}
            gradient={Number(pnl.gross_profit) >= 0 ? "from-emerald-500 to-emerald-600" : "from-red-500 to-rose-600"}
            lightBg={Number(pnl.gross_profit) >= 0 ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-red-50 dark:bg-red-500/10"}
            text={Number(pnl.gross_profit) >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}
            border={Number(pnl.gross_profit) >= 0 ? "border-emerald-100 dark:border-emerald-500/20" : "border-red-100 dark:border-red-500/20"}
          />
          <div className="px-1"><Delta cur={pnl.gross_profit} prev={prev.gross_profit} /></div>
        </div>
        <div className="flex flex-col gap-1">
          <StatCard
            label="Biên lợi nhuận"
            value={`${Number(pnl.margin_pct || 0).toFixed(1)}%`}
            icon={RiPercentLine}
            sub="Lợi nhuận / doanh thu"
            gradient="from-indigo-500 to-indigo-600"
            lightBg="bg-indigo-50 dark:bg-indigo-500/10" text="text-indigo-600 dark:text-indigo-300" border="border-indigo-100 dark:border-indigo-500/20"
          />
          <div className="px-1">
            <span className={`text-[11px] font-semibold ${marginPP >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}`}>
              {marginPP >= 0 ? "+" : ""}{marginPP.toFixed(1)} điểm <span className="text-gray-400 dark:text-gray-400 font-normal">so kỳ trước</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cơ cấu chi phí + Hiệu suất đội xe */}
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2">
          <Section title="Cơ cấu chi phí" icon={RiWallet3Line}>
            <CostBreakdown items={data?.cost_breakdown} total={totalCost} />
          </Section>
        </div>
        <div className="col-span-3">
          <Section
            title="Hiệu suất đội xe"
            icon={RiTruckLine}
            action={
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-gray-400 dark:text-gray-400">{ops.completed ?? 0} hoàn thành</span>
                <span className={`font-semibold ${Number(ops.failed_rate) > 10 ? "text-red-500" : "text-gray-500 dark:text-gray-400"}`}>
                  {Number(ops.failed_rate || 0).toFixed(1)}% hỏng
                </span>
              </div>
            }
          >
            <VehicleRevenueChart data={data?.fleet} />
          </Section>
        </div>
      </div>

      {/* Năng suất tài xế + Top khách */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Năng suất tài xế" icon={RiUserStarLine}>
          <DriverProductivity data={data?.drivers} />
        </Section>
        <Section title="Top khách hàng theo doanh thu kỳ" icon={RiGroupLine}>
          <TopCustomersTable data={data?.top_customers} />
        </Section>
      </div>

      {/* Dòng tiền + KPI công nợ */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Section title="Phân tích nợ khách theo tuổi" icon={RiTimeLine}>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MiniStat label="Nợ phải thu" value={VND(cash.receivable_total)} tone="text-orange-600 dark:text-orange-300" />
              <MiniStat label="DSO (ngày thu tiền)" value={`${Number(cash.dso || 0).toFixed(0)} ngày`} tone="text-gray-700 dark:text-gray-200" />
              <MiniStat
                label="Tỷ lệ thu hồi kỳ"
                value={`${Number(cash.collection_rate || 0).toFixed(0)}%`}
                tone={Number(cash.collection_rate) >= 80 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}
              />
            </div>
            <DebtAgingBars data={cash.debt_aging} />
          </Section>
        </div>
        <Section title="Tiền tài xế đang cầm" icon={RiCoinLine}>
          <DriverHoldingsList data={cash.driver_holdings} />
        </Section>
      </div>

      {/* Khách hàng rủi ro */}
      <Section title="Khách hàng rủi ro công nợ" icon={RiErrorWarningLine}>
        <RiskyCustomers data={data?.risky_customers} />
      </Section>

      {/* Công nợ chi tiết khách hàng — tách theo tuổi nợ */}
      <Section title="Công nợ chi tiết khách hàng" icon={RiFileList3Line}>
        <CustomerDebtTable data={data?.customer_debts} />
      </Section>

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Thanh trạng thái chốt kỳ (open → closed → signed_off) + nút thao tác tương ứng.
function PeriodStatusBar({ meta, acting, actionErr, onClose, onSignOff, onReopen }) {
  const status = meta?.status ?? "open";

  const config = {
    open: {
      wrap: "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10",
      icon: RiTimeLine, iconTone: "text-gray-400 dark:text-gray-400",
      title: "Kỳ đang mở",
      desc: "Số liệu tính động theo thời gian thực, sẽ đổi khi có giao dịch phát sinh.",
    },
    closed: {
      wrap: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25",
      icon: RiLockLine, iconTone: "text-amber-500",
      title: "Đã chốt — số liệu đóng băng",
      desc: `Chốt bởi ${meta?.closed_by_name ?? "—"} · ${fmtDateTime(meta?.closed_at)}`,
    },
    signed_off: {
      wrap: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/25",
      icon: RiShieldCheckLine, iconTone: "text-emerald-500",
      title: "Đã ký duyệt — khoá cứng",
      desc: `Ký bởi ${meta?.signed_off_by_name ?? "—"} · ${fmtDateTime(meta?.signed_off_at)}`,
    },
  }[status] ?? {};

  const Icon = config.icon ?? RiTimeLine;

  return (
    <div className={`rounded-2xl border ${config.wrap} px-4 py-3 flex items-center gap-3 flex-wrap`}>
      <div className="w-9 h-9 rounded-xl bg-white/70 dark:bg-white/10 flex items-center justify-center shrink-0">
        <Icon size={18} className={config.iconTone} />
      </div>
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{config.title}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{config.desc}</p>
        {meta?.note && <p className="text-[11px] text-gray-400 dark:text-gray-400 italic mt-0.5">Ghi chú: {meta.note}</p>}
        {actionErr && <p className="text-[11px] text-red-500 mt-0.5">{actionErr}</p>}
      </div>

      <div className="flex items-center gap-2">
        {status === "open" && (
          <Button size="sm" color="primary" isLoading={acting}
            startContent={!acting && <RiSave3Line size={15} />} onPress={onClose}>
            Chốt kỳ
          </Button>
        )}
        {status === "closed" && (
          <>
            <Button size="sm" variant="flat" isLoading={acting}
              startContent={!acting && <RiSave3Line size={15} />} onPress={onClose}>
              Chốt lại
            </Button>
            <Button size="sm" variant="flat" color="danger" isDisabled={acting}
              startContent={<RiLockUnlockLine size={15} />} onPress={onReopen}>
              Mở lại
            </Button>
            <Button size="sm" color="success" className="text-white" isLoading={acting}
              startContent={!acting && <RiShieldCheckLine size={15} />} onPress={onSignOff}>
              Ký duyệt
            </Button>
          </>
        )}
        {status === "signed_off" && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
            <RiLockLine size={14} /> Đã khoá
          </span>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone = "text-gray-700 dark:text-gray-200" }) {
  return (
    <div className="bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-base font-bold ${tone}`}>{value}</p>
    </div>
  );
}

const COST_COLORS = {
  payroll: { bar: "bg-violet-500", dot: "bg-violet-500", text: "text-violet-600 dark:text-violet-300" },
  vehicle: { bar: "bg-sky-500", dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-300" },
  office: { bar: "bg-amber-500", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-300" },
};

function CostBreakdown({ items, total }) {
  if (!items?.length || total <= 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Chưa có chi phí trong kỳ.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {items.map((it) => {
          const pct = total > 0 ? (Number(it.amount || 0) / total) * 100 : 0;
          const c = COST_COLORS[it.key] ?? COST_COLORS.office;
          return pct > 0 ? <div key={it.key} className={c.bar} style={{ width: `${pct}%` }} /> : null;
        })}
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const c = COST_COLORS[it.key] ?? COST_COLORS.office;
          const pct = total > 0 ? (Number(it.amount || 0) / total) * 100 : 0;
          return (
            <div key={it.key} className="flex items-center justify-between bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{it.label}</span>
                <span className="text-[10px] text-gray-300">{pct.toFixed(0)}%</span>
              </div>
              <span className={`text-xs font-bold ${c.text}`}>{VND(it.amount)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-1 pt-1 border-t border-gray-100 dark:border-white/10">
        <span className="text-xs text-gray-400 dark:text-gray-400 font-medium">Tổng chi phí kỳ</span>
        <span className="text-sm font-bold text-orange-600 dark:text-orange-300">{VND_FULL(total)}</span>
      </div>
    </div>
  );
}

function DriverProductivity({ data }) {
  if (!data?.length) return <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Chưa có dữ liệu.</p>;
  const max = Math.max(...data.map((d) => Number(d.revenue || 0)), 1);
  return (
    <div className="flex flex-col gap-1">
      {data.map((d, i) => (
        <div key={i} className="py-2 border-b border-gray-50 last:border-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{d.driver_name}</span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-300 shrink-0 ml-2">{VND(d.revenue)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-linear-to-r from-blue-400 to-blue-600 rounded-full"
              style={{ width: `${(Number(d.revenue) / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-400">{d.trip_count} chuyến</span>
        </div>
      ))}
    </div>
  );
}

function CustomerDebtTable({ data }) {
  if (!data?.length) {
    return <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Không có khách hàng còn dư nợ.</p>;
  }
  const sum = (k) => data.reduce((s, c) => s + Number(c[k] || 0), 0);
  const cell = "py-2.5 px-2 text-right tabular-nums";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[640px]">
        <thead>
          <tr className="text-gray-400 dark:text-gray-400 border-b border-gray-100 dark:border-white/10">
            <th className="text-left font-semibold py-2 px-2">Khách hàng</th>
            <th className="text-right font-semibold py-2 px-2">Dư nợ</th>
            <th className="text-right font-semibold py-2 px-2">0–30</th>
            <th className="text-right font-semibold py-2 px-2">31–60</th>
            <th className="text-right font-semibold py-2 px-2">61–90</th>
            <th className="text-right font-semibold py-2 px-2">&gt; 90</th>
            <th className="text-right font-semibold py-2 px-2">Đơn chưa thu</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 px-2 font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{c.name}</td>
              <td className={`${cell} font-bold text-gray-800 dark:text-gray-100`}>{VND_FULL(c.outstanding)}</td>
              <td className={`${cell} text-gray-500 dark:text-gray-400`}>{Number(c.d0_30) > 0 ? VND(c.d0_30) : "—"}</td>
              <td className={`${cell} text-yellow-600 dark:text-yellow-300`}>{Number(c.d30_60) > 0 ? VND(c.d30_60) : "—"}</td>
              <td className={`${cell} text-orange-600 dark:text-orange-300`}>{Number(c.d60_90) > 0 ? VND(c.d60_90) : "—"}</td>
              <td className={`${cell} font-semibold ${Number(c.d90_plus) > 0 ? "text-red-500" : "text-gray-300"}`}>
                {Number(c.d90_plus) > 0 ? VND(c.d90_plus) : "—"}
              </td>
              <td className={`${cell} text-gray-500 dark:text-gray-400`}>{c.unpaid_orders}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-gray-100 dark:border-white/10 font-bold text-gray-700 dark:text-gray-200">
            <td className="py-2.5 px-2">TỔNG CỘNG</td>
            <td className={cell}>{VND_FULL(sum("outstanding"))}</td>
            <td className={cell}>{VND(sum("d0_30"))}</td>
            <td className={cell}>{VND(sum("d30_60"))}</td>
            <td className={cell}>{VND(sum("d60_90"))}</td>
            <td className={`${cell} text-red-500`}>{VND(sum("d90_plus"))}</td>
            <td className={cell}>{sum("unpaid_orders")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RiskyCustomers({ data }) {
  if (!data?.length) {
    return <p className="text-xs text-gray-400 dark:text-gray-400 text-center py-8">Không có khách hàng tồn đọng công nợ.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[420px]">
        <thead>
          <tr className="text-gray-400 dark:text-gray-400 border-b border-gray-100 dark:border-white/10">
            <th className="text-left font-semibold py-2 px-2">Khách hàng</th>
            <th className="text-right font-semibold py-2 px-2">Dư nợ</th>
            <th className="text-right font-semibold py-2 px-2">Quá hạn</th>
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 px-2 font-medium text-gray-700 dark:text-gray-200 truncate max-w-[220px]">{c.name}</td>
              <td className="py-2.5 px-2 text-right font-semibold text-gray-700 dark:text-gray-200">{VND_FULL(c.outstanding)}</td>
              <td className="py-2.5 px-2 text-right font-bold">
                {Number(c.overdue) > 0
                  ? <span className="text-red-500">{VND_FULL(c.overdue)}</span>
                  : <span className="text-gray-300">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
