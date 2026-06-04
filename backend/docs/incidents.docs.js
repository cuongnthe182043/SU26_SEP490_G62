/**
 * @swagger
 * tags:
 *   name: Incidents
 *   description: Báo cáo sự cố trên đường (Driver) và xử lý (Coordinator)
 */

/**
 * @swagger
 * /api/incidents:
 *   post:
 *     tags: [Incidents]
 *     summary: Tạo báo cáo sự cố (tối đa 3 ảnh)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [trip_id, type, note]
 *             properties:
 *               trip_id:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [vehicle_issue, cargo_issue, road_issue, other]
 *               note:
 *                 type: string
 *                 example: Thủng lốp trên đường cao tốc
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Tạo sự cố thành công, coordinator được thông báo
 *       422:
 *         description: Dữ liệu không hợp lệ
 */

/**
 * @swagger
 * /api/incidents/my:
 *   get:
 *     tags: [Incidents]
 *     summary: Lịch sử sự cố của driver hiện tại
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách sự cố đã báo cáo
 */

/**
 * @swagger
 * /api/incidents/{id}:
 *   get:
 *     tags: [Incidents]
 *     summary: Chi tiết một sự cố
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết sự cố
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/incidents/{id}/status:
 *   patch:
 *     tags: [Incidents]
 *     summary: Cập nhật trạng thái sự cố và phản hồi (Coordinator only)
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
 *                 enum: [in_review, resolved]
 *               feedback:
 *                 type: string
 *                 example: Đã điều xe hỗ trợ
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền (chỉ Coordinator)
 */
