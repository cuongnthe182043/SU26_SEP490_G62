/**
 * @swagger
 * tags:
 *   - name: Bill — Driver
 *     description: |
 *       Driver tự báo thu hộ tiền từ khách → Kế toán xác nhận.
 *       Trong lúc `status = pending` → KHÔNG tính là công nợ tài xế.
 *       Chỉ chuyển thành `debts` khi kế toán chủ động bấm "Chuyển thành công nợ".
 *
 *       **Luồng:**
 *       ```
 *       Driver báo thu hộ (pending)
 *           → Kế toán xác nhận (confirmed) → tiền vào sổ, không tạo debt
 *           → Kế toán từ chối (rejected)   → driver cần báo lại
 *           → Kế toán convert  (converted) → tạo debts record, driver có công nợ
 *       ```
 */

/**
 * @swagger
 * /api/bills/me:
 *   get:
 *     tags: [Bill — Driver]
 *     summary: Danh sách bill của driver
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, rejected, converted]
 *       - in: query
 *         name: shipmentId
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bills:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bill'
 */

/**
 * @swagger
 * /api/bills/summary:
 *   get:
 *     tags: [Bill — Driver]
 *     summary: Tổng quan bill (dùng cho dashboard)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BillSummary'
 */

/**
 * @swagger
 * /api/bills/{id}:
 *   get:
 *     tags: [Bill — Driver]
 *     summary: Chi tiết một bill
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
 *                 bill:
 *                   $ref: '#/components/schemas/Bill'
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/bills:
 *   post:
 *     tags: [Bill — Driver]
 *     summary: Driver tạo bill báo thu hộ tiền từ khách
 *     description: |
 *       Tạo bản ghi `status = pending`. Không tạo debt. Kế toán xử lý riêng.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 800000
 *               paymentMethod:
 *                 type: string
 *                 enum: [cash, bank_transfer]
 *                 default: cash
 *               shipmentId:
 *                 type: integer
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *               receiptUrl:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 bill:
 *                   $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Thiếu amount hoặc paymentMethod không hợp lệ
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Bill:
 *       type: object
 *       properties:
 *         id:             { type: integer }
 *         amount:         { type: string, example: "800000.00" }
 *         payment_method:
 *           type: string
 *           enum: [cash, bank_transfer]
 *         status:
 *           type: string
 *           enum: [pending, confirmed, rejected, converted]
 *           description: |
 *             pending: chờ kế toán xác nhận — KHÔNG tính nợ tài xế
 *             confirmed: kế toán xác nhận, tiền vào sổ
 *             rejected: kế toán từ chối, driver cần xử lý lại
 *             converted: đã chuyển thành công nợ (debts)
 *         notes:          { type: string, nullable: true }
 *         receipt_url:    { type: string, nullable: true }
 *         collected_at:   { type: string, format: date-time }
 *         confirmed_at:   { type: string, format: date-time, nullable: true }
 *         reject_reason:  { type: string, nullable: true }
 *         debt_id:        { type: integer, nullable: true }
 *         shipment_id:    { type: integer, nullable: true }
 *         trip_code:      { type: string, nullable: true }
 *         cargo_name:     { type: string, nullable: true }
 *
 *     BillSummary:
 *       type: object
 *       properties:
 *         pending_count:    { type: string }
 *         pending_amount:   { type: string, description: "Đang chờ xác nhận — chưa tính nợ" }
 *         confirmed_count:  { type: string }
 *         confirmed_amount: { type: string }
 *         rejected_count:   { type: string }
 *         converted_count:  { type: string }
 */
