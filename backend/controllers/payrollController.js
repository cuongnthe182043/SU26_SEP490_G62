const payrollService = require('../services/payrollService');

// GET /api/payroll/me?month=6&year=2025
const getMyPayrolls = async (req, res) => {
    try {
        const { month, year } = req.query;
        const data = await payrollService.getMyPayrolls(req.user.userId, { month, year });
        res.json({ payrolls: data });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

// POST /api/payroll/advance
// Body: { amount, reason, requestMonth, requestYear }
const requestAdvance = async (req, res) => {
    try {
        const { amount, reason, requestMonth, requestYear } = req.body;
        if (!requestMonth || !requestYear) {
            return res.status(400).json({ error: 'Tháng và năm là bắt buộc' });
        }
        const advance = await payrollService.requestSalaryAdvance(req.user.userId, {
            amount, reason, requestMonth, requestYear,
        });
        res.status(201).json({ message: 'Yêu cầu ứng lương đã được gửi', advance });
    } catch (err) {
        const code = err.message.includes('đã có') ? 409 : 400;
        res.status(code).json({ error: err.message });
    }
};

// GET /api/payroll/advance?status=pending
const getMyAdvances = async (req, res) => {
    try {
        const { status } = req.query;
        const data = await payrollService.getMyAdvances(req.user.userId, { status });
        res.json({ advances: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/payroll/estimate?month=6&year=2026
const getEstimate = async (req, res) => {
    try {
        const { month, year } = req.query;
        const data = await payrollService.getPayrollEstimate(req.user.userId, { month, year });
        res.json(data);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { getMyPayrolls, requestAdvance, getMyAdvances, getEstimate };
