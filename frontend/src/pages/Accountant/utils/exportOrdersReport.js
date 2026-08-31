import { APP_NAME } from "../../../constants/brand";
import {
  drawEntityHeader, drawFormTitle, drawSignatureBlock,
  setPrintLayout, downloadWorkbook,
} from "../../../utils/vnAccountingForm";
// Dựng & tải file Excel báo cáo doanh thu — cùng phong cách trình bày với
// "Template Import Don Ngoai.xlsx" (ImportExcelModal.jsx) nhưng là báo cáo XUẤT RA
// (dữ liệu thật, có thêm chi phí + trạng thái thanh toán), không phải template nhập vào.

const BRAND_BLUE = "FF2563EB";
const HEADER_TEXT = "FFFFFFFF";
const ZEBRA_FILL = "FFF8FAFC";
const BORDER_COLOR = "FFE2E8F0";
const thinBorder = { style: "thin", color: { argb: BORDER_COLOR } };

const HEADERS = [
  "Mã đơn", "Mã chuyến", "Ngày chạy", "Biển số xe", "Tên tài xế",
  "Tên khách hàng", "SĐT khách hàng", "Điểm lấy hàng", "Điểm giao hàng",
  "Quãng đường (km)", "Tên hàng", "Cước xe (đ)", "Phí cầu đường/vé (đ)",
  "Phí đỗ xe/bãi (đ)", "Xăng dầu (đ)", "Sửa xe (đ)", "Thanh toán",
  "Tiền tài đang giữ (đ)", "Ghi chú",
];
const MONEY_COLS = new Set([
  "Cước xe (đ)", "Phí cầu đường/vé (đ)", "Phí đỗ xe/bãi (đ)", "Xăng dầu (đ)", "Sửa xe (đ)", "Tiền tài đang giữ (đ)",
]);

// Ngày chạy phải đọc theo giờ VN, không theo giờ máy người xuất: chuyến chạy 00:30 ngày
// 02/05 (+07) mà máy đặt múi giờ khác sẽ ra 01/05 — lệch ngày là lệch cả kỳ doanh thu.
const vnDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit", month: "2-digit", year: "numeric",
});

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(vnDateFormatter.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year}`;
};

export async function exportOrdersReportToExcel(rows, { filterLabel = "", company = {} } = {}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = company.company_name || APP_NAME;
  wb.created = new Date();

  const ws = wb.addWorksheet("BAO_CAO_DOANH_THU");
  ws.columns = HEADERS.map((h) => ({ width: Math.max(h.length + 2, 14) }));

  // Khối định danh đơn vị + tên biểu + đơn vị tính, rồi mới tới tiêu đề cột.
  //
  // File này còn được NHẬP NGƯỢC LẠI (kế toán xuất ra, sửa vài dòng, nhập lại), nên
  // parseImportRows đã được sửa để TÌM dòng tiêu đề thay vì mặc định là dòng 1 —
  // không sửa chỗ đó thì thêm mấy dòng ở đây là hỏng cả đường nhập.
  let r = drawEntityHeader(ws, { company, colCount: HEADERS.length });
  r = drawFormTitle(ws, {
    title: "Báo cáo doanh thu vận chuyển",
    subtitle: filterLabel || "Toàn bộ đơn đã hoàn thành",
    unit: "đồng",
    colCount: HEADERS.length,
    startRow: r,
  });

  const headerRowIndex = r;
  const headerRow = ws.getRow(headerRowIndex);
  headerRow.height = 26;
  HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
  });
  ws.views = [{ state: "frozen", ySplit: headerRowIndex }];
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: HEADERS.length },
  };

  let totalCargoFee = 0, totalToll = 0, totalParking = 0, totalFuel = 0, totalRepair = 0, totalHolding = 0;

  rows.forEach((r, i) => {
    const rowValues = [
      r.order_id, r.shipment_id, fmtDate(r.run_date), r.vehicle_plate, r.driver_name,
      r.customer_name, r.customer_phone, r.pickup, r.delivery,
      r.distance_km ?? "", r.cargo_name ?? "", r.cargo_fee, r.toll, r.parking, r.fuel, r.repair,
      r.payment_label, r.driver_holding ?? "", r.notes ?? "",
    ];
    const row = ws.addRow(rowValues);
    row.eachCell((cell, colNumber) => {
      const h = HEADERS[colNumber - 1];
      cell.border = { top: thinBorder, left: thinBorder, right: thinBorder, bottom: thinBorder };
      cell.alignment = { vertical: "middle", horizontal: MONEY_COLS.has(h) ? "right" : "left" };
      if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA_FILL } };
    });

    totalCargoFee += Number(r.cargo_fee) || 0;
    totalToll     += Number(r.toll) || 0;
    totalParking  += Number(r.parking) || 0;
    totalFuel     += Number(r.fuel) || 0;
    totalRepair   += Number(r.repair) || 0;
    totalHolding  += Number(r.driver_holding) || 0;
  });

  // Dòng tổng cộng — nhãn đặt ở cột ĐẦU TIÊN để trình nhập nhận ra và bỏ qua, nhờ vậy
  // file vừa xuất mở lên sửa rồi import ngược lại được (trước đây dòng này bị đọc như
  // một chuyến và sinh loạt lỗi giả "thiếu biển số / thiếu tài xế").
  const totalRow = ws.addRow([
    "TỔNG CỘNG", "", "", "", "", "", "", "", "", "", "",
    totalCargoFee, totalToll, totalParking, totalFuel, totalRepair, "", totalHolding, "",
  ]);
  totalRow.eachCell((cell, colNumber) => {
    const h = HEADERS[colNumber - 1];
    cell.font = { bold: true };
    cell.border = { top: { style: "double", color: { argb: BORDER_COLOR } }, left: thinBorder, right: thinBorder, bottom: thinBorder };
    cell.alignment = { vertical: "middle", horizontal: MONEY_COLS.has(h) ? "right" : "left" };
    if (MONEY_COLS.has(h) && typeof cell.value === "number") cell.numFmt = "#,##0";
  });

  drawSignatureBlock(ws, {
    colCount: HEADERS.length,
    startRow: ws.lastRow.number,
    signers: ["Người lập biểu", "Kế toán trưởng", "Giám đốc"],
  });
  setPrintLayout(ws, { landscape: true, headerRows: `${headerRowIndex}:${headerRowIndex}` });

  // Sheet ghi chú bộ lọc đã áp dụng lúc xuất
  const wsInfo = wb.addWorksheet("THONG_TIN_XUAT", { views: [{ showGridLines: false }] });
  wsInfo.columns = [{ width: 24 }, { width: 60 }];
  wsInfo.addRow(["Đơn vị", company.company_name || "—"]);
  wsInfo.addRow(["Mã số thuế", company.tax_code || "—"]);
  wsInfo.addRow(["Địa chỉ", company.address || "—"]);
  wsInfo.addRow(["Thời điểm xuất", new Date().toLocaleString("vi-VN")]);
  wsInfo.addRow(["Bộ lọc áp dụng", filterLabel || "Không lọc — toàn bộ đơn đã hoàn thành"]);
  wsInfo.addRow(["Số chuyến", rows.length]);
  for (let i = 1; i <= 6; i += 1) wsInfo.getRow(i).font = { bold: true };

  const ts = new Date().toISOString().slice(0, 10);
  await downloadWorkbook(wb, `Bao cao doanh thu van chuyen_${ts}.xlsx`);
}
