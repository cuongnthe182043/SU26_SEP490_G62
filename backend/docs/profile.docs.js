/**
 * @swagger
 * tags:
 *   name: Profile
 *   description: Hồ sơ cá nhân (tất cả role)
 */

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

/**
 * @swagger
 * /api/profile/me/avatar:
 *   post:
 *     tags: [Profile]
 *     summary: Upload ảnh đại diện
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
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
