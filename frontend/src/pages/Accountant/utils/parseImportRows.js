import { money as fmtMoney } from "../../../utils/formatNumber";

// Backend nhận tối đa 1000 dòng một lượt (accountantOrderController.importOrders).
export const MAX_IMPORT_ROWS = 1000;
/**
 * Đọc file Excel đơn ngoài thành payload gửi lên API.
 *
 * Tách khỏi ImportExcelModal.jsx để test được: đây là chỗ quyết định doanh thu và công
 * nợ của từng dòng, mà trước đây nằm lẫn trong component React nên không có một test
 * nào — hai lỗi tiền bạc đã lọt qua vì thế (cước tăng bo bị chia thay vì nhân, và ô
 * "Số lượt" định dạng thập phân biến 1 thành 100 lượt).
 */

// Dấu hiệu nhận biết khối ký ở cuối biểu mẫu — những dòng này không phải dữ liệu.
// So sau khi đã bỏ dấu (stripVN) nên viết ở dạng không dấu.
const FOOTER_MARKERS = [
    "nguoi lap bieu", "nguoi ghi so", "ke toan truong", "giam doc",
    "(ky, ho ten", "ngay ", "so nay co", "ngay mo so",
];

export const PAYMENT_OPTIONS = ["CK công ty", "Tiền mặt - tài đã nộp", "Tiền mặt - tài đang giữ", "Khách nợ"];

export const PAYMENT_MAP = {
  "ck cong ty":             { payment_type: "bank_transfer", driver_payment_state: "company_received" },
  "tien mat - tai da nop":  { payment_type: "cash",          driver_payment_state: "driver_paid" },
  "tien mat - tai dang giu":{ payment_type: "cash",          driver_payment_state: "driver_holding" },
  "khach no":               { payment_type: "client_credit", driver_payment_state: "company_received" },
};

export const stripVN = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D")
  .toLowerCase().trim();

// Header template → key nội bộ (so khớp sau khi bỏ dấu + bỏ "(*)")
const HEADER_KEYS = [
  ["ngay chay",            "date"],
  ["bien so xe",           "plate"],
  ["ten tai xe",           "driver"],
  ["ten khach hang",       "customer_name"],
  ["sdt khach hang",       "customer_phone"],
  ["diem lay hang",        "pickup"],
  ["diem giao hang",       "delivery"],
  ["quang duong",          "distance"],
  ["so luot",              "runs"],
  ["ten hang",             "cargo_name"],
  ["cuoc xe",              "cargo_fee"],
  // Thu hộ (COD) — tiền hàng công ty thu hộ khách khi giao. KHÔNG phải doanh thu, không
  // cộng vào số khách phải trả; chỉ ghi nhận để đối chiếu và trả lại khách.
  ["thu ho",               "collect_on_behalf"],
  ["phi cau duong",        "toll"],
  ["phi do xe",            "parking"],
  ["xang dau",             "fuel"],
  ["sua xe",               "repair"],
  ["thanh toan",           "payment"],
  ["tien tai dang giu",    "holding"],
  ["ghi chu",              "notes"],
];
// Cách kế toán ghi "không có" trong ô tiền — coi như bỏ trống.
const BLANK_MONEY = new Set(["", "-", "--", "–", "—", "n/a", "na", "khong", "không"]);

// Số tiền viết tay hợp lệ: "1500000", "1.500.000", "1,500,000", "1 500 000", có thể kèm
// đuôi đ/vnd và dấu âm/ngoặc kế toán. KHÔNG nhận phần thập phân (tiền Việt tính tới đồng).
const MONEY_TEXT_RE = /^\(?-?\s*(\d{1,3}([.,\s]\d{3})+|\d+)\s*(đ|d|vnd|vnđ)?\s*\)?$/i;

