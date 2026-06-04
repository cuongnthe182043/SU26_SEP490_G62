const notificationService = require('../services/notificationService');

const listMyNotifications = async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const data = await notificationService.listForUser(req.user.userId, { page, limit });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const markAsRead = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!notificationId) return res.status(400).json({ error: 'Notification ID không hợp lệ' });

        const notification = await notificationService.markAsRead(req.user.userId, notificationId);
        if (!notification) return res.status(404).json({ error: 'Thông báo không tồn tại' });
        res.json({ notification });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await notificationService.markAllAsRead(req.user.userId);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getOne = async (req, res) => {
    try {
        const notificationId = Number(req.params.id);
        if (!notificationId) return res.status(400).json({ error: 'Notification ID không hợp lệ' });
        const notification = await notificationService.getById(req.user.userId, notificationId);
        if (!notification) return res.status(404).json({ error: 'Thông báo không tồn tại' });
        res.json({ notification });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    listMyNotifications,
    markAsRead,
    markAllAsRead,
    getOne,
};
