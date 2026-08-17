/**
 * Import đơn ngoài — ô "Ngày chạy".
 *
 * Sự cố có thật: file Excel để cột ngày ở định dạng kiểu Mỹ (m/d/yy). Kế toán gõ "12/8"
 * định là 12 tháng 8, Excel hiểu thành 8 THÁNG 12 và lưu serial 46364, nhưng ô vẫn hiện
 * "12/8/26" nên không ai nhận ra. Import chạy trót lọt, doanh thu 11.900.000 rơi vào KPI
 * tháng 12 — bảng lương tháng 8 không thấy gì mà chẳng có lỗi nào báo ra.
 *
 * Parser đọc serial là ĐÚNG (không đoán định dạng). Cái thiếu là lưới an toàn: đơn đã
 * hoàn thành thì ngày chạy không thể ở tương lai, và màn xem trước phải hiện ngày ĐÃ HIỂU
 * ĐƯỢC thay vì chép lại chuỗi thô trong ô.
 */
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../../src/pages/Accountant/utils/parseImportRows';

const HEADERS = [
  'Ngày chạy (*)', 'Biển số xe (*)', 'Tên tài xế (*)', 'Tên khách hàng', 'SĐT khách hàng',
  'Điểm lấy hàng (*)', 'Điểm giao hàng (*)', 'Quãng đường (km)', 'Số lượt (tăng bo)', 'Tên hàng',
  'Cước xe 1 lượt (đ) (*)', 'Giá chốt 1 lượt (đ)', 'Thu hộ (đ)', 'Phí cầu đường/vé (đ)', 'Phí đỗ xe/bãi (đ)',
  'Xăng dầu (đ)', 'Sửa xe (đ)', 'Thanh toán (*)', 'Tiền tài đang giữ (đ)', 'Ghi chú',
];

// Số serial Excel của một ngày (hệ 1900, khớp XLSX.SSF.parse_date_code)
const serial = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);

const buildWorkbook = (dateSerial) => {
  const row = [
    dateSerial, '51C-123.45', 'Phạm Văn Tiền', 'Cương', '0965529916',
    'Hòa Bình', 'Chiến Thăng', 30, 1, 'Hàng khô',
    1000000, '', '', '', '', '', '', 'CK công ty', '', '',
  ];
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, row]);
  // Ô ngày phải là kiểu số (t='n') đúng như file thật, không phải chuỗi
  ws.A2 = { t: 'n', v: dateSerial, w: '12/8/26' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DON_HANG');
  return wb;
};

const daysFromToday = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return serial(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

describe('parseImportRows — ngày chạy', () => {
  it('chặn ngày ở tương lai: đơn đã hoàn thành không thể chạy ngày mai', () => {
    const { rows, errors } = parseWorkbook(buildWorkbook(daysFromToday(30)), XLSX);

    expect(rows).toHaveLength(0);
    expect(errors.join(' ')).toMatch(/tương lai/i);
    // Thông báo phải chỉ thẳng vào định dạng ô Excel — đó mới là chỗ người dùng sửa được
    expect(errors.join(' ')).toMatch(/dd\/mm\/yyyy/);
  });

  it('ngày hôm nay vẫn nhận bình thường (không chặn oan chuyến chạy trong ngày)', () => {
    const { rows, errors } = parseWorkbook(buildWorkbook(daysFromToday(0)), XLSX);

    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it('màn xem trước hiện ngày ĐÃ HIỂU ĐƯỢC (dd/mm/yyyy), không chép lại chuỗi thô của ô', () => {
    // Serial 46022 = 2026-01-01. Ô hiển thị "12/8/26" (kiểu Mỹ) nhưng giá trị thật khác hẳn —
    // xem trước phải nói đúng giá trị thật thì kế toán mới phát hiện được sai lệch.
    const { rows } = parseWorkbook(buildWorkbook(serial(2026, 1, 1)), XLSX);

    expect(rows).toHaveLength(1);
    expect(rows[0].display.date).toBe('01/01/2026');
    expect(rows[0].order.completed_at).toBe('2026-01-01');
  });
});
