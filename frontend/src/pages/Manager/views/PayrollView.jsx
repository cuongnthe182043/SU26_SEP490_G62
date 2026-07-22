import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button, Input, Select, SelectItem, Spinner, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
} from "@heroui/react";
import { RiSearchLine, RiRefreshLine, RiCheckLine, RiEyeLine, RiFileDownloadLine, RiArrowGoBackLine } from "react-icons/ri";
import { StatCard } from "../../../components/shared-ui/StatCard";
import { StatusBadge } from "../../../components/shared-ui/StatusBadge";
import { PaginationBar } from "../../../components/shared-ui/PaginationBar";
import { managerService } from "../services/manager.service";
import { exportPayslipToPDF } from "../../../utils/exportPayslip";

const fmt = (v) => new Intl.NumberFormat("vi-VN").format(Number(v || 0)) + "đ";

// Chi tiết từng khoản của phiếu lương — bám sát đúng bảng chi tiết bên Kế toán
const buildDetail = (r) => [
  { label: "Lương cứng",         value: fmt(r.base_salary) },
  { label: "Doanh thu",          value: fmt(r.total_revenue) },
  { label: "Thưởng DT (15%)",    value: fmt(r.revenue_bonus) },
  { label: "Phụ cấp ĐT",         value: "200.000đ" },
  { label: "Thưởng KPI",         value: fmt(r.kpi_bonus) },
  { label: "Thưởng xuất sắc",    value: fmt(r.top_driver_bonus) },
  { label: "Thưởng & Phúc lợi",  value: fmt(r.overtime_bonus) },
  ...(Number(r.manual_bonus) > 0 ? [{ label: "Điều chỉnh (+)", value: fmt(r.manual_bonus) }] : []),
  { label: "Lương gộp",          value: fmt(r.gross_salary), bold: true },
  { label: "Hoàn chi phí đã ứng", value: fmt(r.expense_reimbursement) },
  { label: "BHXH (10.5%)",       value: `-${fmt(r.insurance_employee)}`, neg: true },
  { label: "Nghỉ không lương",   value: `-${fmt(r.absence_penalty)}`, neg: true },
  { label: "Trừ ứng lương",      value: `-${fmt(r.advance_deduction)}`, neg: true },
  { label: "Trừ công nợ",        value: `-${fmt(r.driver_debt_deduction)}`, neg: true },
  ...(Number(r.manual_deduction) > 0 ? [{ label: "Điều chỉnh (−)", value: `-${fmt(r.manual_deduction)}`, neg: true }] : []),
  { label: "Lương thực nhận",    value: fmt(r.net_salary), bold: true, highlight: true },
];

