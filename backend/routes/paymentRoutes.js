const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/authMiddleware');

// All payment/finance routes are protected with JWT authentication
router.use(verifyToken);

// GET /finance/stats - Get overall financial statistics (revenue, receivables, paid)
router.get('/finance/stats', paymentController.getFinanceStats);

// GET /orders/:id/payments - Get payment details for a specific order
router.get('/orders/:id/payments', paymentController.getPayments);

// POST /orders/:id/payments - Add a new payment (cash receipt / bank transfer) for an order
router.post('/orders/:id/payments', paymentController.createPayment);

module.exports = router;
