const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadProof } = require('../middleware/uploadMiddleware');
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
router.get('/stats', driverOnly, tripController.getDriverStats);

router.get('/pool', driverOnly, tripController.getTripPool);

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
 *                 enum: [picking, loaded, transit, arrived, failed, returning, cancelled]
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
 *     summary: Hoàn thành chuyến (bắt buộc ảnh proof nếu là chuyến cuối của order)
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
 *         description: Thiếu ảnh proof (chuyến cuối) hoặc sai trạng thái
 */
router.post(
    '/:id/complete',
    driverOnly,
    handleUpload(uploadProof.single('proof')),
    tripController.completeTrip,
);

module.exports = router;
