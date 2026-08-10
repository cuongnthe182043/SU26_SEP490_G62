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

const normalizeText = (v) => String(v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Biển số: bỏ mọi ký tự không phải chữ/số — khớp với cách tra xe ở repository
const normalizePlate = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const normalizeAmount = (v) => String(Math.round(Number(v ?? 0)));

const normalizeStops = (list) => (Array.isArray(list) ? list : [list])
    .map((d) => normalizeText(d))
    .filter(Boolean)
    .join('>');

const normalizeExpenses = (expenses = []) => (Array.isArray(expenses) ? expenses : [])
    .map((e) => `${normalizeText(e.expense_type)}:${normalizeAmount(e.amount)}`)
    .sort()
    .join(',');

const normalizeShipment = (s = {}) => {
    const parts = [
        normalizePlate(s.vehicle_plate),
        normalizeText(s.driver_name),
        normalizeStops(s.pickup_addresses),
        normalizeStops(s.delivery_addresses ?? s.delivery_address),
        normalizeAmount(s.cargo_fee),
        s.settled_fee != null ? normalizeAmount(s.settled_fee) : '',
        normalizeText(s.cargo_name),
        s.distance_km != null ? normalizeAmount(s.distance_km) : '',
        normalizeText(s.payment_type),
        normalizeText(s.driver_payment_state),
        s.driver_holding_amount != null ? normalizeAmount(s.driver_holding_amount) : '',
        normalizeExpenses(s.expenses),
    ];

    // Thu hộ CHỈ được nối thêm khi khác 0 — cố ý không thêm ô trống vào chuỗi.
    //
    // Nếu nối vô điều kiện thì mọi dòng cũ (không có cột thu hộ) cũng đổi vân tay, và file
    // đã import trước đây gửi lại sẽ KHÔNG còn bị nhận ra là trùng — đúng cái tai nạn nhân
    // đôi doanh thu/công nợ mà cơ chế này sinh ra để chặn.
    //
    // Ngược lại, bỏ hẳn thu hộ khỏi vân tay thì hai chuyến giống nhau mọi mặt trừ số COD sẽ
    // ra cùng vân tay và chuyến thứ hai bị từ chối oan — chuyến chạy tuyến quen, cùng ngày,
    // cùng cước, chỉ khác tiền hàng thu hộ là chuyện thường.
    const coh = Number(s.collect_on_behalf ?? 0);
    if (Number.isFinite(coh) && coh > 0) parts.push(`coh:${normalizeAmount(coh)}`);

    return parts.join('|');
};

/**
 * @param {object} order payload một dòng Excel (như gửi lên /accountant/orders/import)
 * @returns {string} chuỗi hex SHA-256
 */
const buildImportFingerprint = (order = {}) => {
    const parts = [
        normalizeText(order.completed_at || order.order_date),
        normalizeText(order.customer_phone),
        normalizeText(order.customer_name),
        normalizeAmount(order.prepaid_amount),
        ...(order.shipments || []).map(normalizeShipment),
    ].join('||');

    return crypto.createHash('sha256').update(parts, 'utf8').digest('hex');
};

module.exports = { buildImportFingerprint };
