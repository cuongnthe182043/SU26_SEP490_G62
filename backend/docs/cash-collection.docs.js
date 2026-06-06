/**
 * @swagger
 * tags:
 *   - name: Cash Collection — Driver
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
 * /api/cash-collections/me:
 *   get:
 *     tags: [Cash Collection — Driver]
 *     summary: Danh sách thu hộ của driver
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, rejected, converted]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: shipmentId
 *         schema: { type: integer }
 *         description: Lọc theo chuyến
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
 *                 collections:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CashCollection'
 */

/**
 * @swagger
 * /api/cash-collections/summary:
 *   get:
 *     tags: [Cash Collection — Driver]
 *     summary: Tổng quan thu hộ (dùng cho dashboard)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CollectionSummary'
 */

/**
 * @swagger
 * /api/cash-collections/{id}:
 *   get:
 *     tags: [Cash Collection — Driver]
 *     summary: Chi tiết một lần báo thu hộ
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
 *                 collection:
 *                   $ref: '#/components/schemas/CashCollection'
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/cash-collections:
 *   post:
 *     tags: [Cash Collection — Driver]
 *     summary: Driver báo thu hộ tiền từ khách
 *     description: |
 *       Tạo bản ghi `status = pending`.
 *       Không tạo debt. Kế toán sẽ xử lý riêng.
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
 *                 description: ID chuyến hàng (order_shipments.id)
 *               notes:
 *                 type: string
 *                 nullable: true
 *               receiptUrl:
 *                 type: string
 *                 nullable: true
 *                 description: URL ảnh biên lai (upload riêng)
 *     responses:
 *       201:
 *         description: Đã tạo bản ghi, chờ kế toán xác nhận
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 collection:
 *                   $ref: '#/components/schemas/CashCollection'
 *       400:
 *         description: Thiếu amount hoặc paymentMethod không hợp lệ
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CashCollection:
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
 *         debt_id:        { type: integer, nullable: true, description: "Set khi status=converted" }
 *         shipment_id:    { type: integer, nullable: true }
 *         trip_code:      { type: string, nullable: true, example: "CH-2024-00123" }
 *         cargo_name:     { type: string, nullable: true }
 *
 *     CollectionSummary:
 *       type: object
 *       properties:
 *         pending_count:    { type: string, example: "1" }
 *         pending_amount:   { type: string, example: "800000.00", description: "Đang chờ xác nhận — chưa tính nợ" }
 *         confirmed_count:  { type: string, example: "2" }
 *         confirmed_amount: { type: string, example: "2000000.00" }
 *         rejected_count:   { type: string, example: "1" }
 *         converted_count:  { type: string, example: "0" }
 */
