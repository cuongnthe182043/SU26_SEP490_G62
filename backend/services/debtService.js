const debtRepository = require('../repositories/debtRepository');

const getMyDebts = async (driverId, { status } = {}) => {
    return debtRepository.getDriverDebts(driverId, { status });
};

const getMyDebtSummary = async (driverId) => {
    return debtRepository.getDriverDebtSummary(driverId);
};

// Driver tự nộp tiền về công ty (§16, BR-020: cho phép nộp nhiều lần)
const remitDebt = async (driverId, debtId, { amount, paymentMethod, notes }) => {
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    return debtRepository.remitDebt(debtId, driverId, {
        amount: Number(amount),
        paymentMethod,
        notes: notes?.trim() ?? null,
    });
};

module.exports = { getMyDebts, getMyDebtSummary, remitDebt };
