import { APP_NAME } from "../../../constants/brand";
import {
  TT200, MONEY_FORMAT, DATE_FORMAT, allBorders,
  drawEntityHeader, drawFormTitle, drawBookFooter, drawSignatureBlock,
  setPrintLayout, downloadWorkbook,
} from "../../../utils/vnAccountingForm";

/**
 * SỔ NHẬT KÝ CHUNG — Mẫu số S03a-DN (Thông tư 200/2014/TT-BTC).
 *
 * Khác biệt lớn nhất so với bản trước: một bút toán chiếm HAI DÒNG chứ không phải một.
 *
 * Bản cũ in mỗi bút toán một dòng với hai cột "TK Nợ" và "TK Có" — đọc được, nhưng đó
 * không phải nhật ký chung. Sổ nhật ký chung ghi theo VẾ: mỗi vế một dòng, cột "Số hiệu
 * TK đối ứng" mang số tài khoản, và số tiền rơi vào cột Nợ hoặc cột Có tuỳ vế. Cách ghi
 * đó mới cho ra dòng "Cộng số phát sinh" với tổng Nợ = tổng Có — phép cân đối là lý do
 * tồn tại của cuốn sổ này, và bản cũ không có nó.
 *
 * Cột theo đúng mẫu: Ngày ghi sổ | Chứng từ (Số hiệu, Ngày tháng) | Diễn giải |
 * Đã ghi Sổ Cái | STT dòng | Số hiệu TK đối ứng | Số phát sinh (Nợ, Có).
 */

const COLUMNS = [
  { header: "Ngày, tháng\nghi sổ", ordinal: "A", width: 13 },
  { header: "Số hiệu",             ordinal: "B", width: 12 },
  { header: "Ngày, tháng",         ordinal: "C", width: 13 },
  { header: "Diễn giải",           ordinal: "D", width: 52 },
  { header: "Đã ghi\nSổ Cái",      ordinal: "E", width: 9  },
  { header: "STT\ndòng",           ordinal: "G", width: 7  },
  { header: "Số hiệu\nTK đối ứng", ordinal: "H", width: 12 },
  { header: "Nợ",                  ordinal: "1", width: 18, money: true },
  { header: "Có",                  ordinal: "2", width: 18, money: true },
];
const COL_COUNT = COLUMNS.length;

const RAW_HEADERS = [
  "id", "ngay_phat_sinh", "loai_su_kien", "dien_giai", "tk_no", "tk_co",
  "so_tien", "but_toan_dao", "ref_type", "ref_id",
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
  const clean = String(csv || "").replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    RAW_HEADERS.forEach((key, i) => { row[key] = values[i] ?? ""; });
    return row;
  });
}

