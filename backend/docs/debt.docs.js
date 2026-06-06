/**
 * @swagger
 * tags:
 *   - name: Debt — Driver
 *     description: |
 *       Driver chỉ xem công nợ. Công nợ được kế toán tạo thủ công
 *       (thường khi convert từ cash_collection bị không xác nhận).
 *       Driver không tự tạo hay nộp tiền qua đây — dùng Cash Collection để báo thu hộ.
 */

/**
 * @swagger
 * /api/debts/me:
 *   get:
 *     tags: [Debt — Driver]
 *     summary: Danh sách công nợ của driver (read-only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [unpaid, partial, paid, overdue]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 debts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DriverDebt'
 */

/**
 * @swagger
 * /api/debts/summary:
 *   get:
 *     tags: [Debt — Driver]
 *     summary: Tổng quan công nợ (dùng cho dashboard)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DebtSummary'
 */

/**
 * @swagger
 * /api/debts/{id}/payments:
 *   get:
 *     tags: [Debt — Driver]
 *     summary: Lịch sử kế toán ghi nhận thanh toán cho một khoản nợ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DebtPayment'
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DriverDebt:
 *       type: object
 *       properties:
 *         id:           { type: integer }
 *         total_amount: { type: string, example: "1500000.00" }
 *         paid_amount:  { type: string, example: "500000.00" }
 *         remaining:    { type: string, example: "1000000.00" }
 *         status:
 *           type: string
 *           enum: [unpaid, partial, paid, overdue]
 *         due_date:     { type: string, format: date, nullable: true }
 *         notes:        { type: string, nullable: true }
 *         created_at:   { type: string, format: date-time }
 *         shipment_id:  { type: integer, nullable: true }
 *         trip_code:    { type: string, nullable: true }
 *         order_id:     { type: integer, nullable: true }
 *         cargo_name:   { type: string, nullable: true }
 *
 *     DebtPayment:
 *       type: object
 *       description: Ghi nhận bởi kế toán — driver chỉ xem
 *       properties:
 *         id:             { type: integer }
 *         amount:         { type: string, example: "500000.00" }
 *         payment_method:
 *           type: string
 *           enum: [cash, bank_transfer, offset]
 *         paid_at:        { type: string, format: date-time }
 *         notes:          { type: string, nullable: true }
 *
 *     DebtSummary:
 *       type: object
 *       properties:
 *         open_count:        { type: string, example: "1" }
 *         total_remaining:   { type: string, example: "1000000.00" }
 *         overdue_remaining: { type: string, example: "0.00" }
 */
