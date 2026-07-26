const express = require('express');
const multer  = require('multer');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadPaymentReceipt } = require('../middleware/uploadMiddleware');
const orderController = require('../controllers/orderController');
const tripController  = require('../controllers/tripController');

// Kế toán + Điều phối đều được xác nhận tiền trả trước (theo quyết định nghiệp vụ)
const coordinatorOnly = [verifyToken, requireRole('coordinator', 'manager', 'admin')];
const prepaidConfirmRoles = [verifyToken, requireRole('coordinator', 'manager', 'admin', 'accountant')];
const driverOnly      = [verifyToken, requireRole('driver')];

// File Excel chỉ cần đọc buffer để parse — không lưu Cloudinary như ảnh
const uploadExcel = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Driver routes ─────────────────────────────────────────────────────────────
router.post('/:id/request-receipt', driverOnly, tripController.requestOrderReceipt);
router.get('/:id/receipt-request', driverOnly, tripController.getOrderReceiptRequest);

// ── Coordinator / Manager / Admin routes ──────────────────────────────────────
router.get('/customer-by-phone', coordinatorOnly, orderController.customerByPhone);
router.get('/',                  coordinatorOnly, orderController.listOrders);
router.post('/',                 coordinatorOnly, orderController.createOrder);
router.patch('/:id',             coordinatorOnly, orderController.updateOrder);
router.delete('/:id',            coordinatorOnly, orderController.cancelOrder);
router.post('/import',           coordinatorOnly, uploadExcel.single('file'), orderController.importOrders);

// ── Tiền trả trước: xác nhận / từ chối ────────────────────────────────────────
router.get   ('/prepaid/pending',        prepaidConfirmRoles, orderController.listPendingPrepaid);
router.patch ('/:id/prepaid/confirm',    prepaidConfirmRoles, uploadPaymentReceipt.single('proof'), orderController.confirmPrepaid);
router.patch ('/:id/prepaid/reject',     prepaidConfirmRoles, orderController.rejectPrepaid);

module.exports = router;
