const crypto = require('crypto');

/**
 * Vân tay của một dòng Excel đơn ngoài — dùng để chặn import lại cùng một dòng.
 *
 * Vì sao cần: import lại cùng một file (bấm nhầm hai lần, gửi lại sau khi request
 * timeout, tháng sau vô tình gửi lại file tháng trước) trước đây tạo lại toàn bộ đơn.
 * Doanh thu, KPI và công nợ đều nhân đôi, mà mọi dòng đều "hợp lệ" nên không ai
 * phát hiện ra cho tới lúc đối soát.
 *
 * Nguyên tắc tính:
 *   * Lấy TOÀN BỘ nội dung nghiệp vụ của dòng, không chỉ vài trường. Càng nhiều
 *     trường thì càng ít báo trùng oan — hai chuyến thật sự khác nhau ở bất cứ đâu
 *     (cước, phí, quãng đường, tên hàng) đều ra vân tay khác.
 *   * Chuẩn hoá trước khi băm: biển số bỏ dấu phân cách, tên gộp khoảng trắng, chữ
 *     thường hết. Cùng một dòng gõ lại hơi khác định dạng vẫn phải ra cùng vân tay.
 *   * BỎ QUA ghi chú: kế toán sửa ghi chú không biến nó thành chuyến khác.
 *   * Thứ tự điểm dừng và thứ tự chi phí được giữ/ sắp xếp ổn định để cùng dữ liệu
 *     luôn cho cùng kết quả.
 */

const chuan = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Biển số: bỏ mọi ký tự không phải chữ/số — khớp với cách tra xe ở repository
const chuanBienSo = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const chuanTien = (v) => String(Math.round(Number(v ?? 0)));

const chuanDiem = (list) => (Array.isArray(list) ? list : [list])
    .map((d) => chuan(d))
    .filter(Boolean)
    .join('>');

const chuanChiPhi = (expenses = []) => (Array.isArray(expenses) ? expenses : [])
    .map((e) => `${chuan(e.expense_type)}:${chuanTien(e.amount)}`)
    .sort()
    .join(',');

const chuanChuyen = (s = {}) => [
    chuanBienSo(s.vehicle_plate),
    chuan(s.driver_name),
    chuanDiem(s.pickup_addresses),
    chuanDiem(s.delivery_addresses ?? s.delivery_address),
    chuanTien(s.cargo_fee),
    chuan(s.cargo_name),
    s.distance_km != null ? chuanTien(s.distance_km) : '',
    chuan(s.payment_type),
    chuan(s.driver_payment_state),
    s.driver_holding_amount != null ? chuanTien(s.driver_holding_amount) : '',
    chuanChiPhi(s.expenses),
].join('|');

/**
 * @param {object} order payload một dòng Excel (như gửi lên /accountant/orders/import)
 * @returns {string} chuỗi hex SHA-256
 */
const taoVanTayImport = (order = {}) => {
    const phan = [
        chuan(order.completed_at || order.order_date),
        chuan(order.customer_phone),
        chuan(order.customer_name),
        chuanTien(order.prepaid_amount),
        ...(order.shipments || []).map(chuanChuyen),
    ].join('||');

    return crypto.createHash('sha256').update(phan, 'utf8').digest('hex');
};

module.exports = { taoVanTayImport };
