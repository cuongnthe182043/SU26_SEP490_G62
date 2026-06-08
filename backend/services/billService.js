const pool = require('../config/database');
const repo = require('../repositories/billRepository');

const VALID_METHODS = ['cash', 'bank_transfer'];
const BILL_ALLOWED_STATUSES = ['transit', 'arrived', 'completed'];

const getMyBills = async (driverId, filters = {}) => {
    return repo.getDriverBills(driverId, filters);
};

const getMyBill = async (driverId, id) => {
    const bill = await repo.getBillById(id, driverId);
    if (!bill) throw new Error('Không tìm thấy bill');
    return bill;
};

const createBill = async (driverId, { shipmentId, amount, paymentMethod = 'cash', notes, receiptUrl }) => {
    if (!shipmentId) throw new Error('Mã chuyến là bắt buộc');
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    if (!receiptUrl) throw new Error('Ảnh biên lai là bắt buộc');
    if (!VALID_METHODS.includes(paymentMethod)) throw new Error('Hình thức thanh toán không hợp lệ');

    // Kiểm tra shipment tồn tại và thuộc driver này
    const shipRes = await pool.query(
        `SELECT id, owner_driver_id, status FROM order_shipments WHERE id = $1`,
        [shipmentId],
    );
    const shipment = shipRes.rows[0];
    if (!shipment) throw new Error('Chuyến không tồn tại');
    if (Number(shipment.owner_driver_id) !== Number(driverId)) {
        throw new Error('Bạn không có quyền tạo bill cho chuyến này');
    }
    if (!BILL_ALLOWED_STATUSES.includes(shipment.status)) {
        throw new Error(`Chỉ có thể tạo bill khi chuyến đang ở trạng thái: ${BILL_ALLOWED_STATUSES.join(', ')}`);
    }

    return repo.createBill(driverId, {
        shipmentId: Number(shipmentId),
        amount: Number(amount),
        paymentMethod,
        notes,
        receiptUrl,
    });
};

const getSummary = async (driverId) => {
    return repo.getBillSummary(driverId);
};

module.exports = { getMyBills, getMyBill, createBill, getSummary };
