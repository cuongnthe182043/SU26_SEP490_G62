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

const STATUS_LABEL = { open: "Đang mở (tính động)", closed: "Đã chốt", signed_off: "Đã ký duyệt (khoá)" };

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
function writeRows(ws, rows, moneyCols, startRow) {
  rows.forEach((values, i) => {
    const row = ws.getRow(startRow + i);
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.border = allBorders;
      const money = moneyCols.has(c);
      cell.alignment = { vertical: "middle", horizontal: money ? "right" : "left" };
      if (money && typeof v === "number") cell.numFmt = MONEY;
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
    });
    row.commit?.();
  });
}

export async function exportBusinessReportToExcel(data, { periodLabel = "" } = {}) {
  const pnl = data?.pnl ?? {};
  const prev = pnl.prev ?? {};
  const cash = data?.cashflow ?? {};
  const ops = data?.fleet_ops ?? {};
  const meta = data?.meta ?? { status: "open" };
  const totalCost = num(pnl.operating_cost) + num(pnl.payroll_cost);
  const prevCost = num(prev.operating_cost) + num(prev.payroll_cost);

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisCount";
  wb.created = new Date();

  // 1) Kết quả kinh doanh (P&L)
  {
    const ws = wb.addWorksheet("KET_QUA_KINH_DOANH");
    const h = titleAndHeader(ws, `Kết quả kinh doanh — ${periodLabel}`,
      ["Chỉ tiêu", "Kỳ này", "Kỳ trước", "Thay đổi"], [30, 20, 20, 14]);
    writeRows(ws, [
      ["Doanh thu", num(pnl.revenue), num(prev.revenue), pctDelta(pnl.revenue, prev.revenue)],
      ["Chi phí vận hành", num(pnl.operating_cost), num(prev.operating_cost), pctDelta(pnl.operating_cost, prev.operating_cost)],
      ["Chi phí lương", num(pnl.payroll_cost), num(prev.payroll_cost), pctDelta(pnl.payroll_cost, prev.payroll_cost)],
      ["Tổng chi phí", totalCost, prevCost, pctDelta(totalCost, prevCost)],
      ["Lợi nhuận gộp", num(pnl.gross_profit), num(prev.gross_profit), pctDelta(pnl.gross_profit, prev.gross_profit)],
      ["Biên lợi nhuận (%)", Number(num(pnl.margin_pct).toFixed(1)), Number(num(prev.margin_pct).toFixed(1)),
        `${(num(pnl.margin_pct) - num(prev.margin_pct)).toFixed(1)} điểm`],
      ["Số chuyến hoàn thành", num(pnl.completed_trips), num(prev.completed_trips), pctDelta(pnl.completed_trips, prev.completed_trips)],
    ], new Set([1, 2]), h + 1);
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

  // 3) Hiệu suất đội xe
  {
    const ws = wb.addWorksheet("DOI_XE");
    const h = titleAndHeader(ws, `Hiệu suất đội xe — ${ops.completed ?? 0} chuyến hoàn thành, ${num(ops.failed_rate).toFixed(1)}% hỏng`,
      ["Biển số", "Nhóm xe", "Doanh thu (đ)", "Số chuyến", "Quãng đường (km)", "Doanh thu/km (đ)"], [14, 18, 20, 12, 16, 18]);
    const rows = (data?.fleet ?? []).map((v) => [
      v.plate_number, v.vehicle_group_name ?? "", num(v.revenue), num(v.trip_count),
      Number(num(v.distance_km).toFixed(1)), Math.round(num(v.revenue_per_km)),
    ]);
    writeRows(ws, rows, new Set([2, 5]), h + 1);
  }

  // 4) Năng suất tài xế
  {
    const ws = wb.addWorksheet("TAI_XE");
    const h = titleAndHeader(ws, "Năng suất tài xế", ["Tài xế", "Doanh thu (đ)", "Số chuyến"], [28, 22, 12]);
    const rows = (data?.drivers ?? []).map((d) => [d.driver_name, num(d.revenue), num(d.trip_count)]);
    writeRows(ws, rows, new Set([1]), h + 1);
  }

  // 5) Dòng tiền & công nợ
  {
    const ws = wb.addWorksheet("DONG_TIEN_CONG_NO");
    const aging = cash.debt_aging ?? {};
    const h = titleAndHeader(ws, "Dòng tiền & công nợ", ["Chỉ tiêu", "Giá trị"], [34, 24]);
    const kpiRows = [
      ["Nợ phải thu (tổng)", num(cash.receivable_total)],
      ["DSO — số ngày thu tiền bình quân", `${num(cash.dso).toFixed(0)} ngày`],
      ["Tỷ lệ thu hồi trong kỳ", `${num(cash.collection_rate).toFixed(0)}%`],
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

    // Bảng con: công nợ chi tiết khách hàng (theo tuổi nợ) — gộp chung sheet dòng tiền
    const debts = data?.customer_debts ?? [];
    if (debts.length) {
      [16, 15, 15, 15, 15, 13].forEach((w, i) => {
        const col = ws.getColumn(i + 2);
        col.width = Math.max(col.width || 0, w);
      });
      const start = ws.lastRow.number + 2;
      ws.getCell(start, 1).value = "Công nợ chi tiết khách hàng (theo tuổi nợ)";
      ws.getCell(start, 1).font = { bold: true };
      const hr = ws.getRow(start + 1);
      ["Khách hàng", "Dư nợ (đ)", "0–30 (đ)", "31–60 (đ)", "61–90 (đ)", "> 90 (đ)", "Đơn chưa thu"].forEach((t, i) => {
        const c = hr.getCell(i + 1);
        c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        c.font = { bold: true, color: { argb: HEADER_TEXT } }; c.border = allBorders;
        c.alignment = { horizontal: "center", wrapText: true };
      });
      const rows = debts.map((c) => [
        c.name, num(c.outstanding), num(c.d0_30), num(c.d30_60), num(c.d60_90), num(c.d90_plus), num(c.unpaid_orders),
      ]);
      const sum = (k) => debts.reduce((s, c) => s + num(c[k]), 0);
      rows.push(["TỔNG CỘNG", sum("outstanding"), sum("d0_30"), sum("d30_60"), sum("d60_90"), sum("d90_plus"), sum("unpaid_orders")]);
      writeRows(ws, rows, new Set([1, 2, 3, 4, 5]), start + 2);
      ws.getRow(start + 1 + rows.length).font = { bold: true };
    }
  }

  // 6) Khách hàng
  {
    const ws = wb.addWorksheet("KHACH_HANG");
    const h = titleAndHeader(ws, "Top khách hàng theo doanh thu kỳ",
      ["Khách hàng", "Số đơn", "Doanh thu (đ)"], [32, 12, 22]);
    writeRows(ws, (data?.top_customers ?? []).map((c) => [c.name, num(c.total_orders), num(c.total_revenue)]),
      new Set([2]), h + 1);

    const risky = data?.risky_customers ?? [];
    if (risky.length) {
      const start = ws.lastRow.number + 2;
      ws.getCell(start, 1).value = "Khách hàng rủi ro công nợ";
      ws.getCell(start, 1).font = { bold: true };
      const hr = ws.getRow(start + 1);
      ["Khách hàng", "Dư nợ (đ)", "Quá hạn (đ)"].forEach((t, i) => {
        const c = hr.getCell(i + 1);
        c.value = t; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
        c.font = { bold: true, color: { argb: HEADER_TEXT } }; c.border = allBorders;
        c.alignment = { horizontal: "center" };
      });
      writeRows(ws, risky.map((c) => [c.name, num(c.outstanding), num(c.overdue)]), new Set([1, 2]), start + 2);
    }
  }

  // 7) Thông tin xuất
  {
    const ws = wb.addWorksheet("THONG_TIN_XUAT", { views: [{ showGridLines: false }] });
    ws.columns = [{ width: 26 }, { width: 60 }];
    const info = [
      ["Báo cáo", "Kết quả kinh doanh"],
      ["Kỳ báo cáo", periodLabel],
      ["Trạng thái chốt", STATUS_LABEL[meta.status] ?? meta.status],
      ["Người chốt", meta.closed_by_name ?? "—"],
      ["Thời điểm chốt", fmtDateTime(meta.closed_at) || "—"],
      ["Người ký duyệt", meta.signed_off_by_name ?? "—"],
      ["Thời điểm ký duyệt", fmtDateTime(meta.signed_off_at) || "—"],
      ["Ghi chú", meta.note ?? "—"],
      ["Thời điểm xuất file", new Date().toLocaleString("vi-VN")],
    ];
    info.forEach((r) => { const row = ws.addRow(r); row.getCell(1).font = { bold: true }; });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bao Cao Kinh Doanh_${periodLabel.replace(/[^\dA-Za-z]+/g, "-")}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
