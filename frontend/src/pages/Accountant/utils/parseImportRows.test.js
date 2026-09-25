import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

import { parseWorkbook, parseRuns, parseHoldingCell, parseMoneyCell, MAX_IMPORT_ROWS } from "./parseImportRows";

/**
 * Đây là chỗ quyết định doanh thu và công nợ của từng dòng Excel. Trước đây không có
 * test nào và đã lọt hai lỗi tiền bạc: cước tăng bo bị CHIA thay vì NHÂN (doanh thu
 * còn một nửa), và ô "Số lượt" định dạng thập phân biến 1 lượt thành 100 lượt.
 */

const HEADERS = [
  "Ngày chạy (*)", "Biển số xe (*)", "Tên tài xế (*)", "Tên khách hàng", "SĐT khách hàng",
  "Điểm lấy hàng (*)", "Điểm giao hàng (*)", "Quãng đường (km)", "Số lượt (tăng bo)", "Tên hàng",
  "Cước xe 1 lượt (đ) (*)", "Thu hộ (đ)", "Phí cầu đường/vé (đ)", "Phí đỗ xe/bãi (đ)",
  "Xăng dầu (đ)", "Sửa xe (đ)", "Thanh toán (*)", "Tiền tài đang giữ (đ)", "Ghi chú",
];

// Header của template TRƯỚC khi bỏ cột "Giá chốt" — kế toán còn lưu file này trên máy.
const HEADERS_GIA_CHOT = [
  ...HEADERS.slice(0, 11), "Giá chốt 1 lượt (đ)", ...HEADERS.slice(11),
];

// Header của file CŨ — không có cột "Thu hộ". Dùng để chốt rằng file kế toán đang lưu
// trên máy vẫn import được sau khi thêm cột mới.
const HEADERS_CU = HEADERS.filter((h) => h !== "Thu hộ (đ)");

/** Dựng workbook từ các dòng dữ liệu thô rồi chạy qua đúng parser thật */
const readSheetWith = (headers, rows) => {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DON_HANG");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return parseWorkbook(XLSX.read(buf, { type: "buffer" }), XLSX);
};
const readSheet = (...rows) => readSheetWith(HEADERS, rows);

/** Dòng chuẩn; truyền object để ghi đè từng ô theo chỉ số cột */
const makeRow = (o = {}) => {
  const r = ["22/07/2026", "29H-961.45", "Toàn", "", "", "Kho A", "Kho B", "", "", "",
    250000, "", "", "", "", "", "Tiền mặt - tài đang giữ", "", ""];
  for (const [i, v] of Object.entries(o)) r[Number(i)] = v;
  return r;
};

const FEE_COL = 10, COH = 11, SO_LUOT = 8, GIU = 17, TOLL = 12, PAY = 16, NOTES = 18;

describe("parseRuns — số lượt", () => {
  it("ô trống là 1 lượt", () => expect(parseRuns("")).toBe(1));
  it("số nguyên bình thường", () => expect(parseRuns("2")).toBe(2));

  // Đây là lỗi đã từng có: replace(/[^\d]/g,'') biến "1.00" thành "100"
  it('ô định dạng thập phân "1.00" vẫn là 1 lượt, KHÔNG phải 100', () => {
    expect(parseRuns("1.00")).toBe(1);
    expect(parseRuns("2.00")).toBe(2);
    expect(parseRuns("2,0")).toBe(2);
  });

  it("lấy được số trong chữ", () => expect(parseRuns("x2c")).toBe(2));
  it("số lẻ không phải số lượt hợp lệ", () => expect(parseRuns("2.5")).toBeNull());
  it("vượt trần 50 chuyến/đơn thì từ chối", () => expect(parseRuns("51")).toBeNull());
  it("chữ không có số thì từ chối", () => expect(parseRuns("abc")).toBeNull());
});

