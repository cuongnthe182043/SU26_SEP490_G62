const debtRepository = require('../repositories/debtRepository');

const getMyDebts = async (driverId, { status } = {}) => {
    return debtRepository.getDriverDebts(driverId, { status });
};

const getMyDebtSummary = async (driverId) => {
    return debtRepository.getDriverDebtSummary(driverId);
};

const getDebtPayments = async (driverId, debtId) => {
    return debtRepository.getDebtPayments(debtId, driverId);
};

// Driver báo nộp tiền — tạo bản ghi pending (BR-020: cho phép nộp nhiều lần)
// Kế toán xác nhận riêng → debt.paid_amount mới được cập nhật
const remitDebt = async (driverId, debtId, { amount, paymentMethod, notes }) => {
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    return debtRepository.remitDebt(debtId, driverId, {
        amount: Number(amount),
        paymentMethod,
        notes: notes?.trim() ?? null,
    });
};

module.exports = { getMyDebts, getMyDebtSummary, getDebtPayments, remitDebt };
