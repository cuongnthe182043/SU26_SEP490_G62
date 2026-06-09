/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Quản lý đơn hàng (Coordinator / Admin)
 */

/**
 * @swagger
 * /api/orders:
 *   get:
 *     tags: [Orders]
 *     summary: Danh sách tất cả orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Danh sách orders
 *       403:
 *         description: Không có quyền
 *   post:
 *     tags: [Orders]
 *     summary: Tạo order mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, pickup_address, destination_address, vehicle_group]
 *             properties:
 *               customer_id:        { type: integer }
 *               pickup_address:     { type: string }
 *               destination_address: { type: string }
 *               vehicle_group:      { type: string, example: 5m2 }
 *               cargo_note:         { type: string }
 *               priority:           { type: string, enum: [low, normal, high], default: normal }
 *     responses:
 *       201:
 *         description: Tạo order thành công, trip vào pool AVAILABLE
 *       422:
 *         description: Dữ liệu không hợp lệ
 */

/**
 * @swagger
 * /api/orders/import-excel:
 *   post:
 *     tags: [Orders]
 *     summary: Import nhiều orders từ file Excel
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File .xlsx theo template
 *     responses:
 *       200:
 *         description: Kết quả import (success_count, failed_rows)
 *       422:
 *         description: File không đúng định dạng
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   patch:
 *     tags: [Orders]
 *     summary: Cập nhật thông tin order (Coordinator / Admin)
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
 *             properties:
 *               pickup_address:      { type: string }
 *               destination_address: { type: string }
 *               vehicle_group:       { type: string }
 *               cargo_note:          { type: string }
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high]
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy order
 *       422:
 *         description: Dữ liệu không hợp lệ
 */
