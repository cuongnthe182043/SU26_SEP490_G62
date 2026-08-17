// Taxonomy chi phí (chốt 2026-07):
//   Khách chi trả (pass-through — thu hộ/chi hộ, không phải doanh thu):
//     toll    — Phí cầu đường
//     parking — Phí đỗ xe / bến bãi
//     etc     — Phí ETC (thu phí không dừng)
//   Công ty chi trả:
//     fuel    — Xăng dầu / nhiên liệu
//     repair  — Sửa xe
const ALLOWED_EXPENSE_TYPES = ['toll', 'parking', 'etc', 'fuel', 'repair'];

const PASS_THROUGH_EXPENSE_TYPES = new Set(['toll', 'parking', 'etc']);

// Chuyến KHÔNG giao được hàng (hủy vì hàng hóa hư hại — cancelShipmentForCargoDamage,
// hoặc giao thất bại) thì MỌI chi phí của chuyến đó do DOANH NGHIỆP chịu, kể cả các loại
// vốn là chi hộ khách (toll/parking/etc).
//
// Vì sao: chi hộ chỉ đòi được khách khi có dịch vụ để đòi. Hàng hư hại thì chuyến không
// phát sinh doanh thu (computeReceiptAmount trả 0) — cộng thêm tiền cầu đường/bến bãi vào
// phiếu thu là bắt khách trả cho một chuyến vừa làm hỏng hàng của họ.
//
// Hệ quả kế toán bắt buộc đi kèm: khoản đó phải ghi Nợ 642 (chi phí DN) chứ KHÔNG phải
// Nợ 3388 (chi hộ - phải thu lại của khách). Ghi 3388 mà không bao giờ thu được thì số dư
// treo vĩnh viễn trên sổ. Tài xế vẫn được hoàn đủ tiền đã ứng — chỉ đổi bên chịu chi phí.
const COMPANY_BORNE_SHIPMENT_STATUSES = new Set(['cancelled', 'failed']);

const isCompanyBorneShipment = (shipmentStatus) =>
    COMPANY_BORNE_SHIPMENT_STATUSES.has(String(shipmentStatus || '').trim().toLowerCase());

// Khoản chi này có được cộng vào tiền khách phải trả trên phiếu thu không?
const isCustomerBillableExpense = (expenseType, shipmentStatus) =>
    PASS_THROUGH_EXPENSE_TYPES.has(String(expenseType || '').trim())
    && !isCompanyBorneShipment(shipmentStatus);

// Bản SQL của cùng quy tắc — dùng cho các báo cáo kế toán tổng hợp bằng câu truy vấn.
// Giữ CHUNG một chỗ với bản JS: hai bên lệch nhau thì màn Doanh thu hiện "khách còn nợ"
// một khoản mà phiếu thu không hề đòi, và số đó không bao giờ về 0.
const CUSTOMER_BILLABLE_EXPENSE_SQL = (expenseAlias = 'e', shipmentAlias = 'os') =>
    `${expenseAlias}.expense_type IN ('toll','parking','etc')`
    + ` AND ${shipmentAlias}.status NOT IN ('cancelled','failed')`;

// Khoản đã có phiếu chi hoàn ứng CÒN HIỆU LỰC (chờ duyệt / đã duyệt / đã chi) thì KHÔNG
// được hoàn thêm lần nữa qua lương hay cấn trừ nợ thu hộ.
//
// Vì sao cần: phiếu chi phải qua manager duyệt nên luôn có độ trễ. Trong lúc chờ duyệt,
// khoản đó vẫn mang reimbursement_status = 'pending' — kế toán chốt lương đúng lúc ấy là
// tài xế được hoàn LẦN HAI cho cùng một hoá đơn. Phiếu bị từ chối/huỷ không tính, khoản
// quay lại hàng chờ hoàn bình thường.
const NO_LIVE_REIMBURSEMENT_VOUCHER_SQL = (expenseAlias = 'e') =>
    `NOT EXISTS (
        SELECT 1 FROM payment_vouchers pv
        WHERE pv.expense_id = ${expenseAlias}.id
          AND pv.status IN ('pending', 'approved', 'paid')
    )`;

const EXPENSE_TYPE_LABEL = Object.freeze({
    toll:    'Phí cầu đường (khách chịu)',
    parking: 'Phí đỗ xe (khách chịu)',
    etc:     'Phí ETC (khách chịu)',
    fuel:    'Xăng dầu / nhiên liệu (công ty chịu)',
    repair:  'Sửa xe (công ty chịu)',
    // Giá trị hệ thống / dữ liệu cũ — không cho chọn mới, chỉ để hiển thị
    maintenance:  'Bảo dưỡng',
    depreciation: 'Khấu hao',
    other:        'Khác',
});

module.exports = {
    ALLOWED_EXPENSE_TYPES,
    PASS_THROUGH_EXPENSE_TYPES,
    EXPENSE_TYPE_LABEL,
    COMPANY_BORNE_SHIPMENT_STATUSES,
    isCompanyBorneShipment,
    isCustomerBillableExpense,
    CUSTOMER_BILLABLE_EXPENSE_SQL,
    NO_LIVE_REIMBURSEMENT_VOUCHER_SQL,
};
