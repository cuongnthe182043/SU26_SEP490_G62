const tripService = require('../services/tripService');

// GET /api/trips/pool
const getTripPool = async (req, res) => {
    try {
        const trips = await tripService.getTripPool(req.user.userId);
        res.json({ trips });
    } catch (err) {
        const status = err.message.includes('chưa được gán') ? 422 : 500;
        res.status(status).json({ error: err.message });
    }
};

// GET /api/trips/active
const getActiveTrip = async (req, res) => {
    try {
        const trip = await tripService.getActiveTrip(req.user.userId);
        res.json({ trip });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/trips/:id/claim  — :id là order_id
const claimTrip = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!orderId) return res.status(400).json({ error: 'Order ID không hợp lệ' });

        const trip = await tripService.claimTrip(orderId, req.user.userId);
        res.status(200).json({ message: 'Nhận đơn hàng thành công', trip });
    } catch (err) {
        const status = err.message.includes('đã được nhận') ? 409
            : err.message.includes('đang có') ? 422
            : 400;
        res.status(status).json({ error: err.message });
    }
};

// PATCH /api/trips/:id/status
const updateStatus = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        const { status } = req.body;
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });
        if (!status) return res.status(400).json({ error: 'Trạng thái không được để trống' });

        const trip = await tripService.updateStatus(tripId, req.user.userId, status);
        res.json({ message: 'Cập nhật trạng thái thành công', trip });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('không thể') ? 422
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/trips/:id/cancel-delivery
// Body: { reason: string }  — bắt buộc
// ARRIVED → CANCELLED, driver vẫn giữ chuyến để xác nhận đã trả hàng
const cancelDelivery = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        const { reason } = req.body;
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });
        if (!reason?.trim()) return res.status(400).json({ error: 'Lý do không thể giao hàng là bắt buộc' });

        const trip = await tripService.cancelDelivery(tripId, req.user.userId, reason);
        res.json({ message: 'Đã ghi nhận không thể giao hàng', trip });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('bắt buộc') ? 400
            : err.message.includes('khi đã đến') ? 422
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/trips/:id/release
// Body: { reason?: string }
// CLAIMED/PICKING → toàn bộ order về available (back to pool)
const releaseTrip = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        const { reason } = req.body;
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const result = await tripService.releaseTrip(tripId, req.user.userId, reason);
        res.json({ message: 'Đã hủy chuyến, đơn hàng trả về pool', ...result });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('Chỉ có thể') ? 422
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/trips/:id/complete  (multipart/form-data, fields: receipt, proof?)
const completeTrip = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const receiptUrl = req.files?.receipt?.[0]?.path ?? null;
        const proofUrl   = req.files?.proof?.[0]?.path   ?? null;

        const trip = await tripService.completeTrip(tripId, req.user.userId, receiptUrl, proofUrl);
        res.json({ message: 'Hoàn thành chuyến thành công', trip });
    } catch (err) {
        const code = err.message.includes('không có quyền') ? 403
            : err.message.includes('bắt buộc') ? 422
            : err.message.includes('"arrived"') ? 422
            : 400;
        res.status(code).json({ error: err.message });
    }
};

// GET /api/trips/stats
const getDriverStats = async (req, res) => {
    try {
        const stats = await tripService.getDriverStats(req.user.userId);
        res.json({ stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getTripPool,
    getActiveTrip,
    claimTrip,
    updateStatus,
    cancelDelivery,
    releaseTrip,
    completeTrip,
    getDriverStats,
};
