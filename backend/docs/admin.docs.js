/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Quản trị hệ thống (Manager only)
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Danh sách tất cả users trong hệ thống
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng user accounts
 *       403:
 *         description: Không có quyền (chỉ Manager)
 *   post:
 *     tags: [Admin]
 *     summary: Tạo tài khoản user mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role_id]
 *             properties:
 *               email:    { type: string, example: newdriver@g62.vn }
 *               password: { type: string, example: "123456" }
 *               role_id:  { type: integer }
 *               full_name: { type: string }
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *       409:
 *         description: Email đã tồn tại
 */

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     tags: [Admin]
 *     summary: Cập nhật thông tin user
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
 *               full_name: { type: string }
 *               role_id:   { type: integer }
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy user
 */

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Kích hoạt / vô hiệu hoá tài khoản
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
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Cập nhật status thành công
 *       404:
 *         description: Không tìm thấy user
 */
