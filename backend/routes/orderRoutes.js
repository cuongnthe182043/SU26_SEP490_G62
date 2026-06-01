const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middleware/authMiddleware');

// All order routes are protected with JWT authentication
router.use(verifyToken);

// GET /orders - Retrieve all orders (supports status & search filters)
router.get('/', orderController.getOrders);

// POST /orders - Create a manual order
router.post('/', orderController.createOrder);

// POST /orders/import - Bulk import orders
router.post('/import', orderController.importOrders);

module.exports = router;
