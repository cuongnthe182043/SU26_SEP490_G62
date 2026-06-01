const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const { uploadAvatar } = require('../middleware/uploadMiddleware');
const profileController = require('../controllers/profileController');

/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Hồ sơ cá nhân (tất cả role)
 */

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

router.use(verifyToken);

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Lấy hồ sơ cá nhân
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Hồ sơ đầy đủ
 *       404:
 *         description: Không tìm thấy hồ sơ
 */
router.get('/me', profileController.getMyProfile);

/**
 * @swagger
 * /api/profile/me:
 *   patch:
 *     tags: [Profile]
 *     summary: Cập nhật hồ sơ (không thể đổi email)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               full_name: { type: string }
 *               phone:     { type: string }
 *               dob:       { type: string, format: date, example: "1995-06-15" }
 *               gender:    { type: string, enum: [male, female, other] }
 *               address:   { type: string }
 *               city:      { type: string }
 *               country:   { type: string, example: VN }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       409:
 *         description: Số điện thoại đã tồn tại
 *       422:
 *         description: Dữ liệu không hợp lệ
 */
router.patch('/me', profileController.updateMyProfile);

/**
 * @swagger
 * /api/profile/me/avatar:
 *   post:
 *     tags: [Profile]
 *     summary: Upload ảnh đại diện
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL ảnh mới
 *       422:
 *         description: Thiếu file ảnh
 */
router.post('/me/avatar', handleUpload(uploadAvatar.single('avatar')), profileController.updateAvatar);

module.exports = router;