describe("parseHoldingCell — tiền tài đang giữ", () => {
  it("trống = không điền", () => expect(parseHoldingCell("")).toBeNull());
  it("số tiền bình thường", () => expect(parseHoldingCell("500,000 đ")).toBe(500000));

  // Đây là lỗi đã từng có: chỉ cần ô có ký tự là tính như đã điền
  it('"0" và "-" là cách ghi "không có", phải coi như bỏ trống', () => {
    expect(parseHoldingCell("0")).toBeNull();
    expect(parseHoldingCell("-")).toBeNull();
    expect(parseHoldingCell("n/a")).toBeNull();
  });
});

describe("Cước xe là giá MỘT lượt", () => {
  it("2 lượt × 250.000 → 2 chuyến, mỗi chuyến 250.000 (tổng 500.000)", () => {
    const { rows, errors } = readSheet(makeRow({ [SO_LUOT]: 2 }));
    expect(errors).toEqual([]);
    const ships = rows[0].order.shipments;
    expect(ships).toHaveLength(2);
    expect(ships.map((s) => s.cargo_fee)).toEqual([250000, 250000]);
    expect(ships.reduce((s, x) => s + x.cargo_fee, 0)).toBe(500000);
  });

  it("1 lượt thì giữ nguyên 1 chuyến", () => {
    const { rows } = readSheet(makeRow());
    expect(rows[0].order.shipments).toHaveLength(1);
    expect(rows[0].order.shipments[0].cargo_fee).toBe(250000);
  });

  it("xem trước hiển thị TỔNG chứ không phải giá 1 lượt", () => {
    const { rows } = readSheet(makeRow({ [SO_LUOT]: 3 }));
    expect(rows[0].display.cargoFee).toBe(250000);
    expect(rows[0].display.totalFee).toBe(750000);
  });
});

