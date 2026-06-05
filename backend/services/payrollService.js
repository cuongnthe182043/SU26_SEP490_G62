const payrollRepository = require('../repositories/payrollRepository');

// ─── Payroll ─────────────────────────────────────────────────────────────────

const getMyPayrolls = async (driverId, { month, year } = {}) => {
    const m = month ? Number(month) : null;
    const y = year  ? Number(year)  : null;
    if (m && (m < 1 || m > 12)) throw new Error('Tháng không hợp lệ (1-12)');
    return payrollRepository.getDriverPayrolls(driverId, { month: m, year: y });
};

// ─── Salary Advance ───────────────────────────────────────────────────────────

// BR-029: Driver request → Manager approve → Accountant disburse
const requestSalaryAdvance = async (driverId, { amount, reason, requestMonth, requestYear }) => {
    if (!amount || Number(amount) <= 0) throw new Error('Số tiền phải lớn hơn 0');
    const m = Number(requestMonth);
    const y = Number(requestYear);
    if (!m || m < 1 || m > 12) throw new Error('Tháng không hợp lệ (1-12)');
    if (!y || y < 2020)        throw new Error('Năm không hợp lệ');

    return payrollRepository.createSalaryAdvance({
        driverId,
        amount: Number(amount),
        reason: reason?.trim() ?? null,
        requestMonth: m,
        requestYear:  y,
    });
};

const getMyAdvances = async (driverId, { status } = {}) => {
    return payrollRepository.getDriverAdvances(driverId, { status });
};

module.exports = { getMyPayrolls, requestSalaryAdvance, getMyAdvances };
