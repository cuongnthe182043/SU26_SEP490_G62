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

// POST /api/trips/:id/claim
const claimTrip = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const trip = await tripService.claimTrip(tripId, req.user.userId);
        res.status(200).json({ message: 'Nhận chuyến thành công', trip });
    } catch (err) {
        const status = err.message.includes('đã được nhận') ? 409
            : err.message.includes('đang có') ? 422
            : err.message.includes('không phù hợp') ? 403
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
        const status = err.message.includes('không có quyền') ? 403
            : err.message.includes('không thể') ? 422
            : 400;
        res.status(status).json({ error: err.message });
    }
};

// POST /api/trips/:id/complete  (multipart/form-data, field: proof)
const completeTrip = async (req, res) => {
    try {
        const tripId = Number(req.params.id);
        if (!tripId) return res.status(400).json({ error: 'Trip ID không hợp lệ' });

        const proofUrl = req.file?.path ?? null;

        const trip = await tripService.completeTrip(tripId, req.user.userId, proofUrl);
        res.json({ message: 'Hoàn thành chuyến thành công', trip });
    } catch (err) {
        const status = err.message.includes('không có quyền') ? 403
            : err.message.includes('bắt buộc') ? 422
            : err.message.includes('"arrived"') ? 422
            : 400;
        res.status(status).json({ error: err.message });
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
    completeTrip,
    getDriverStats,
};
