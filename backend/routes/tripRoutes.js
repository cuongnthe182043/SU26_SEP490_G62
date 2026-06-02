const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadTripComplete } = require('../middleware/uploadMiddleware');
const tripController = require('../controllers/tripController');

/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Quản lý chuyến vận chuyển (Driver)
 */

const driverOnly = [verifyToken, requireRole('driver')];

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

/**
 * @swagger
 * /api/trips/pool:
 *   get:
 *     tags: [Trips]
 *     summary: Danh sách chuyến có sẵn theo nhóm xe của driver
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng trips
 *       422:
 *         description: Driver chưa được gán xe
 */
/**
 * @swagger
 * /api/trips/stats:
 *   get:
 *     tags: [Trips]
 *     summary: Thống kê chuyến của driver (hôm nay + tháng này)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: today_total, today_completed, month_completed
 */
router.get('/stats',   driverOnly, tripController.getDriverStats);
router.get('/history', driverOnly, tripController.getOrderHistory);
router.get('/orders/:orderId', driverOnly, tripController.getOrderDetail);

router.get('/pool', driverOnly, tripController.getTripPool);
router.get('/pool/:orderId', driverOnly, tripController.getAvailableOrderDetail);

/**
 * @swagger
 * /api/trips/active:
 *   get:
 *     tags: [Trips]
 *     summary: Lấy chuyến đang hoạt động của driver
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trip hoặc null
 */
router.get('/active', driverOnly, tripController.getActiveTrip);

/**
 * @swagger
 * /api/trips/{id}/claim:
 *   post:
 *     tags: [Trips]
 *     summary: Nhận chuyến (atomic optimistic lock)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Nhận thành công
 *       409:
 *         description: Chuyến đã được nhận
 *       422:
 *         description: Driver đang có chuyến hoạt động
 */
router.post('/:id/claim', driverOnly, tripController.claimTrip);

/**
 * @swagger
 * /api/trips/{id}/status:
 *   patch:
 *     tags: [Trips]
 *     summary: Cập nhật trạng thái lifecycle (strict forward-only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [picking, loaded, transit, arrived, failed, returning]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       422:
 *         description: Transition không hợp lệ
 */
router.patch('/:id/status', driverOnly, tripController.updateStatus);

/**
 * @swagger
 * /api/trips/{id}/complete:
 *   post:
 *     tags: [Trips]
 *     summary: Hoàn thành chuyến (bắt buộc ảnh biên lai cho mọi trip)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               proof:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Hoàn thành thành công
 *       422:
 *         description: Thiếu ảnh proof hoặc sai trạng thái
 */
router.post(
    '/:id/complete',
    driverOnly,
    handleUpload(uploadTripComplete.fields([
        { name: 'receipt', maxCount: 1 },
        { name: 'proof',   maxCount: 1 },
    ])),
    tripController.completeTrip,
);

/**
 * @swagger
 * /api/trips/{id}/cancel-delivery:
 *   post:
 *     tags: [Trips]
 *     summary: Báo không thể giao hàng (ARRIVED → CANCELLED) — kèm lý do bắt buộc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Khách hàng không có mặt, không liên lạc được"
 *     responses:
 *       200:
 *         description: Đã ghi nhận, driver vẫn active để xác nhận trả hàng
 *       400:
 *         description: Thiếu lý do
 *       422:
 *         description: Sai trạng thái
 */
router.post('/:id/cancel-delivery', driverOnly, tripController.cancelDelivery);

/**
 * @swagger
 * /api/trips/{id}/release:
 *   post:
 *     tags: [Trips]
 *     summary: Hủy chuyến sớm (CLAIMED/PICKING → trả order về pool available)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Xe hỏng đột xuất"
 *     responses:
 *       200:
 *         description: Đã hủy, order về pool
 *       422:
 *         description: Không đủ điều kiện hủy chuyến
 */
router.post('/:id/release', driverOnly, tripController.releaseTrip);

module.exports = router;