const toNumber = (value) => {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function normalizeRows(csv) {
  return parseLedgerCsv(csv).map((row) => ({
    id: row.id,
    occurredAt: toDate(row.ngay_phat_sinh),
    eventLabel: row.loai_su_kien,
    description: row.dien_giai,
    debitAccount: row.tk_no,
    creditAccount: row.tk_co,
    amount: toNumber(row.so_tien),
    reversalOf: row.but_toan_dao,
  }));
}

/** Diễn giải hiển thị: loại sự kiện + mô tả, và nói rõ khi là bút toán đảo. */
function describe(item) {
  const parts = [];
  if (item.eventLabel) parts.push(item.eventLabel);
  if (item.description) parts.push(item.description);
  const text = parts.join(" — ") || "(không có diễn giải)";
  return item.reversalOf ? `${text}  [đảo bút toán #${item.reversalOf}]` : text;
}

function drawTableHead(ws, startRow) {
  const r1 = startRow;
  const r2 = startRow + 1;
  const r3 = startRow + 2;

  // Hàng 1–2: tiêu đề hai tầng. "Chứng từ" gộp 2 cột con, "Số phát sinh" gộp 2 cột con,
  // các cột còn lại gộp dọc qua hai hàng.
  const single = [1, 4, 5, 6, 7];
  single.forEach((c) => ws.mergeCells(r1, c, r2, c));
  ws.mergeCells(r1, 2, r1, 3);   // Chứng từ
  ws.mergeCells(r1, 8, r1, 9);   // Số phát sinh

  ws.getCell(r1, 1).value = COLUMNS[0].header;
  ws.getCell(r1, 2).value = "Chứng từ";
  ws.getCell(r2, 2).value = COLUMNS[1].header;
  ws.getCell(r2, 3).value = COLUMNS[2].header;
  ws.getCell(r1, 4).value = COLUMNS[3].header;
  ws.getCell(r1, 5).value = COLUMNS[4].header;
  ws.getCell(r1, 6).value = COLUMNS[5].header;
  ws.getCell(r1, 7).value = COLUMNS[6].header;
  ws.getCell(r1, 8).value = "Số phát sinh";
  ws.getCell(r2, 8).value = COLUMNS[7].header;
  ws.getCell(r2, 9).value = COLUMNS[8].header;

  [r1, r2].forEach((r) => {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= COL_COUNT; c += 1) {
      const cell = ws.getCell(r, c);
      cell.font = { bold: true, size: 10 };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = allBorders;
    }
  });

  // Hàng 3: ký hiệu cột (A, B, C, D, E, G, H, 1, 2) — phần của biểu mẫu chuẩn, dùng để
  // đối chiếu khi ai đó dẫn chiếu "cột H" trong biên bản kiểm tra.
  ws.getRow(r3).height = 14;
  COLUMNS.forEach((col, i) => {
    const cell = ws.getCell(r3, i + 1);
    cell.value = col.ordinal;
    cell.font = { italic: true, size: 9 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = allBorders;
  });

  return r3 + 1;
}

function writeLine(ws, rowIndex, values) {
  const row = ws.getRow(rowIndex);
  values.forEach((v, i) => { row.getCell(i + 1).value = v; });
  row.height = 18;
  COLUMNS.forEach((col, i) => {
    const cell = row.getCell(i + 1);
    cell.border = allBorders;
    cell.font = { size: 10 };
    cell.alignment = {
      vertical: "middle",
      horizontal: col.money ? "right" : i === 3 ? "left" : "center",
      wrapText: i === 3,
    };
    if (col.money && typeof cell.value === "number") cell.numFmt = MONEY_FORMAT;
    if (cell.value instanceof Date) cell.numFmt = DATE_FORMAT;
  });
  return row;
}

export async function exportLedgerCsvToExcel(csv, { from, to, company = {} } = {}) {
  const items = normalizeRows(csv);
  if (items.length === 0) throw new Error("Không có dữ liệu để xuất Excel.");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = company.company_name || APP_NAME;
  wb.created = new Date();

  const ws = wb.addWorksheet("S03a-DN", { views: [{ showGridLines: false }] });
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));

  let r = drawEntityHeader(ws, { company, form: TT200.NHAT_KY_CHUNG, colCount: COL_COUNT });

  const namKy = (() => {
    const d = toDate(from) || toDate(to);
    return d ? d.getFullYear() : new Date().getFullYear();
  })();

  r = drawFormTitle(ws, {
    title: "Sổ Nhật ký chung",
    period: `Năm: ${namKy}`,
    subtitle: from && to ? `Kỳ ghi sổ: từ ngày ${from} đến ngày ${to}` : null,
    unit: "đồng",
    colCount: COL_COUNT,
    startRow: r,
  });

  const headRow = r;
  r = drawTableHead(ws, r);
  const firstDataRow = r;

  let tongNo = 0;
  let tongCo = 0;

  items.forEach((item) => {
    const ngay = item.occurredAt;
    const dienGiai = describe(item);

    // Vế Nợ
    writeLine(ws, r, [ngay, item.id, ngay, dienGiai, "x", 1, item.debitAccount, item.amount, null]);
    r += 1;

    // Vế Có — chứng từ và diễn giải không lặp lại, đúng cách trình bày của sổ
    writeLine(ws, r, [null, null, null, "", "", 2, item.creditAccount, null, item.amount]);
    r += 1;

    tongNo += item.amount;
    tongCo += item.amount;
  });

  // Dòng cộng — tổng Nợ phải bằng tổng Có, đó là phép cân đối của cuốn sổ
  const totalRow = writeLine(ws, r, ["", "", "", "Cộng số phát sinh", "", "", "", tongNo, tongCo]);
  totalRow.eachCell((cell) => { cell.font = { bold: true, size: 10 }; });
  ws.mergeCells(r, 1, r, 7);
  ws.getCell(r, 1).value = "Cộng số phát sinh";
  ws.getCell(r, 1).alignment = { vertical: "middle", horizontal: "center" };
  ws.getCell(r, 1).font = { bold: true, size: 10 };
  r += 1;

  r = drawBookFooter(ws, {
    colCount: COL_COUNT,
    startRow: r,
    openedAt: from ? `ngày ${from}` : null,
  });

  drawSignatureBlock(ws, { colCount: COL_COUNT, startRow: r });

  // Sổ nhật ký thường dài nhiều trang: lặp lại tiêu đề bảng ở mọi trang, nếu không thì
  // từ trang 2 trở đi người đọc không biết cột nào là Nợ, cột nào là Có.
  setPrintLayout(ws, { landscape: true, headerRows: `${headRow}:${firstDataRow - 1}` });

  await downloadWorkbook(wb, `So Nhat ky chung_${from || "tu-ngay"}_${to || "den-ngay"}.xlsx`);
}
