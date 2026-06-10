const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadExcel } = require('../middleware/excelUploadMiddleware');
const orderController = require('../controllers/orderController');

router.use(verifyToken, requireRole('coordinator', 'admin'));

router.get('/', orderController.listOrders);
router.post('/import-excel', uploadExcel.single('file'), orderController.importOrders);
router.post('/', orderController.createOrder);
router.patch('/:id', orderController.updateOrder);
router.delete('/:id', orderController.cancelOrder);

module.exports = router;