// Trả { value, negative, invalid }.
//   - negative: số âm phải BÁO LỖI chứ không được lặng lẽ đổi thành dương. Trước đây
//     "-500000" (gõ nhầm dấu, hoặc ô định dạng kế toán hiện số âm trong ngoặc) bị biến
//     thành +500000 và ghi thẳng vào doanh thu.
//   - invalid: ô có chữ / phần thập phân. Trước đây mọi ký tự không phải số bị lọc bỏ
//     nên "2tr" thành 2đ, "1.5tr" thành 15đ, "1,500,000.00" (ô để 2 chữ số thập phân)
//     thành 150.000.000đ — lọt thẳng vào doanh thu mà không lỗi nào báo ra.
export const parseMoneyCell = (v) => {
  const s = String(v ?? "").trim();
  if (BLANK_MONEY.has(s.toLowerCase())) return { value: 0, negative: false, invalid: false };
  if (!MONEY_TEXT_RE.test(s)) return { value: 0, negative: false, invalid: true };
  const value = Number(s.replace(/[^\d]/g, ""));
  const negative = value > 0 && (s.startsWith("-") || /^\(.*\)$/.test(s));
  return { value, negative, invalid: false };
};

const parseMoney = (v) => parseMoneyCell(v).value;

// Các cột tiền phụ cần kiểm tra dấu âm / ô không phải số (cước xe kiểm riêng vì còn phải > 0)
const MONEY_FIELD_LABELS = [
  ["toll", "Phí cầu đường/vé"],
  ["parking", "Phí đỗ xe/bãi"],
  ["fuel", "Xăng dầu"],
  ["repair", "Sửa xe"],
  ["holding", "Tiền tài đang giữ"],
  ["collect_on_behalf", "Thu hộ"],
];

/**
 * Số lượt tăng bo. Trả null nếu ô không đọc được thành số lượt hợp lệ.
 *
 * KHÔNG lọc chữ số kiểu replace(/[^\d]/g,'') như trước: ô định dạng "Number 2 chữ số
 * thập phân" hiển thị 1 thành "1.00", lọc chữ số ra "100" → âm thầm tách 1 chuyến
 * thành 100 chuyến. Ở đây giữ nguyên phần thập phân để phát hiện và từ chối.
 */
export const parseRuns = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return 1;                       // bỏ trống = 1 lượt
  const m = s.match(/\d+(?:[.,]\d+)?/);   // "x2c", "2 lượt" → 2
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  // Trần 50 khớp giới hạn "một đơn tối đa 50 chuyến" ở backend
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 50) return null;
  return n;
};

/**
 * Tiền tài đang giữ. Trả null nghĩa là "không điền" → công nợ rơi về mặc định
 * (đúng số khách phải trả).
 *
 * "0", "-", "n/a" đều là cách kế toán ghi "không có" nên coi như bỏ trống. Trước đây
 * chỉ cần ô có ký tự là tính như đã điền, nên gõ "0" hay "-" lại làm hỏng cả dòng.
 */
export const parseHoldingCell = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = parseMoney(s);
  return n > 0 ? n : null;
};

