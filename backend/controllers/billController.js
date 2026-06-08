const billService = require('../services/billService');

// GET /api/bills/me
const getMyBills = async (req, res) => {
    try {
        const { status, shipmentId, month, year } = req.query;
        const data = await billService.getMyBills(req.user.userId, {
            status:     status     ?? null,
            shipmentId: shipmentId ? Number(shipmentId) : null,
            month:      month      ? Number(month)      : null,
            year:       year       ? Number(year)       : null,
        });
        res.json({ bills: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/bills/summary
const getSummary = async (req, res) => {
    try {
        const data = await billService.getSummary(req.user.userId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/bills/:id
const getMyBill = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });
        const data = await billService.getMyBill(req.user.userId, id);
        res.json({ bill: data });
    } catch (err) {
        const code = err.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/bills  (multipart/form-data: receipt file + body: shipmentId, amount, paymentMethod, notes)
const createBill = async (req, res) => {
    try {
        const { shipmentId, amount, paymentMethod, notes } = req.body;
        const receiptUrl = req.file?.path ?? null;

        if (!shipmentId) return res.status(400).json({ error: 'Mã chuyến (shipmentId) là bắt buộc' });
        if (!amount)     return res.status(400).json({ error: 'Số tiền là bắt buộc' });
        if (!receiptUrl) return res.status(400).json({ error: 'Ảnh biên lai là bắt buộc' });

        const data = await billService.createBill(req.user.userId, {
            shipmentId: Number(shipmentId),
            amount,
            paymentMethod,
            notes,
            receiptUrl,
        });
        res.status(201).json({
            message: 'Đã tạo bill. Đang chờ kế toán xác nhận.',
            bill: data,
        });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('không tồn tại') ? 404
            : 400;
        res.status(code).json({ error: err.message });
    }
};

module.exports = { getMyBills, getSummary, getMyBill, createBill };