describe("Tiền tài đang giữ trên dòng tăng bo", () => {
  // Chính là dòng thật đã báo lỗi oan: 2 lượt × 250k, tài giữ đúng 500k
  it("dòng 2 lượt kèm tiền tài giữ được chấp nhận, không còn báo lỗi", () => {
    const { rows, errors } = readSheet(makeRow({ [SO_LUOT]: 2, [GIU]: 500000 }));
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("tiền tài giữ chia đều cho các chuyến, tổng đúng bằng số đã nhập", () => {
    const { rows } = readSheet(makeRow({ [SO_LUOT]: 2, [GIU]: 500000 }));
    const held = rows[0].order.shipments.map((s) => s.driver_holding_amount);
    expect(held).toEqual([250000, 250000]);
    expect(held.reduce((a, b) => a + b, 0)).toBe(500000);
  });

  it("số lẻ không chia hết thì chuyến đầu nhận phần dư, tổng vẫn khớp", () => {
    const { rows } = readSheet(makeRow({ [SO_LUOT]: 3, [GIU]: 500000 }));
    const held = rows[0].order.shipments.map((s) => s.driver_holding_amount);
    expect(held.reduce((a, b) => a + b, 0)).toBe(500000);
    expect(held[0]).toBe(166668);
  });

  it("không điền thì để null, công nợ rơi về mặc định", () => {
    const { rows } = readSheet(makeRow({ [SO_LUOT]: 2 }));
    expect(rows[0].order.shipments.every((s) => s.driver_holding_amount === null)).toBe(true);
  });
});

describe("Kiểm tra tiền tài giữ vượt số khách phải trả", () => {
  it("giữ nhiều hơn tổng cước thì báo lỗi", () => {
    const { errors } = readSheet(makeRow({ [SO_LUOT]: 2, [GIU]: 900000 }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/lớn hơn số tiền tài có thể cầm/);
  });

  it("giữ đúng bằng tổng cước thì hợp lệ", () => {
    const { errors } = readSheet(makeRow({ [SO_LUOT]: 2, [GIU]: 500000 }));
    expect(errors).toEqual([]);
  });

  it("phí chi hộ (cầu đường) được cộng vào số khách phải trả", () => {
    // cước 250k × 2 = 500k, cầu đường 30k → khách trả 530k, tài giữ 530k là hợp lệ
    const { errors } = readSheet(makeRow({ [SO_LUOT]: 2, [TOLL]: 30000, [GIU]: 530000 }));
    expect(errors).toEqual([]);
  });
});

describe("Các kiểm tra sẵn có không bị hỏng", () => {
  it("cước âm bị từ chối", () => {
    const { errors } = readSheet(makeRow({ [FEE_COL]: "-250000" }));
    expect(errors[0]).toMatch(/Cước xe không được âm/);
  });

  it("thanh toán sai giá trị thì liệt kê giá trị hợp lệ", () => {
    const { errors } = readSheet(makeRow({ [PAY]: "Chưa chốt phiếu thu" }));
    expect(errors[0]).toMatch(/chỉ nhận: CK công ty/);
  });

  it("dòng TỔNG CỘNG của file báo cáo xuất ra bị bỏ qua", () => {
    const totalRow = new Array(19).fill("");
    totalRow[0] = "TỔNG CỘNG";
    const { rows, errors } = readSheet(makeRow(), totalRow);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("số lượt sai định dạng thì báo lỗi thay vì tách nhầm 100 chuyến", () => {
    const { errors } = readSheet(makeRow({ [SO_LUOT]: "2.5" }));
    expect(errors[0]).toMatch(/Số lượt/);
  });
});

describe("Bỏ cột Giá chốt — giá thực tế nhập thẳng vào Cước xe", () => {
  it("payload không còn settled_fee; doanh thu tính theo Cước xe", () => {
    const { rows, errors } = readSheet(makeRow({ [FEE_COL]: 1200000, [GIU]: 1200000 }));
    expect(errors).toEqual([]);
    const s = rows[0].order.shipments[0];
    expect(s).not.toHaveProperty("settled_fee");
    expect(s.cargo_fee).toBe(1200000);
    expect(s.driver_holding_amount).toBe(1200000);
  });

  // File cũ còn cột Giá chốt: lặng lẽ bỏ qua thì doanh thu bị ghi theo giá báo cũ
  it("file CŨ có điền Giá chốt → báo lỗi, bảo chuyển sang cột Cước xe", () => {
    const rowCu = [...makeRow({ [FEE_COL]: 1000000 }).slice(0, 11), 1200000, ...makeRow().slice(11)];
    const { rows, errors } = readSheetWith(HEADERS_GIA_CHOT, [rowCu]);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/Cột "Giá chốt" đã bỏ/);
  });

  it("file CŨ có cột Giá chốt nhưng để trống → import bình thường", () => {
    const rowCu = [...makeRow().slice(0, 11), "", ...makeRow().slice(11)];
    const { rows, errors } = readSheetWith(HEADERS_GIA_CHOT, [rowCu]);
    expect(errors).toEqual([]);
    expect(rows[0].order.shipments[0].cargo_fee).toBe(250000);
  });
});

describe("parseMoneyCell — ô tiền viết tay", () => {
  it("nhận các cách viết số tiền bình thường", () => {
    expect(parseMoneyCell("1500000").value).toBe(1500000);
    expect(parseMoneyCell("1.500.000").value).toBe(1500000);
    expect(parseMoneyCell("1,500,000").value).toBe(1500000);
    expect(parseMoneyCell("1 500 000 đ").value).toBe(1500000);
    expect(parseMoneyCell("500000 VND").value).toBe(500000);
  });

  it('"-", "n/a", trống là không có — không phải lỗi', () => {
    for (const v of ["", "-", "n/a", "không"]) {
      expect(parseMoneyCell(v)).toEqual({ value: 0, negative: false, invalid: false });
    }
  });

  // Trước đây mọi ký tự không phải số bị lọc bỏ: "2tr" thành 2đ, "1.5tr" thành 15đ
  it("viết tắt / có chữ / có phần lẻ → invalid, KHÔNG đoán ra một con số", () => {
    for (const v of ["2tr", "1.5tr", "1,500,000.00", "12.5", "abc", "1tr2"]) {
      expect(parseMoneyCell(v).invalid).toBe(true);
    }
  });

  it("số âm và ngoặc kế toán vẫn nhận ra là âm", () => {
    expect(parseMoneyCell("-500000").negative).toBe(true);
    expect(parseMoneyCell("(500.000)").negative).toBe(true);
  });
});

describe("Dữ liệu bất thường", () => {
  it('cước viết "2tr" bị báo lỗi thay vì ghi doanh thu 2đ', () => {
    const { rows, errors } = readSheet(makeRow({ [FEE_COL]: "2tr" }));
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/Cước xe không phải số tiền hợp lệ: "2tr"/);
  });

  it("phí cầu đường có chữ bị báo lỗi thay vì lặng lẽ thành 0", () => {
    const { errors } = readSheet(makeRow({ [TOLL]: "ba mươi nghìn" }));
    expect(errors[0]).toMatch(/Phí cầu đường\/vé không phải số tiền hợp lệ/);
  });

  // Ô KIỂU SỐ định dạng 2 chữ số thập phân hiện "1,500,000.00" — đọc chuỗi hiển thị rồi
  // lọc chữ số sẽ ra 150 triệu. Phải đọc giá trị số của ô.
  it("ô kiểu số định dạng #,##0.00 vẫn đọc đúng 1.500.000", () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADERS, makeRow({ [FEE_COL]: 1500000 })]);
    ws[XLSX.utils.encode_cell({ r: 1, c: FEE_COL })].z = "#,##0.00";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DON_HANG");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const { rows, errors } = parseWorkbook(XLSX.read(buf, { type: "buffer" }), XLSX);
    expect(errors).toEqual([]);
    expect(rows[0].order.shipments[0].cargo_fee).toBe(1500000);
  });

  it("ô kiểu số có phần lẻ (1.500.000,5đ) bị báo lỗi", () => {
    const { errors } = readSheet(makeRow({ [FEE_COL]: 1500000.5 }));
    expect(errors[0]).toMatch(/Cước xe không phải số tiền hợp lệ/);
  });

  it("dòng trống ở GIỮA file bị bỏ qua, số dòng báo lỗi phía sau vẫn đúng", () => {
    const blank = new Array(HEADERS.length).fill("");
    const { rows, errors } = readSheet(makeRow(), blank, makeRow({ [FEE_COL]: "-1" }));
    expect(rows).toHaveLength(1);
    expect(errors).toEqual([expect.stringMatching(/^Dòng 4:/)]);
  });

  // Ô Số lượt / Thanh toán kéo thừa xuống dưới: trước đây báo "thiếu biển số, thiếu tài
  // xế..." cho từng dòng và chặn CẢ FILE.
  it("dòng chỉ còn Số lượt / Thanh toán / Ghi chú (thiếu mọi cột chuyến) được bỏ qua và liệt kê", () => {
    const thua = new Array(HEADERS.length).fill("");
    thua[SO_LUOT] = 1;
    thua[PAY] = "CK công ty";
    thua[NOTES] = "x";
    const { rows, errors, skipped } = readSheet(makeRow(), thua, thua);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(skipped).toEqual([3, 4]);
  });

  it("dòng có dữ liệu chuyến nhưng thiếu cột bắt buộc vẫn báo lỗi đủ các cột thiếu", () => {
    const { errors } = readSheet(makeRow({ 1: "", 2: "", 5: "" }));
    expect(errors[0]).toMatch(/Thiếu biển số xe; Thiếu tên tài xế; Thiếu điểm lấy hàng/);
  });

  it("file chỉ có tiêu đề + dòng trống → báo không có dữ liệu, không im lặng", () => {
    const blank = new Array(HEADERS.length).fill("");
    const { rows, errors } = readSheet(blank, blank);
    expect(rows).toHaveLength(0);
    expect(errors[0]).toMatch(/không có dòng dữ liệu chuyến nào/);
  });

  it("file thiếu cột bắt buộc → báo tên cột thiếu", () => {
    const { errors } = readSheetWith(HEADERS.filter((h) => !h.startsWith("Thanh toán")), [makeRow()]);
    expect(errors[0]).toMatch(/Thiếu: Thanh toán$/);
  });

  it("tiền tài giữ điền kèm \"CK công ty\" → báo lỗi thay vì bị backend lặng lẽ bỏ qua", () => {
    const { errors } = readSheet(makeRow({ [PAY]: "CK công ty", [GIU]: 250000 }));
    expect(errors[0]).toMatch(/Tiền tài đang giữ chỉ điền khi Thanh toán là/);
  });

  it(`vượt ${MAX_IMPORT_ROWS} dòng → báo trước, không đợi backend từ chối cả file`, () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => makeRow());
    const { errors } = readSheet(...many);
    expect(errors[0]).toMatch(/tối đa 1000 dòng/);
  });
});

