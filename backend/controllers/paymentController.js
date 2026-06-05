const paymentService = require('../services/paymentService');

// POST /api/trips/:id/payment  (multipart/form-data: receipt file + body: amount, notes)
const recordCashPayment = async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);
        if (!shipmentId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const receiptUrl =
            req.files?.receipt?.[0]?.path ??
            req.files?.image?.[0]?.path   ??
            req.files?.photo?.[0]?.path   ??
            req.file?.path ??
            null;
        const { amount, notes } = req.body;

        if (!amount) return res.status(400).json({ error: 'Số tiền là bắt buộc' });

        const result = await paymentService.recordDriverCashPayment(
            req.user.userId, shipmentId, { amount, notes }, receiptUrl,
        );
        res.status(201).json({ message: 'Ghi nhận thanh toán thành công', ...result });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('bắt buộc') ? 422
            : err.message.includes('không tồn tại') ? 404
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// GET /api/trips/:id/payments
const getShipmentPayments = async (req, res) => {
    try {
        const shipmentId = Number(req.params.id);
        if (!shipmentId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const payments = await paymentService.getShipmentPayments(shipmentId, req.user.userId);
        res.json({ payments });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403 : 500;
        res.status(code).json({ error: err.message });
    }
};

module.exports = { recordCashPayment, getShipmentPayments };
