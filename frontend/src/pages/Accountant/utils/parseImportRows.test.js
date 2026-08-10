import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";

import { parseWorkbook, parseRuns, parseHoldingCell } from "./parseImportRows";

/**
 * Đây là chỗ quyết định doanh thu và công nợ của từng dòng Excel. Trước đây không có
 * test nào và đã lọt hai lỗi tiền bạc: cước tăng bo bị CHIA thay vì NHÂN (doanh thu
 * còn một nửa), và ô "Số lượt" định dạng thập phân biến 1 lượt thành 100 lượt.
 */

const HEADERS = [
  "Ngày chạy (*)", "Biển số xe (*)", "Tên tài xế (*)", "Tên khách hàng", "SĐT khách hàng",
  "Điểm lấy hàng (*)", "Điểm giao hàng (*)", "Quãng đường (km)", "Số lượt (tăng bo)", "Tên hàng",
  "Cước xe 1 lượt (đ) (*)", "Giá chốt 1 lượt (đ)", "Thu hộ (đ)", "Phí cầu đường/vé (đ)", "Phí đỗ xe/bãi (đ)",
  "Xăng dầu (đ)", "Sửa xe (đ)", "Thanh toán (*)", "Tiền tài đang giữ (đ)", "Ghi chú",
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
    250000, "", "", "", "", "", "", "Tiền mặt - tài đang giữ", "", ""];
  for (const [i, v] of Object.entries(o)) r[Number(i)] = v;
  return r;
};

const FEE_COL = 10, SETTLED = 11, COH = 12, SO_LUOT = 8, GIU = 18, TOLL = 13, PAY = 17;

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
    expect(errors[0]).toMatch(/lớn hơn số khách phải trả/);
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

describe("Giá chốt — sửa giá sau khi thống nhất lại", () => {
  it("để trống thì giá chốt = giá báo, hành vi y như cũ", () => {
    const { rows } = readSheet(makeRow());
    expect(rows[0].order.shipments[0].cargo_fee).toBe(250000);
    expect(rows[0].order.shipments[0].settled_fee).toBeNull();
  });

  it("chốt CAO hơn giá báo: doanh thu và công nợ theo giá chốt", () => {
    const { rows, errors } = readSheet(makeRow({ [FEE_COL]: 1000000, [SETTLED]: 1200000, [GIU]: 1200000 }));
    expect(errors).toEqual([]);
    const s = rows[0].order.shipments[0];
    expect(s.cargo_fee).toBe(1000000);      // giá báo giữ nguyên để đối chiếu
    expect(s.settled_fee).toBe(1200000);    // giá chốt → actual_price
    expect(s.driver_holding_amount).toBe(1200000);
  });

  it("chốt THẤP hơn giá báo cũng được (giảm giá khách quen)", () => {
    const { rows, errors } = readSheet(makeRow({ [FEE_COL]: 1000000, [SETTLED]: 800000, [GIU]: 800000 }));
    expect(errors).toEqual([]);
    expect(rows[0].order.shipments[0].settled_fee).toBe(800000);
  });

  it("kiểm tra tiền tài giữ so với GIÁ CHỐT chứ không phải giá báo", () => {
    // Đúng tình huống thật: báo 1tr, chốt 1tr2, tài cầm 1tr2 → phải cho qua
    expect(readSheet(makeRow({ [FEE_COL]: 1000000, [SETTLED]: 1200000, [GIU]: 1200000 })).errors).toEqual([]);
    // Cầm quá cả giá chốt thì vẫn chặn
    const { errors } = readSheet(makeRow({ [FEE_COL]: 1000000, [SETTLED]: 1200000, [GIU]: 1500000 }));
    expect(errors[0]).toMatch(/giá chốt 1.200.000/);
  });

  it("giá chốt âm bị từ chối", () => {
    const { errors } = readSheet(makeRow({ [SETTLED]: "-500000" }));
    expect(errors[0]).toMatch(/Giá chốt không được âm/);
  });

  it("tăng bo: giá chốt cũng là giá MỘT lượt", () => {
    const { rows } = readSheet(makeRow({ [FEE_COL]: 1000000, [SETTLED]: 1200000, [SO_LUOT]: 2 }));
    const ships = rows[0].order.shipments;
    expect(ships).toHaveLength(2);
    expect(ships.every((x) => x.settled_fee === 1200000)).toBe(true);
    expect(rows[0].display.totalFee).toBe(2400000);
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
      250000, "", "", "", "", "", "Tiền mặt - tài đang giữ", "", ""];
    const { rows, errors } = readSheetWith(HEADERS_CU, [rowCu]);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].order.shipments[0].cargo_fee).toBe(250000);
    expect(rows[0].order.shipments[0].collect_on_behalf).toBe(0);
  });
});
