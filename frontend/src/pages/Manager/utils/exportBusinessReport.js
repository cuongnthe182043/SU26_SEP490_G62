import { APP_NAME } from "../../../constants/brand";
import { reconcileDebtRows } from "./debtReconcile";
// Xuất báo cáo kinh doanh (Manager) ra Excel nhiều sheet — cùng phong cách trình bày
// với báo cáo doanh thu của Kế toán (exportOrdersReport.js): header xanh thương hiệu,
// viền mảnh, cột tiền canh phải định dạng #,##0. Dữ liệu lấy thẳng từ payload đang xem
// (nếu kỳ đã chốt thì đây chính là số đã đóng băng trong snapshot).

const BRAND_BLUE = "FF2563EB";
const HEADER_TEXT = "FFFFFFFF";
const ZEBRA_FILL = "FFF8FAFC";
const BORDER_COLOR = "FFE2E8F0";
const TITLE_TEXT = "FF1E293B";
const thin = { style: "thin", color: { argb: BORDER_COLOR } };
const allBorders = { top: thin, left: thin, right: thin, bottom: thin };
const MONEY = "#,##0";
// Phần trăm giữ 1 chữ số thập phân. Dùng MONEY cho dòng biên lợi nhuận thì 12.3 hiện
// ra thành "12" — mất đúng con số mà cả báo cáo đang nói tới.
const PERCENT1 = '#,##0.0"%"';

const num = (v) => Number(v || 0);

const fmtDateTime = (v) => {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
};

// Δ tương đối (%) dạng chuỗi có dấu, dùng cho các dòng tiền.
const pctDelta = (cur, prev) => {
  if (!prev) return "—";
  const p = ((num(cur) - num(prev)) / Math.abs(num(prev))) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
};

const STATUS_LABEL = { open: "Đang mở (tính động)", signed_off: "Đã ký duyệt (khoá cứng)" };

// Bỏ dấu tiếng Việt trước khi lọc ký tự cho tên file: cắt thẳng thì "Tháng 8/2026"
// thành "Th-ng-8-2026".
const slugify = (s) => s
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D")
  .replace(/[^\dA-Za-z]+/g, "-")
  .replace(/^-+|-+$/g, "");

// Tiêu đề lớn ở A1 + tô header cho hàng cột.
function titleAndHeader(ws, title, headers, colWidths) {
  ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: colWidths[i] ?? 16 }));

  ws.spliceRows(1, 0, [title]);
  ws.mergeCells(1, 1, 1, headers.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: TITLE_TEXT } };
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 26;

  const headerRow = ws.getRow(2);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = allBorders;
  });
  return 2; // header ở dòng 2, dữ liệu bắt đầu dòng 3
}

// Ghi các dòng dữ liệu, moneyCols (Set chỉ số cột 0-based) canh phải + định dạng tiền.
// rowFmt = { [chỉ số dòng]: numFmt } để một dòng cụ thể dùng định dạng khác định dạng
// tiền của cột (dòng phần trăm nằm chung cột với các dòng tiền).
function writeRows(ws, rows, moneyCols, startRow, rowFmt = {}) {
  rows.forEach((values, i) => {
    const row = ws.getRow(startRow + i);
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.border = allBorders;
      const money = moneyCols.has(c);
      cell.alignment = { vertical: "middle", horizontal: money ? "right" : "left" };
      if (money && typeof v === "number") cell.numFmt = rowFmt[i] ?? MONEY;
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
    });
    row.commit?.();
  });
}

