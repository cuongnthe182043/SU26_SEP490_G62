const paymentRepository = require('../repositories/paymentRepository');

/**
 * GET /orders/:id/payments
 * Fetch payment history for a specific order
 */
const getPayments = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Mã đơn hàng không hợp lệ' });
        }

        const payments = await paymentRepository.getPaymentsByOrderId(orderId);
        res.json(payments);
    } catch (err) {
        console.error('Error fetching payments:', err);
        res.status(500).json({ error: 'Không thể tải lịch sử thanh toán', details: err.message });
    }
};

/**
 * POST /orders/:id/payments
 * Record a new payment (receipt voucher) for an order
 */
const createPayment = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (isNaN(orderId)) {
            return res.status(400).json({ error: 'Mã đơn hàng không hợp lệ' });
        }

        const { amount, paymentMethod, notes } = req.body;
        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Số tiền thanh toán phải lớn hơn 0' });
        }

        const createdBy = req.user.userId; // Resolved from JWT verifyToken middleware

        const result = await paymentRepository.recordPayment(orderId, {
            amount,
            paymentMethod,
            notes,
            createdBy
        });

        res.status(201).json({
            message: 'Ghi nhận thanh toán thành công',
            payment: result.payment,
            newPaidAmount: result.newPaidAmount,
            newStatus: result.newStatus
        });
    } catch (err) {
        console.error('Error recording payment:', err);
        res.status(500).json({ error: err.message || 'Lỗi hệ thống khi ghi nhận thanh toán' });
    }
};

/**
 * GET /finance/stats
 * Get overall financial stats for Accountant dashboard
 */
const getFinanceStats = async (req, res) => {
    try {
        const stats = await paymentRepository.getFinanceStats();
        res.json(stats);
    } catch (err) {
        console.error('Error fetching finance stats:', err);
        res.status(500).json({ error: 'Không thể tải số liệu thống kê tài chính', details: err.message });
    }
};

module.exports = {
    getPayments,
    createPayment,
    getFinanceStats
};
