const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

router.use(verifyToken, requireRole('coordinator', 'admin'));

router.get('/', orderController.listOrders);
router.post('/', orderController.createOrder);

module.exports = router;