export async function exportBusinessReportToExcel(data, { periodLabel = "" } = {}) {
  const pnl = data?.pnl ?? {};
  const prev = pnl.prev ?? {};
  const cash = data?.cashflow ?? {};
  const meta = data?.meta ?? { status: "open" };
  const totalCost = num(pnl.operating_cost) + num(pnl.payroll_cost);
  const prevCost = num(prev.operating_cost) + num(prev.payroll_cost);

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  // 1) Kết quả kinh doanh (P&L)
  {
    const ws = wb.addWorksheet("KET_QUA_KINH_DOANH");
    const h = titleAndHeader(ws, `Kết quả kinh doanh — ${periodLabel}`,
      ["Chỉ tiêu", "Kỳ này", "Kỳ trước", "Thay đổi"], [30, 20, 20, 14]);
    const MARGIN = "Biên lợi nhuận (%)";
    const rows = [
      ["Doanh thu", num(pnl.revenue), num(prev.revenue), pctDelta(pnl.revenue, prev.revenue)],
      ["— trong đó doanh thu bán chịu", num(pnl.revenue_credit), num(prev.revenue_credit), pctDelta(pnl.revenue_credit, prev.revenue_credit)],
      ["— trong đó kỳ trước chuyển sang", num(pnl.revenue_carried_in), num(prev.revenue_carried_in), pctDelta(pnl.revenue_carried_in, prev.revenue_carried_in)],
      ["Chi phí vận hành", num(pnl.operating_cost), num(prev.operating_cost), pctDelta(pnl.operating_cost, prev.operating_cost)],
      ["Chi phí lương", num(pnl.payroll_cost), num(prev.payroll_cost), pctDelta(pnl.payroll_cost, prev.payroll_cost)],
      ["Tổng chi phí", totalCost, prevCost, pctDelta(totalCost, prevCost)],
      ["Lợi nhuận gộp", num(pnl.gross_profit), num(prev.gross_profit), pctDelta(pnl.gross_profit, prev.gross_profit)],
      [MARGIN, Number(num(pnl.margin_pct).toFixed(1)), Number(num(prev.margin_pct).toFixed(1)),
        `${(num(pnl.margin_pct) - num(prev.margin_pct)).toFixed(1)} điểm`],
      // Chỉ đếm chuyến ĐÃ CHỐT GIÁ — cùng phạm vi với dòng Doanh thu ở trên. Chuyến chạy
      // xong mà chưa có giá chưa ghi nhận doanh thu ở kỳ nào nên không nằm trong số này.
      ["Số chuyến đã chốt giá", num(pnl.completed_trips), num(prev.completed_trips), pctDelta(pnl.completed_trips, prev.completed_trips)],
    ];
    writeRows(ws, rows, new Set([1, 2]), h + 1,
      { [rows.findIndex((r) => r[0] === MARGIN)]: PERCENT1 });
  }

  // 2) Cơ cấu chi phí
  {
    const ws = wb.addWorksheet("CO_CAU_CHI_PHI");
    const h = titleAndHeader(ws, "Cơ cấu chi phí", ["Khoản mục", "Số tiền (đ)", "Tỷ trọng"], [28, 22, 14]);
    const items = data?.cost_breakdown ?? [];
    const rows = items.map((it) => [
      it.label, num(it.amount),
      totalCost > 0 ? `${((num(it.amount) / totalCost) * 100).toFixed(1)}%` : "0%",
    ]);
    rows.push(["TỔNG CỘNG", totalCost, "100%"]);
    writeRows(ws, rows, new Set([1]), h + 1);
    ws.getRow(h + rows.length).font = { bold: true };
  }

  // 3) Năng suất tài xế
  {
    const ws = wb.addWorksheet("TAI_XE");
    const h = titleAndHeader(ws, "Năng suất tài xế", ["Tài xế", "Doanh thu (đ)", "Số chuyến"], [28, 22, 12]);
    const rows = (data?.drivers ?? []).map((d) => [d.driver_name, num(d.revenue), num(d.trip_count)]);
    writeRows(ws, rows, new Set([1]), h + 1);
  }

  // 4) Dòng tiền & công nợ
  {
    const ws = wb.addWorksheet("DONG_TIEN_CONG_NO");
    const aging = cash.debt_aging ?? {};
    const h = titleAndHeader(ws, "Dòng tiền & công nợ", ["Chỉ tiêu", "Giá trị"], [34, 24]);
    const kpiRows = [
      ["Nợ phải thu (khách + đối tác)", num(cash.receivable_total)],
      ["Doanh thu bán chịu trong kỳ (mẫu số DSO / tỷ lệ thu hồi)", num(cash.credit_revenue)],
      ["DSO — số ngày thu tiền bình quân", `${num(cash.dso).toFixed(0)} ngày`],
      ["Tỷ lệ thu hồi công nợ trong kỳ", `${num(cash.collection_rate).toFixed(0)}%`],
      ["Đã thu trong kỳ", num(cash.collected)],
      ["Nợ 0–30 ngày", num(aging.d0_30)],
      ["Nợ 31–60 ngày", num(aging.d30_60)],
      ["Nợ 61–90 ngày", num(aging.d60_90)],
      ["Nợ quá hạn > 90 ngày", num(aging.d90_plus)],
      ["Tổng tiền tài xế đang cầm", num(cash.driver_holdings_total)],
    ];
    writeRows(ws, kpiRows, new Set([1]), h + 1);

    // Bảng con: tiền tài xế đang cầm
    const holdings = cash.driver_holdings ?? [];
    if (holdings.length) {
      const start = h + kpiRows.length + 2;
      ws.getCell(start, 1).value = "Chi tiết tiền tài xế đang cầm";
      ws.getCell(start, 1).font = { bold: true };
      const hr = ws.getRow(start + 1);
      ["Tài xế", "Số tiền (đ)"].forEach((t, i) => {
        const c = hr.getCell(i + 1);
        c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        c.font = { bold: true, color: { argb: HEADER_TEXT } }; c.border = allBorders;
        c.alignment = { horizontal: "center" };
      });
      writeRows(ws, holdings.map((d) => [d.driver_name, num(d.holding)]), new Set([1]), start + 2);
    }

    // Bảng con: công nợ phải thu chi tiết (khách + đối tác, theo tuổi nợ) — gộp chung
    // sheet dòng tiền. Backend chỉ trả 50 bên nợ lớn nhất, nên reconcileDebtRows chèn
    // thêm dòng gộp phần còn lại; nhờ đó TỔNG CỘNG khớp đúng KPI "Nợ phải thu" ở trên.
    const debts = data?.customer_debts ?? [];
    if (debts.length) {
      [14, 16, 15, 15, 15, 15, 13].forEach((w, i) => {
        const col = ws.getColumn(i + 2);
        col.width = Math.max(col.width || 0, w);
      });
      const start = ws.lastRow.number + 2;
      ws.getCell(start, 1).value = "Công nợ phải thu chi tiết — khách hàng & đối tác (theo tuổi nợ)";
      ws.getCell(start, 1).font = { bold: true };
      const hr = ws.getRow(start + 1);
      ["Khách hàng / đối tác", "Loại", "Dư nợ (đ)", "0–30 (đ)", "31–60 (đ)", "61–90 (đ)", "> 90 (đ)", "Đơn chưa thu"].forEach((t, i) => {
        const c = hr.getCell(i + 1);
        c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        c.font = { bold: true, color: { argb: HEADER_TEXT } }; c.border = allBorders;
        c.alignment = { horizontal: "center", wrapText: true };
      });
      const { rows: debtRows, total } = reconcileDebtRows(debts, cash);
      // party_type null = dòng gộp "các bên nợ khác", không phải một bên nợ cụ thể.
      const partyLabel = (c) => {
        if (!c.party_type) return "";
        return c.party_type === "partner" ? "Đối tác" : "Khách hàng";
      };
      const rows = debtRows.map((c) => [
        c.name, partyLabel(c), c.outstanding, c.d0_30, c.d30_60, c.d60_90, c.d90_plus,
        c.unpaid_orders ?? "—",
      ]);
      rows.push(["TỔNG CỘNG", "", total.outstanding, total.d0_30, total.d30_60,
        total.d60_90, total.d90_plus, total.unpaid_orders]);
      writeRows(ws, rows, new Set([2, 3, 4, 5, 6]), start + 2);
      ws.getRow(start + 1 + rows.length).font = { bold: true };
    }
  }

  // 5) Khách hàng
  {
    const ws = wb.addWorksheet("KHACH_HANG");
    const partyLabel = (c) => (c.party_type === "partner" ? "Đối tác" : "Khách hàng");
    const h = titleAndHeader(ws, "Top khách hàng / đối tác theo doanh thu kỳ",
      ["Khách hàng / đối tác", "Loại", "Số đơn", "Doanh thu (đ)"], [32, 14, 12, 22]);
    writeRows(ws, (data?.top_customers ?? []).map((c) => [c.name, partyLabel(c), num(c.total_orders), num(c.total_revenue)]),
      new Set([3]), h + 1);

    const risky = data?.risky_customers ?? [];
    if (risky.length) {
      const start = ws.lastRow.number + 2;
      ws.getCell(start, 1).value = "Khách hàng / đối tác rủi ro công nợ";
      ws.getCell(start, 1).font = { bold: true };
      const hr = ws.getRow(start + 1);
      ["Khách hàng / đối tác", "Loại", "Dư nợ (đ)", "Quá hạn (đ)"].forEach((t, i) => {
        const c = hr.getCell(i + 1);
        c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        c.font = { bold: true, color: { argb: HEADER_TEXT } }; c.border = allBorders;
        c.alignment = { horizontal: "center" };
      });
      writeRows(ws, risky.map((c) => [c.name, partyLabel(c), num(c.outstanding), num(c.overdue)]), new Set([2, 3]), start + 2);
    }
  }

  // 6) Thông tin xuất
  {
    const ws = wb.addWorksheet("THONG_TIN_XUAT", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 26 }, { width: 60 }];
    const info = [
      ["Báo cáo", "Kết quả kinh doanh"],
      ["Kỳ báo cáo", periodLabel],
      ["Trạng thái kỳ", STATUS_LABEL[meta.status] ?? meta.status],
      ["Người ký duyệt", meta.signed_off_by_name ?? "—"],
      ["Thời điểm ký duyệt", fmtDateTime(meta.signed_off_at) || "—"],
      ["Ghi chú", meta.note || "—"],
      // Hai chỗ dễ hiểu nhầm nhất khi đối chiếu các sheet với nhau — nói thẳng ra đây
      // thay vì để người đọc tự đoán.
      ["Cơ sở ghi nhận doanh thu",
        "Theo kỳ ghi nhận, không theo ngày chạy. Chuyến chốt giá sau khi kỳ gốc đã ký "
        + "duyệt được tính vào kỳ mở kế tiếp (xem dòng \"kỳ trước chuyển sang\")."],
      ["Số chuyến",
        "Sheet KET_QUA_KINH_DOANH đếm chuyến ĐÃ CHỐT GIÁ theo kỳ ghi nhận; sheet DOI_XE "
        + "đếm chuyến CHẠY XONG trong tháng. Hai số này không bằng nhau."],
      ["Thời điểm xuất file", new Date().toLocaleString("vi-VN")],
    ];
    info.forEach((r) => { const row = ws.addRow(r); row.getCell(1).font = { bold: true }; });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bao Cao Kinh Doanh_${slugify(periodLabel)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
