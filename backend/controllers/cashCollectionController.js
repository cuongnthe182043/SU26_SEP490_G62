const cashCollectionService = require('../services/cashCollectionService');

// GET /api/cash-collections/me
const getMyCollections = async (req, res) => {
    try {
        const { status, shipmentId, month, year } = req.query;
        const data = await cashCollectionService.getMyCollections(req.user.userId, {
            status:     status     ?? null,
            shipmentId: shipmentId ? Number(shipmentId) : null,
            month:      month      ? Number(month)      : null,
            year:       year       ? Number(year)       : null,
        });
        res.json({ collections: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cash-collections/summary
const getSummary = async (req, res) => {
    try {
        const data = await cashCollectionService.getSummary(req.user.userId);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// GET /api/cash-collections/:id
const getMyCollection = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ error: 'ID không hợp lệ' });
        const data = await cashCollectionService.getMyCollection(req.user.userId, id);
        res.json({ collection: data });
    } catch (err) {
        const code = err.message.includes('Không tìm thấy') ? 404 : 500;
        res.status(code).json({ error: err.message });
    }
};

// POST /api/cash-collections
const createCollection = async (req, res) => {
    try {
        const { shipmentId, amount, paymentMethod, notes, receiptUrl } = req.body;
        if (!amount) return res.status(400).json({ error: 'Số tiền là bắt buộc' });
        const data = await cashCollectionService.createCollection(req.user.userId, {
            shipmentId, amount, paymentMethod, notes, receiptUrl,
        });
        res.status(201).json({
            message: 'Đã báo thu hộ. Đang chờ kế toán xác nhận.',
            collection: data,
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = { getMyCollections, getSummary, getMyCollection, createCollection };
