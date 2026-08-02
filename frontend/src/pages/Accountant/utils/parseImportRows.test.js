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
  "Cước xe 1 lượt (đ) (*)", "Phí cầu đường/vé (đ)", "Phí đỗ xe/bãi (đ)", "Xăng dầu (đ)", "Sửa xe (đ)",
  "Thanh toán (*)", "Tiền tài đang giữ (đ)", "Ghi chú",
];

/** Dựng workbook từ các dòng dữ liệu thô rồi chạy qua đúng parser thật */
const readSheet = (...rows) => {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DON_HANG");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return parseWorkbook(XLSX.read(buf, { type: "buffer" }), XLSX);
};

/** Dòng chuẩn; truyền object để ghi đè từng ô theo chỉ số cột */
const makeRow = (o = {}) => {
  const r = ["22/07/2026", "29H-961.45", "Toàn", "", "", "Kho A", "Kho B", "", "", "",
    250000, "", "", "", "", "Tiền mặt - tài đang giữ", "", ""];
  for (const [i, v] of Object.entries(o)) r[Number(i)] = v;
  return r;
};

const FEE_COL = 10, SO_LUOT = 8, GIU = 16, TOLL = 11;

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
    const { errors } = readSheet(makeRow({ 15: "Chưa chốt phiếu thu" }));
    expect(errors[0]).toMatch(/chỉ nhận: CK công ty/);
  });

  it("dòng TỔNG CỘNG của file báo cáo xuất ra bị bỏ qua", () => {
    const totalRow = new Array(18).fill("");
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
