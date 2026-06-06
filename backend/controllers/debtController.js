const debtService = require('../services/debtService');

// GET /api/debts/me?status=unpaid
const getMyDebts = async (req, res) => {
    try {
        const { status } = req.query;
        const data = await debtService.getMyDebts(req.user.userId, { status });
        res.json({ debts: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/debts/summary
const getMyDebtSummary = async (req, res) => {
    try {
        const data = await debtService.getMyDebtSummary(req.user.userId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/debts/:id/payments
const getDebtPayments = async (req, res) => {
    try {
        const debtId = Number(req.params.id);
        if (!debtId) return res.status(400).json({ error: 'Debt ID không hợp lệ' });
        const data = await debtService.getDebtPayments(req.user.userId, debtId);
        res.json({ payments: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getMyDebts, getMyDebtSummary, getDebtPayments };
