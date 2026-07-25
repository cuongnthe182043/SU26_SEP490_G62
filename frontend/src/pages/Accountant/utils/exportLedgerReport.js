const BRAND_BLUE = "FF2563EB";
const BRAND_DARK = "FF1E293B";
const HEADER_TEXT = "FFFFFFFF";
const SUBTLE_FILL = "FFF8FAFC";
const INFO_FILL = "FFEFF6FF";
const WARNING_FILL = "FFFFFBEB";
const BORDER_COLOR = "FFE2E8F0";
const MONEY_FORMAT = '#,##0';

const thin = { style: "thin", color: { argb: BORDER_COLOR } };
const allBorders = { top: thin, left: thin, right: thin, bottom: thin };

const RAW_HEADERS = [
  "id", "ngay_phat_sinh", "loai_su_kien", "dien_giai", "tk_no", "tk_co",
  "so_tien", "tien_cuoc", "tien_chi_ho", "but_toan_dao", "ref_type", "ref_id",
];

const DISPLAY_COLUMNS = [
  { header: "Mã bút toán", key: "id", width: 14 },
  { header: "Ngày phát sinh", key: "occurredAt", width: 22 },
  { header: "Loại sự kiện", key: "eventLabel", width: 24 },
  { header: "Diễn giải", key: "description", width: 46 },
  { header: "TK Nợ", key: "debitAccount", width: 12 },
  { header: "TK Có", key: "creditAccount", width: 12 },
  { header: "Số tiền", key: "amount", width: 18, money: true },
  { header: "Tiền cước", key: "cargoFee", width: 18, money: true },
  { header: "Tiền chi hộ", key: "passThrough", width: 18, money: true },
  { header: "Bút toán đảo", key: "reversalOf", width: 15 },
  { header: "Loại tham chiếu", key: "refType", width: 18 },
  { header: "Mã tham chiếu", key: "refId", width: 15 },
];

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function parseLedgerCsv(csv) {
  const clean = String(csv || "").replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  const keys = headers.length ? headers : RAW_HEADERS;

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
  });
}

function toNumber(value) {
  if (value === "" || value == null) return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}

function normalizeRows(csv) {
  return parseLedgerCsv(csv).map((row) => ({
    id: row.id,
    occurredAt: toDate(row.ngay_phat_sinh),
    eventLabel: row.loai_su_kien,
    description: row.dien_giai,
    debitAccount: row.tk_no,
    creditAccount: row.tk_co,
    amount: toNumber(row.so_tien),
    cargoFee: toNumber(row.tien_cuoc),
    passThrough: toNumber(row.tien_chi_ho),
    reversalOf: row.but_toan_dao,
    refType: row.ref_type,
    refId: row.ref_id,
  }));
}

function styleHeaderRow(row) {
  row.height = 26;
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_BLUE } };
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = allBorders;
  });
}

function styleDataRow(row, rowIndex) {
  row.height = 24;
  row.eachCell((cell, colNumber) => {
    const column = DISPLAY_COLUMNS[colNumber - 1];
    cell.border = allBorders;
    cell.alignment = {
      vertical: "middle",
      horizontal: column?.money ? "right" : colNumber >= 5 && colNumber <= 6 ? "center" : "left",
      wrapText: colNumber === 4,
    };
    if (column?.money && typeof cell.value === "number") cell.numFmt = MONEY_FORMAT;
    if (cell.value instanceof Date) cell.numFmt = "dd/mm/yyyy hh:mm";
    if (rowIndex % 2 === 0) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUBTLE_FILL } };
    }
  });
}

function addInfoSheet(wb, { from, to, rowCount, totalAmount }) {
  const ws = wb.addWorksheet("THONG_TIN_XUAT", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 26 }, { width: 56 }];

  const rows = [
    ["Báo cáo", "Nhật ký tài chính"],
    ["Kỳ kế toán", `${from} đến ${to}`],
    ["Thời điểm xuất", new Date()],
    ["Số bút toán", rowCount],
    ["Tổng phát sinh", totalAmount],
    ["Ghi chú", "File được tạo từ dữ liệu đã chốt kỳ trên hệ thống LogisCount."],
  ];

  rows.forEach((values, index) => {
    const row = ws.addRow(values);
    row.eachCell((cell, colNumber) => {
      cell.border = allBorders;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (colNumber === 1) {
        cell.font = { bold: true, color: { argb: BRAND_DARK } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INFO_FILL } };
      }
      if (index === 2 && colNumber === 2) cell.numFmt = "dd/mm/yyyy hh:mm";
      if (index === 4 && colNumber === 2) cell.numFmt = MONEY_FORMAT;
    });
  });
}

export async function exportLedgerCsvToExcel(csv, { from, to } = {}) {
  const rows = normalizeRows(csv);
  if (rows.length === 0) throw new Error("Không có dữ liệu để xuất Excel.");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LogisCount";
  wb.created = new Date();

  const ws = wb.addWorksheet("NHAT_KY_TAI_CHINH", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
  });

  ws.columns = DISPLAY_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  ws.spliceRows(1, 0, [], [], [], []);
  ws.mergeCells(1, 1, 1, DISPLAY_COLUMNS.length);
  ws.mergeCells(2, 1, 2, DISPLAY_COLUMNS.length);
  ws.mergeCells(3, 1, 3, DISPLAY_COLUMNS.length);

  ws.getCell("A1").value = "NHẬT KÝ TÀI CHÍNH";
  ws.getCell("A1").font = { bold: true, size: 18, color: { argb: BRAND_DARK } };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 30;

  ws.getCell("A2").value = `Kỳ kế toán: ${from || "-"} đến ${to || "-"}`;
  ws.getCell("A2").font = { size: 11, color: { argb: "FF475569" } };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };

  ws.getCell("A3").value = `Xuất lúc: ${new Date().toLocaleString("vi-VN")} | Số bút toán: ${rows.length}`;
  ws.getCell("A3").font = { italic: true, size: 10, color: { argb: "FF64748B" } };
  ws.getCell("A3").alignment = { vertical: "middle", horizontal: "center" };

  const headerRow = ws.getRow(5);
  DISPLAY_COLUMNS.forEach((column, index) => {
    headerRow.getCell(index + 1).value = column.header;
  });
  styleHeaderRow(headerRow);
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: DISPLAY_COLUMNS.length },
  };

  let totalAmount = 0;
  let totalCargoFee = 0;
  let totalPassThrough = 0;

  rows.forEach((item, index) => {
    const row = ws.addRow(DISPLAY_COLUMNS.map((column) => item[column.key] ?? ""));
    styleDataRow(row, index);
    totalAmount += Number(item.amount) || 0;
    totalCargoFee += Number(item.cargoFee) || 0;
    totalPassThrough += Number(item.passThrough) || 0;
  });

  const totalRow = ws.addRow([
    "", "", "", "TỔNG CỘNG", "", "", totalAmount, totalCargoFee || "", totalPassThrough || "", "", "", "",
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell, colNumber) => {
    const column = DISPLAY_COLUMNS[colNumber - 1];
    cell.font = { bold: true, color: { argb: BRAND_DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNING_FILL } };
    cell.border = { top: { style: "double", color: { argb: BORDER_COLOR } }, left: thin, right: thin, bottom: thin };
    cell.alignment = { vertical: "middle", horizontal: column?.money ? "right" : "left" };
    if (column?.money && typeof cell.value === "number") cell.numFmt = MONEY_FORMAT;
  });

  addInfoSheet(wb, { from, to, rowCount: rows.length, totalAmount });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Nhat Ky Tai Chinh_${from || "tu-ngay"}_${to || "den-ngay"}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
