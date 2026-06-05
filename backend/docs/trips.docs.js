/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Quản lý chuyến vận chuyển (Driver)
 */

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
 *         description: Mảng trips AVAILABLE thuộc vehicle group của driver
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

/**
 * @swagger
 * /api/trips/history:
 *   get:
 *     tags: [Trips]
 *     summary: Lịch sử chuyến của driver (COMPLETED / CANCELLED / FAILED)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách chuyến đã kết thúc
 */

/**
 * @swagger
 * /api/trips/orders/{orderId}:
 *   get:
 *     tags: [Trips]
 *     summary: Chi tiết một order theo orderId
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết order
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/trips/pool-shipment/{shipmentId}:
 *   get:
 *     tags: [Trips]
 *     summary: Chi tiết shipment trong pool (chưa được claim)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết shipment
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/trips/pool/{orderId}:
 *   get:
 *     tags: [Trips]
 *     summary: Chi tiết order trong pool (chưa được claim)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết order
 *       404:
 *         description: Không tìm thấy
 */

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
 *         description: Trip đang active hoặc null nếu không có
 */

/**
 * @swagger
 * /api/trips/{id}/claim:
 *   post:
 *     tags: [Trips]
 *     summary: Nhận chuyến (atomic optimistic lock — first commit wins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Nhận chuyến thành công, trip chuyển sang CLAIMED
 *       409:
 *         description: Chuyến đã được tài xế khác nhận
 *       422:
 *         description: Driver đang có chuyến hoạt động hoặc không đúng nhóm xe
 */

/**
 * @swagger
 * /api/trips/{id}/status:
 *   patch:
 *     tags: [Trips]
 *     summary: Cập nhật trạng thái lifecycle (chỉ cho phép tiến về phía trước)
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
 *                 example: transit
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       422:
 *         description: Transition không hợp lệ (skip / reverse)
 */

/**
 * @swagger
 * /api/trips/{id}/complete:
 *   post:
 *     tags: [Trips]
 *     summary: Hoàn thành chuyến (bắt buộc ít nhất 1 ảnh proof)
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
 *                 description: Ảnh biên nhận giao hàng (camera only)
 *               receipt:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Hoàn thành, trip chuyển sang COMPLETED
 *       422:
 *         description: Thiếu ảnh proof hoặc trip không ở trạng thái ARRIVED
 */

/**
 * @swagger
 * /api/trips/{id}/cancel-delivery:
 *   post:
 *     tags: [Trips]
 *     summary: Báo không thể giao hàng (ARRIVED → CANCELLED) — cần lý do
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
 *                 example: Khách không có mặt, không liên lạc được
 *     responses:
 *       200:
 *         description: Đã ghi nhận, driver vẫn active để xác nhận trả hàng
 *       400:
 *         description: Thiếu lý do
 *       422:
 *         description: Trip không ở trạng thái ARRIVED
 */

/**
 * @swagger
 * /api/trips/{id}/release:
 *   post:
 *     tags: [Trips]
 *     summary: Hủy chuyến sớm (CLAIMED/PICKING → trả về pool)
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
 *                 example: Xe hỏng đột xuất
 *     responses:
 *       200:
 *         description: Đã hủy, order trở về pool AVAILABLE
 *       422:
 *         description: Không đủ điều kiện hủy (trip đã qua trạng thái PICKING)
 */