/**
 * Thu hộ (COD) — tiền HÀNG công ty thu hộ khách khi giao. Là tiền CỦA KHÁCH công ty đang
 * giữ, ngược chiều với công nợ cước: không phải doanh thu, không cộng vào số khách phải trả.
 */
describe("Thu hộ (COD)", () => {
  it("đọc được số thu hộ và KHÔNG cộng vào tiền khách phải trả", () => {
    const { rows, errors } = readSheet(makeRow({ [FEE_COL]: 2000000, [COH]: 15000000, [PAY]: "CK công ty" }));
    expect(errors).toEqual([]);

    const ship = rows[0].order.shipments[0];
    expect(ship.collect_on_behalf).toBe(15000000);
    // Cước vẫn là cước — thu hộ không được lẫn vào doanh thu
    expect(ship.cargo_fee).toBe(2000000);
    expect(rows[0].display.totalFee).toBe(2000000);
  });

  it("thu hộ âm bị từ chối, không lặng lẽ đổi dấu", () => {
    const { errors } = readSheet(makeRow({ [COH]: "-500000" }));
    expect(errors[0]).toMatch(/Thu hộ không được âm/);
  });

  it("tài xế cầm cả cước lẫn thu hộ vẫn hợp lệ", () => {
    // Trần "tiền tài đang giữ" phải gồm cả COD, nếu không sẽ chặn oan đúng dòng có thu hộ
    const { errors } = readSheet(makeRow({
      [FEE_COL]: 2000000, [COH]: 15000000, [GIU]: 17000000, [PAY]: "Tiền mặt - tài đang giữ",
    }));
    expect(errors).toEqual([]);
  });

  it("cầm quá cả cước lẫn thu hộ thì vẫn chặn", () => {
    const { errors } = readSheet(makeRow({
      [FEE_COL]: 2000000, [COH]: 15000000, [GIU]: 20000000, [PAY]: "Tiền mặt - tài đang giữ",
    }));
    expect(errors[0]).toMatch(/thu hộ 15.000.000/);
  });

  it("tăng bo: thu hộ là số của CẢ DÒNG, chỉ ghi vào chuyến đầu", () => {
    const { rows } = readSheet(makeRow({ [FEE_COL]: 300000, [COH]: 5000000, [SO_LUOT]: 3, [PAY]: "CK công ty" }));
    const ships = rows[0].order.shipments;
    expect(ships).toHaveLength(3);
    expect(ships.map((s) => s.collect_on_behalf)).toEqual([5000000, 0, 0]);
    // Tổng thu hộ của đơn đúng bằng số đã nhập, không nhân lên 3 lần
    expect(ships.reduce((t, s) => t + s.collect_on_behalf, 0)).toBe(5000000);
  });

  it("ô trống thì thu hộ = 0", () => {
    const { rows } = readSheet(makeRow());
    expect(rows[0].order.shipments[0].collect_on_behalf).toBe(0);
  });

  // File kế toán đang lưu trên máy không có cột này — thêm cột mới không được làm hỏng
  it("file CŨ không có cột Thu hộ vẫn import bình thường", () => {
    const rowCu = ["22/07/2026", "29H-961.45", "Toàn", "", "", "Kho A", "Kho B", "", "", "",
      250000, "", "", "", "", "Tiền mặt - tài đang giữ", "", ""];
    const { rows, errors } = readSheetWith(HEADERS_CU, [rowCu]);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].order.shipments[0].cargo_fee).toBe(250000);
    expect(rows[0].order.shipments[0].collect_on_behalf).toBe(0);
  });
});
