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
 *     summary: Đăng nhập bằng email / password
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
 *         description: JWT token + user info
 *       401:
 *         description: Sai email hoặc mật khẩu
 *       403:
 *         description: Tài khoản bị khoá
 */

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập bằng Google OAuth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential:
 *                 type: string
 *                 example: eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...
 *     responses:
 *       200:
 *         description: JWT token + user info
 *       403:
 *         description: Tài khoản Google chưa được cấp quyền trong hệ thống
 */

/**
 * @swagger
 * /auth/roles:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy danh sách roles
 *     responses:
 *       200:
 *         description: Mảng roles
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Thông tin user hiện tại (từ JWT)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user
 *       401:
 *         description: Token không hợp lệ hoặc hết hạn
 */