const parseKm = (v) => {
  const s = String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Đọc trực tiếp cell gốc (không qua sheet_to_json) để tránh SheetJS tự format lại
// text của ô kiểu "Date" theo bảng định dạng dựng sẵn (thiên về kiểu Mỹ m/d/yy),
// khiến chuỗi hiển thị khác với dd/mm/yyyy dù Excel vẫn hiện đúng dd/mm/yyyy.
const parseDateCell = (cell, XLSX) => {
  if (!cell) return null;

  if (cell.t === "n" && typeof cell.v === "number") {
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  if (cell.v instanceof Date && !Number.isNaN(cell.v.getTime())) {
    return `${cell.v.getUTCFullYear()}-${String(cell.v.getUTCMonth() + 1).padStart(2, "0")}-${String(cell.v.getUTCDate()).padStart(2, "0")}`;
  }

  const s = String(cell.w ?? cell.v ?? "").trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = (Number(y) < 70 ? "20" : "19") + y;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
};

// Hôm nay theo GIỜ MÁY người dùng, dạng YYYY-MM-DD để so chuỗi trực tiếp với dateIso.
// Không dùng toISOString() vì nó quy về UTC — từ 0h đến 7h sáng giờ VN sẽ ra ngày hôm qua
// và chặn oan đơn chạy trong ngày.
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// YYYY-MM-DD → dd/mm/yyyy, để thông báo lỗi và màn xem trước nói đúng thứ người Việt đọc.
export const viDate = (iso) => {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

// Tách nhiều điểm lấy/trả trong cùng 1 ô — phân cách bằng "|" hoặc xuống dòng (Alt+Enter)
const splitStops = (v) => String(v ?? "")
  .split(/\r?\n|\|/)
  .map((s) => s.trim())
  .filter(Boolean);

// Parse workbook → { rows: [{rowIndex, order, display}], errors: [string] }
export function parseWorkbook(wb, XLSX) {
  const sheetName = wb.SheetNames.includes("DON_HANG") ? "DON_HANG" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  if (raw.length < 2) return { rows: [], errors: ["File không có dữ liệu."] };

  // TÌM dòng tiêu đề thay vì mặc định là dòng 1.
  //
  // File báo cáo xuất ra nay mở đầu bằng khối định danh đơn vị (Đơn vị / Địa chỉ / Mã số
  // thuế) rồi mới tới tiêu đề cột — đó là khung bắt buộc của một biểu mẫu chính thức.
  // Đọc cứng raw[0] thì file vừa xuất ra không nhập ngược lại được nữa, mà đó lại là một
  // đường làm việc thật: kế toán xuất báo cáo, sửa vài dòng trong Excel, nhập lại.
  //
  // Quét 20 dòng đầu, lấy dòng khớp nhiều tên cột bắt buộc nhất. Cách này còn chịu được
  // cả trường hợp ai đó chèn thêm một dòng ghi chú phía trên bảng.
  const norm = (h) => stripVN(h).replace(/\(\*\)/g, "").trim();
  const matchCount = (cells) => {
    const cols = cells.map(norm);
    return HEADER_KEYS.filter(([prefix]) => cols.some((h) => h.startsWith(prefix))).length;
  };

  let headerAt = 0;
  let best = -1;
  for (let i = 0; i < Math.min(raw.length, 20); i += 1) {
    const n = matchCount(raw[i] ?? []);
    if (n > best) { best = n; headerAt = i; }
  }

  const headerRow = (raw[headerAt] ?? []).map(norm);
  const colIndex = {};
  for (const [prefix, key] of HEADER_KEYS) {
    const idx = headerRow.findIndex((h) => h.startsWith(prefix));
    if (idx >= 0) colIndex[key] = idx;
  }
  // Tên cột hiển thị cho kế toán — báo "thiếu: payment, cargo_fee" thì không ai hiểu.
  const REQUIRED_COLUMNS = {
    date: "Ngày chạy", plate: "Biển số xe", driver: "Tên tài xế", pickup: "Điểm lấy hàng",
    delivery: "Điểm giao hàng", cargo_fee: "Cước xe 1 lượt", payment: "Thanh toán",
  };
  const missing = Object.keys(REQUIRED_COLUMNS).filter((k) => colIndex[k] === undefined);
  if (missing.length) {
    return {
      rows: [],
      errors: [`File thiếu cột bắt buộc — hãy dùng đúng template. Thiếu: ${missing.map((k) => REQUIRED_COLUMNS[k]).join(", ")}`],
      skipped: [],
    };
  }

  const get = (r, key) => (colIndex[key] !== undefined ? r[colIndex[key]] : "");

  // Ô tiền đọc từ GIÁ TRỊ SỐ của ô khi ô là kiểu số, không đọc chuỗi hiển thị: ô định dạng
  // "#,##0.00" hiện 1.500.000 thành "1,500,000.00" — lọc chữ số trên chuỗi đó ra 150 triệu.
  const readMoney = (i, r, key) => {
    if (colIndex[key] === undefined) return { value: 0, negative: false, invalid: false };
    const cell = ws[XLSX.utils.encode_cell({ r: i, c: colIndex[key] })];
    if (cell && cell.t === "n" && typeof cell.v === "number") {
      if (!Number.isFinite(cell.v) || !Number.isInteger(cell.v)) return { value: 0, negative: false, invalid: true };
      return { value: Math.abs(cell.v), negative: cell.v < 0, invalid: false };
    }
    return parseMoneyCell(get(r, key));
  };

  // Cột "Giá chốt" đã BỎ khỏi template: giá thực tế nhập thẳng vào "Cước xe". File cũ vẫn
  // còn cột này — lặng lẽ bỏ qua thì dòng có chốt giá sẽ bị ghi doanh thu theo giá báo cũ
  // mà không ai biết. Nên dòng nào còn điền giá chốt thì báo lỗi, bảo chuyển sang Cước xe.
  const legacySettledIdx = headerRow.findIndex((h) => h.startsWith("gia chot"));

  // Cột dữ liệu CHUYẾN — dòng trống hết các cột này (chỉ còn số lượt, thanh toán chọn sẵn
  // từ dropdown, ghi chú...) là dòng thừa trong template: bỏ qua và báo số dòng, không
  // coi là lỗi. Coi là lỗi thì chỉ cần một ô "Số lượt = 1" kéo thừa xuống là CẢ FILE bị
  // chặn không import được.
  const TRIP_KEYS = ["date", "plate", "driver", "pickup", "delivery", "cargo_fee"];

  const rows = [];
  const errors = [];
  const skipped = [];

  for (let i = headerAt + 1; i < raw.length; i += 1) {
    const r = raw[i];
    if (!r || r.every((c) => String(c).trim() === "")) continue;
    // Dòng TỔNG CỘNG khép lại phần dữ liệu của file báo cáo xuất ra. DỪNG hẳn ở đây,
    // không chỉ bỏ qua một dòng: bên dưới nó còn khối ký (ngày tháng, "Người lập biểu",
    // "(Ký, họ tên)"...). Những dòng đó không rỗng nên vòng lặp cũ đọc chúng như một
    // chuyến và đẻ ra một loạt lỗi giả "thiếu biển số / thiếu tài xế".
    if (r.some((c) => stripVN(c) === "tong cong")) break;

    // Phòng trường hợp file bị xoá mất dòng tổng: nhận diện thẳng khối ký.
    if (r.some((c) => FOOTER_MARKERS.some((m) => stripVN(c).startsWith(m)))) continue;
    const rowNo = i + 1; // số dòng Excel (1-based, gồm header)
    if (TRIP_KEYS.every((k) => String(get(r, k)).trim() === "")) {
      skipped.push(rowNo);
      continue;
    }
    const rowErr = [];

    if (legacySettledIdx >= 0 && String(r[legacySettledIdx] ?? "").trim() !== "") {
      rowErr.push('Cột "Giá chốt" đã bỏ — nhập giá thực tế vào cột "Cước xe 1 lượt" rồi xoá ô giá chốt');
    }

    const dateCellAddr = XLSX.utils.encode_cell({ r: i, c: colIndex.date });
    const dateIso = parseDateCell(ws[dateCellAddr], XLSX);
    if (!dateIso) rowErr.push("Ngày chạy sai định dạng (cần dd/mm/yyyy)");
    else if (dateIso > todayIso()) {
      // Đơn ở đây là đơn ĐÃ HOÀN THÀNH nên ngày chạy không thể ở tương lai. Chặn tại đây
      // bắt được lỗi hay gặp nhất: ô ngày trong Excel đang để định dạng kiểu Mỹ (m/d/yy),
      // gõ "12/8" ra ngày 8 tháng 12 nhưng màn hình vẫn hiện "12/8/26" nên người nhập
      // tưởng là 12 tháng 8. Không chặn thì doanh thu rơi sang tháng 12, KPI và bảng lương
      // tháng hiện tại không thấy gì mà chẳng có lỗi nào báo ra.
      rowErr.push(
        `Ngày chạy ${viDate(dateIso)} ở tương lai — đơn đã hoàn thành không thể có ngày sau hôm nay. `
        + `Kiểm tra định dạng ô ngày trong Excel (phải là dd/mm/yyyy)`,
      );
    }

    const plate = String(get(r, "plate")).trim();
    if (!plate) rowErr.push("Thiếu biển số xe");
    const driver = String(get(r, "driver")).trim();
    if (!driver) rowErr.push("Thiếu tên tài xế");

    const pickups = splitStops(get(r, "pickup"));
    const deliveries = splitStops(get(r, "delivery"));
    if (pickups.length === 0) rowErr.push("Thiếu điểm lấy hàng");
    if (deliveries.length === 0) rowErr.push("Thiếu điểm giao hàng");

    const cargoFeeCell = readMoney(i, r, "cargo_fee");
    const cargoFee = cargoFeeCell.value;
    if (cargoFeeCell.invalid) rowErr.push(`Cước xe không phải số tiền hợp lệ: "${String(get(r, "cargo_fee")).trim()}"`);
    else if (cargoFeeCell.negative) rowErr.push("Cước xe không được âm");
    else if (cargoFee <= 0) rowErr.push("Cước xe phải lớn hơn 0");

    // Các cột tiền còn lại: âm hoặc không phải số là sai dữ liệu — không tự đổi dấu,
    // không tự lọc chữ ra thành một con số khác.
    const money = {};
    for (const [key, label] of MONEY_FIELD_LABELS) {
      const c = readMoney(i, r, key);
      if (c.invalid) rowErr.push(`${label} không phải số tiền hợp lệ: "${String(get(r, key)).trim()}"`);
      else if (c.negative) rowErr.push(`${label} không được âm`);
      money[key] = c.value;
    }

    const paymentRaw = String(get(r, "payment")).trim();
    const payment = PAYMENT_MAP[stripVN(paymentRaw)];
    if (!paymentRaw) rowErr.push('Thiếu cột "Thanh toán" (bắt buộc)');
    else if (!payment) {
      rowErr.push(
        `Giá trị Thanh toán không hợp lệ: "${paymentRaw}" — chỉ nhận: ${PAYMENT_OPTIONS.join(" / ")}`,
      );
    }

    const phone = String(get(r, "customer_phone")).replace(/[^\d]/g, "");
    if (phone && !/^0\d{9}$/.test(phone)) rowErr.push("SĐT khách không hợp lệ (10 số, bắt đầu bằng 0)");

    const runs = parseRuns(get(r, "runs"));
    if (runs == null) rowErr.push('Cột "Số lượt" phải là số nguyên từ 1 đến 50');

    // "0" / "-" / trống ở cột tiền tài giữ = không điền (cùng quy ước parseHoldingCell).
    const holding = money.holding > 0 ? money.holding : null;

    // Tiền tài giữ chỉ có nghĩa khi tài cầm tiền mặt. Điền kèm "CK công ty" / "Khách nợ"
    // thì backend bỏ qua ô này — kế toán tưởng đã ghi công nợ tài xế mà thật ra không có.
    if (holding != null && payment && !["driver_holding", "driver_paid"].includes(payment.driver_payment_state)) {
      rowErr.push(
        `Tiền tài đang giữ chỉ điền khi Thanh toán là "Tiền mặt - tài đang giữ" hoặc "Tiền mặt - tài đã nộp" `
        + `(đang là "${paymentRaw}") — xoá ô này hoặc sửa lại cột Thanh toán`,
      );
    }

    const { toll, parking, fuel, repair } = money;
    // Thu hộ (COD): tiền của KHÁCH mà công ty thu giúp rồi trả lại — ngược chiều với công
    // nợ cước nên KHÔNG cộng vào customerTotal và không đụng gì tới doanh thu.
    const collectOnBehalf = money.collect_on_behalf;

    // Khách phải trả = cước từng lượt × số lượt + phần chi hộ (cầu đường, bãi).
    // Xăng dầu / sửa xe là công ty chịu nên không nằm trong số khách trả.
    const runCount = runs ?? 1;
    const totalFee = cargoFee * runCount;
    const passThrough = toll + parking;
    const customerTotal = totalFee + passThrough;

    // Kiểm tra THẬT SỰ có ý nghĩa: tài không thể đang giữ nhiều hơn số khách đưa.
    // Trần gồm CẢ thu hộ: tài xế thu COD của người nhận thì cũng đang cầm số tiền đó, nên
    // giữ nhiều hơn cước là hợp lệ. Bỏ thu hộ ra khỏi trần sẽ chặn oan đúng những dòng có
    // COD — dòng mà cột thu hộ sinh ra để phục vụ.
    const holdingCeiling = customerTotal + collectOnBehalf;
    if (holding != null && cargoFee > 0 && runs != null && holding > holdingCeiling) {
      rowErr.push(
        `Tiền tài đang giữ (${fmtMoney(holding)}) lớn hơn số tiền tài có thể cầm `
        + `(${fmtMoney(holdingCeiling)} = cước ${fmtMoney(cargoFee)} × ${runCount} lượt`
        + `${passThrough > 0 ? ` + chi hộ ${fmtMoney(passThrough)}` : ""}`
        + `${collectOnBehalf > 0 ? ` + thu hộ ${fmtMoney(collectOnBehalf)}` : ""})`,
      );
    }

    if (rowErr.length) {
      errors.push(`Dòng ${rowNo}: ${rowErr.join("; ")}`);
      continue;
    }

    const distance = parseKm(get(r, "distance"));
    const notes = String(get(r, "notes")).trim() || null;
    const customerName = String(get(r, "customer_name")).trim() || null;

    // Tăng bo N lượt → N chuyến, MỖI chuyến mang trọn cước của 1 lượt (cột "Cước xe"
    // là giá một lượt, không phải tổng cả dòng).
    // Tiền tài đang giữ thì ngược lại — là tổng của cả dòng — nên chia đều cho N chuyến,
    // chuyến đầu nhận phần dư, để tổng công nợ tài xế đúng bằng số đã nhập.
    const holdingPerRun = holding == null ? null : Math.floor(holding / runCount);
    const holdingFirst = holding == null ? null : holding - holdingPerRun * (runCount - 1);

    const shipments = [];
    for (let run = 0; run < runCount; run += 1) {
      const isFirst = run === 0;
      // Chi phí là số tiền thực chi của cả dòng (theo chứng từ), không nhân theo lượt —
      // dồn vào chuyến đầu để không bị đếm N lần.
      const expenses = [];
      if (isFirst) {
        if (toll > 0)    expenses.push({ expense_type: "toll",    amount: toll });
        if (parking > 0) expenses.push({ expense_type: "parking", amount: parking });
        if (fuel > 0)    expenses.push({ expense_type: "fuel",    amount: fuel });
        if (repair > 0)  expenses.push({ expense_type: "repair",  amount: repair });
      }
      shipments.push({
        vehicle_plate: plate,
        driver_name: driver,
        pickup_addresses: pickups,
        delivery_addresses: deliveries,
        cargo_fee: cargoFee,
        cargo_name: String(get(r, "cargo_name")).trim() || null,
        distance_km: isFirst ? distance : null,
        // Thu hộ là số của CẢ DÒNG (giống chi phí, khác cước xe vốn tính theo lượt) — dồn
        // vào chuyến đầu để tăng bo N lượt không nhân số COD lên N lần.
        collect_on_behalf: isFirst ? collectOnBehalf : 0,
        expenses,
        payment_type: payment.payment_type,
        driver_payment_state: payment.driver_payment_state,
        driver_holding_amount: holding == null ? null : (isFirst ? holdingFirst : holdingPerRun),
        notes: runCount > 1 ? `${notes ? `${notes} | ` : ""}Tăng bo lượt ${run + 1}/${runCount}` : notes,
      });
    }

    rows.push({
      rowIndex: rowNo,
      display: {
        // Hiện ngày ĐÃ HIỂU ĐƯỢC (dd/mm/yyyy) chứ không phải chuỗi thô trong ô Excel.
        // Ô ngày kiểu Mỹ hiện "12/8/26" nhưng thực chất là 8 tháng 12 — chép nguyên chuỗi
        // thô ra màn xem trước thì kế toán không đời nào phát hiện được, còn hiện ngày đã
        // giải mã thì sai lệch lộ ra ngay trước khi bấm Import.
        date: viDate(dateIso) || get(r, "date"), plate, driver,
        // Chỉ gọi là "Khách lẻ" khi KHÔNG có cả tên lẫn SĐT. Dòng chỉ có SĐT vẫn định
        // danh được nên hiện SĐT, gọi là khách lẻ thì kế toán tưởng dòng bị mất khách.
        customer: customerName || phone || "Khách lẻ",
        pickups, deliveries,
        cargoFee, totalFee, holding, paymentRaw, runs: runCount,
      },
      order: {
        row_index: rowNo,
        customer_name: customerName,
        customer_phone: phone || null,
        order_date: get(r, "date"),
        completed_at: dateIso,
        prepaid_amount: 0,
        notes,
        shipments,
      },
    });
  }

  // Chặn ở đây để kế toán biết trước, thay vì chọn file, đối chiếu xong, bấm Import rồi
  // mới ăn một lỗi chung cho cả file từ backend.
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.unshift(`File có ${rows.length} dòng — mỗi lần import tối đa ${MAX_IMPORT_ROWS} dòng. Tách file thành nhiều phần rồi import lần lượt.`);
  }
  // Có tiêu đề mà không có dòng nào đọc được: trước đây trả về rỗng cả hai, màn hình
  // không hiện gì và nút Import cứ mờ — kế toán không biết vì sao.
  if (rows.length === 0 && errors.length === 0) {
    errors.push('File không có dòng dữ liệu chuyến nào — kiểm tra đã nhập vào sheet DON_HANG, ngay dưới dòng tiêu đề chưa.');
  }

  return { rows, errors, skipped };
}
