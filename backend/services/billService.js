const repo = require('../repositories/billRepository');

const VALID_METHODS = ['cash', 'bank_transfer'];

const getMyBills = async (driverId, filters = {}) => {
    return repo.getDriverBills(driverId, filters);
};

const getMyBill = async (driverId, id) => {
    const bill = await repo.getBillById(id, driverId);
    if (!bill) throw new Error('Không tìm thấy bill');
    return bill;
};

const createBill = async (driverId, { shipmentId, amount, paymentMethod = 'cash', notes, receiptUrl }) => {
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    if (!VALID_METHODS.includes(paymentMethod)) throw new Error('Hình thức thanh toán không hợp lệ');
    return repo.createBill(driverId, {
        shipmentId: shipmentId ? Number(shipmentId) : null,
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