function PayslipDetailModal({ row, companyInfo, onRevert, onClose }) {
  if (!row) return null;
  const detail = buildDetail(row);
  const canRevert = row.status === "reviewed" || row.status === "approved";
  return (
    <Modal isOpen onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>Chi tiết lương — {row.driver_name}</span>
          <span className="text-sm font-normal text-gray-400">
            Kỳ lương tháng {row.payroll_month}/{row.payroll_year}
            {row.vehicle_group ? ` · ${row.vehicle_group}` : ""}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {detail.map(({ label, value, neg, bold, highlight }) => (
              <div
                key={label}
                className={`flex justify-between items-center p-2.5 rounded-lg text-xs
                  ${highlight ? "bg-blue-100 col-span-2 sm:col-span-3" : "bg-gray-50"}`}
              >
                <span className="text-gray-500">{label}</span>
                <span className={`font-${bold ? "bold" : "medium"} ${
                  highlight ? "text-blue-700 text-sm" :
                  neg ? "text-red-500" : "text-gray-800"
                }`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          {row.adjustment_note && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <span className="font-semibold">Ghi chú điều chỉnh:</span> {row.adjustment_note}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Đóng</Button>
          {canRevert && onRevert && (
            <Button
              color="danger" variant="flat"
              startContent={<RiArrowGoBackLine size={15} />}
              onPress={() => { onRevert(row); onClose(); }}
            >
              Trả về tính lại
            </Button>
          )}
          <Button
            color="secondary" variant="flat"
            startContent={<RiFileDownloadLine size={15} />}
            onPress={() => exportPayslipToPDF(row, {
              month: row.payroll_month, year: row.payroll_year, companyInfo,
            })}
          >
            Xuất phiếu lương PDF
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function ManagerRevertModal({ row, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await managerService.revertPayroll(row.id, reason.trim() || undefined);
      onDone();
      onClose();
    } catch (err) {
      setError(err.message ?? "Lỗi khi trả về.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>Trả về tính lại — {row.driver_name}</span>
          <span className="text-sm font-normal text-gray-400">
            Kỳ lương tháng {row.payroll_month}/{row.payroll_year}
          </span>
        </ModalHeader>
        <ModalBody>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            Phiếu sẽ quay về trạng thái <b>Chờ xác nhận</b> (huỷ dấu duyệt) để Kế toán tính lại /
            điều chỉnh. Chỉ áp dụng khi phiếu chưa trả lương.
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
          <Input
            label="Lý do trả về (tuỳ chọn)" placeholder="Ví dụ: sai ngày công tháng này"
            value={reason} onValueChange={setReason}
            variant="bordered"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={saving}>Huỷ</Button>
          <Button color="danger" onPress={handleSubmit} isLoading={saving}>
            Trả về tính lại
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// Các trường số từ backend là chuỗi (::text, vd "9000000.00") để giữ chính xác thập
// phân — backend đã tính sẵn net_salary đúng, dùng lại trực tiếp thay vì cộng trừ lại
// ở FE (trước đây cộng chuỗi bằng "+" bị nối chuỗi thay vì cộng số, ra NaN).
const net = (r) => Number(r.net_salary || 0);
const sumBonus = (r) => Number(r.revenue_bonus || 0) + Number(r.kpi_bonus || 0) + Number(r.top_driver_bonus || 0) + Number(r.other_bonus || 0);
const sumDeduction = (r) => Number(r.insurance_employee || 0) + Number(r.driver_debt_deduction || 0) + Number(r.advance_deduction || 0) + Number(r.other_deduction || 0);

const PAYROLL_STATUS_LABELS = {
  pending: "Chờ xác nhận",
  reviewed: "Đã xác nhận",
  approved: "Đã duyệt",
  paid: "Đã chi",
};

const NOW = new Date();
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = [NOW.getFullYear(), NOW.getFullYear() - 1, NOW.getFullYear() - 2];

export default function PayrollView() {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [year, setYear] = useState(NOW.getFullYear());
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [revertRow, setRevertRow] = useState(null);

  useEffect(() => {
    managerService.getCompanyInfo()
      .then((data) => setCompanyInfo(data?.info || null))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await managerService.getPayrolls({ month, year, ...(status ? { status } : {}), ...(search ? { search } : {}), ...(sort ? { sort } : {}) });
      setPayrolls(res.payrolls || []);
    } catch (e) {
      alert(e.message || "Lỗi tải bảng lương");
    } finally {
      setLoading(false);
    }
  }, [month, year, status, search, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [month, year, status, search, sort]);

  const totalPages = Math.max(1, Math.ceil(payrolls.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedPayrolls = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return payrolls.slice(start, start + pageSize);
  }, [payrolls, safePage, pageSize]);

  const handleReview = async (record) => {
    setReviewing(record.id);
    try {
      await managerService.reviewPayroll(record.id);
      load();
    } catch (e) {
      alert(e.message || "Lỗi xác nhận");
    } finally {
      setReviewing(null);
    }
  };

  const pending = payrolls.filter((p) => p.status === "pending").length;
  const reviewed = payrolls.filter((p) => p.status === "reviewed").length;
  const totalNet = payrolls.reduce((s, r) => s + net(r), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Tổng bảng lương" value={payrolls.length} border="border-gray-100" lightBg="bg-gray-50" text="text-gray-700" gradient="from-gray-400 to-gray-500" />
        <StatCard label="Chờ xác nhận" value={pending} border="border-amber-100" lightBg="bg-amber-50" text="text-amber-600" gradient="from-amber-500 to-amber-600" />
        <StatCard label="Đã xác nhận" value={reviewed} border="border-blue-100" lightBg="bg-blue-50" text="text-blue-600" gradient="from-blue-500 to-blue-600" />
        <StatCard label="Tổng thực lĩnh" value={fmt(totalNet)} border="border-emerald-100" lightBg="bg-emerald-50" text="text-emerald-600" gradient="from-emerald-500 to-emerald-600" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Select selectedKeys={[String(month)]} onSelectionChange={(k) => setMonth(Number([...k][0]))} variant="bordered" size="sm" className="w-28">
            {MONTHS.map((m) => <SelectItem key={String(m)}>{`Tháng ${m}`}</SelectItem>)}
          </Select>
          <Select selectedKeys={[String(year)]} onSelectionChange={(k) => setYear(Number([...k][0]))} variant="bordered" size="sm" className="w-24">
            {YEARS.map((y) => <SelectItem key={String(y)}>{String(y)}</SelectItem>)}
          </Select>
          <Select
            selectedKeys={status ? [status] : []}
            onSelectionChange={(k) => setStatus([...k][0] ?? "")}
            placeholder="Tất cả trạng thái"
            variant="bordered"
            size="sm"
            className="w-44"
          >
            <SelectItem key="pending">Chờ xác nhận</SelectItem>
            <SelectItem key="reviewed">Đã xác nhận</SelectItem>
            <SelectItem key="approved">Đã duyệt</SelectItem>
            <SelectItem key="paid">Đã chi</SelectItem>
          </Select>
          <Input
            placeholder="Tìm tài xế..."
            value={search}
            onValueChange={setSearch}
            startContent={<RiSearchLine size={14} className="text-gray-400" />}
            variant="bordered"
            size="sm"
            className="w-56"
            isClearable
          />
          <Select
            selectedKeys={new Set([sort])}
            onSelectionChange={(k) => setSort([...k][0] ?? "")}
            variant="bordered"
            size="sm"
            className="w-52"
            aria-label="Sắp xếp"
          >
            <SelectItem key="" textValue="Mặc định">Mặc định</SelectItem>
            <SelectItem key="net-salary-desc" textValue="Thực lĩnh cao nhất">Thực lĩnh cao nhất</SelectItem>
            <SelectItem key="net-salary-asc" textValue="Thực lĩnh thấp nhất">Thực lĩnh thấp nhất</SelectItem>
            <SelectItem key="status" textValue="Trạng thái">Trạng thái</SelectItem>
          </Select>
          <Button variant="flat" size="sm" startContent={<RiRefreshLine size={14} />} onPress={load}>Làm mới</Button>
        </div>

        <div className="overflow-x-auto">
        <Table removeWrapper aria-label="Bảng lương tài xế" classNames={{ th: "px-4 first:pl-5 last:pr-5", td: "px-4 py-3 first:pl-5 last:pr-5" }}>
          <TableHeader>
            <TableColumn>TÀI XẾ</TableColumn>
            <TableColumn>KỲ LƯƠNG</TableColumn>
            <TableColumn>LƯƠNG CƠ BẢN</TableColumn>
            <TableColumn>THƯỞNG</TableColumn>
            <TableColumn>HOÀN CHI PHÍ</TableColumn>
            <TableColumn>KHẤU TRỪ</TableColumn>
            <TableColumn>THỰC LĨNH</TableColumn>
            <TableColumn>TRẠNG THÁI</TableColumn>
            <TableColumn> </TableColumn>
          </TableHeader>
          <TableBody
            items={pagedPayrolls}
            isLoading={loading}
            loadingContent={<Spinner color="primary" />}
            emptyContent="Không có bảng lương nào."
          >
            {(r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-800 text-sm">{r.driver_name}</span>
                    <span className="text-xs text-gray-400">{r.driver_phone}</span>
                  </div>
                </TableCell>
                <TableCell>{`T${r.payroll_month}/${r.payroll_year}`}</TableCell>
                <TableCell>{fmt(r.base_salary)}</TableCell>
                <TableCell>{fmt(sumBonus(r))}</TableCell>
                <TableCell>
                  {/* Tiền công ty hoàn lại khoản tài đã ứng (chi hộ + chi phí) — không phải thưởng */}
                  <span className={Number(r.expense_reimbursement || 0) > 0 ? "font-semibold text-teal-600" : "text-gray-400"}>
                    {fmt(r.expense_reimbursement)}
                  </span>
                </TableCell>
                <TableCell>{fmt(sumDeduction(r))}</TableCell>
                <TableCell><span className="font-bold text-blue-600">{fmt(net(r))}</span></TableCell>
                <TableCell><StatusBadge status={r.status}>{PAYROLL_STATUS_LABELS[r.status] || r.status}</StatusBadge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {r.status === "pending" && (
                      <Button size="sm" color="primary" startContent={<RiCheckLine size={14} />} isLoading={reviewing === r.id} onPress={() => handleReview(r)}>
                        Xác nhận
                      </Button>
                    )}
                    <Button
                      size="sm" variant="flat"
                      startContent={<RiEyeLine size={14} />}
                      onPress={() => setDetailRow(r)}
                    >
                      Chi tiết
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {payrolls.length > 0 && (
          <div className="mt-4">
            <PaginationBar
              page={safePage}
              pageSize={pageSize}
              totalItems={payrolls.length}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
            />
          </div>
        )}
      </div>

      {detailRow && (
        <PayslipDetailModal
          row={detailRow}
          companyInfo={companyInfo}
          onRevert={setRevertRow}
          onClose={() => setDetailRow(null)}
        />
      )}

      {revertRow && (
        <ManagerRevertModal
          row={revertRow}
          onClose={() => setRevertRow(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
