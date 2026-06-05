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

// POST /api/debts/:id/remit
// Body: { amount, paymentMethod, notes }
const remitDebt = async (req, res) => {
    try {
        const debtId = Number(req.params.id);
        if (!debtId) return res.status(400).json({ error: 'Debt ID không hợp lệ' });

        const { amount, paymentMethod, notes } = req.body;
        if (!amount) return res.status(400).json({ error: 'Số tiền là bắt buộc' });

        const updated = await debtService.remitDebt(req.user.userId, debtId, { amount, paymentMethod, notes });
        res.json({ message: 'Nộp tiền thành công', debt: updated });
    } catch (err) {
        const code = err.message.includes('không thuộc về') ? 403
            : err.message.includes('vượt quá') ? 422
            : err.message.includes('đã thanh toán') ? 409
            : 400;
        res.status(code).json({ error: err.message });
    }
};

module.exports = { getMyDebts, getMyDebtSummary, remitDebt };
