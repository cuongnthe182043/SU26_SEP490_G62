/**
 * @swagger
 * tags:
 *   name: Expenses
 *   description: Chi phí phát sinh trong chuyến (Driver)
 */

/**
 * @swagger
 * /api/expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Tạo chi phí kèm ảnh receipt (bắt buộc)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [shipment_id, expense_type, amount, receipt]
 *             properties:
 *               shipment_id:
 *                 type: integer
 *               expense_type:
 *                 type: string
 *                 enum: [fuel, toll, parking, minor_repair, other]
 *               amount:
 *                 type: number
 *                 example: 500000
 *               note:
 *                 type: string
 *                 example: Đổ xăng tại trạm xăng số 5
 *               receipt:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh hoá đơn (bắt buộc)
 *     responses:
 *       201:
 *         description: Tạo chi phí thành công
 *       422:
 *         description: Thiếu receipt, amount <= 0, hoặc shipment không active
 */

/**
 * @swagger
 * /api/expenses/shipment/{shipmentId}:
 *   get:
 *     tags: [Expenses]
 *     summary: Danh sách chi phí theo shipment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Danh sách chi phí
 *       404:
 *         description: Shipment không tồn tại
 */
