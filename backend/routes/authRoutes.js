const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Xác thực tài khoản
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: driver@g62.vn
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về JWT token
 *       401:
 *         description: Sai email hoặc mật khẩu
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/roles:
 *   get:
 *     tags: [Auth]
 *     summary: Danh sách roles
 *     responses:
 *       200:
 *         description: Mảng roles
 */
router.get('/roles', authController.getAllRoles);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin user hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user
 *       401:
 *         description: Token không hợp lệ
 */
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;
