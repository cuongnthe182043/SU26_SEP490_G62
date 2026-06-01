const orderService = require('../services/orderService');

const listOrders = async (_req, res) => {
    try {
        const orders = await orderService.listOrders();
        res.json({ orders });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createOrder = async (req, res) => {
    try {
        const result = await orderService.createOrder(req.user.userId, req.body);
        res.status(201).json({
            message: 'Tạo đơn hàng thành công',
            ...result,
        });
    } catch (err) {
        const status = err.message.includes('Thiếu') ? 400 : 422;
        res.status(status).json({ error: err.message });
    }
};

module.exports = { createOrder, listOrders };
