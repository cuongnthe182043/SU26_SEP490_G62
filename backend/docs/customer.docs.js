/**
 * @swagger
 * tags:
 *   name: Customer
 *   description: Quản lý khách hàng (customers) — cá nhân/doanh nghiệp, dùng để gắn Order (Coordinator, Manager)
 */

/**
 * @swagger
 * /api/customers:
 *   get:
 *     tags: [Customer]
 *     summary: Danh sách khách hàng (phân trang)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên, tên công ty, số điện thoại hoặc mã số thuế
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [individual, business]
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, name_asc, orders_desc]
 *           default: newest
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Customer'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 *   post:
 *     tags: [Customer]
 *     summary: Tạo khách hàng mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CustomerInput'
 *     responses:
 *       201:
 *         description: Đã tạo khách hàng mới
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 customer:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Thiếu số điện thoại, loại khách hàng không hợp lệ, hoặc thiếu tên/tên công ty theo loại
 *       409:
 *         description: Số điện thoại đã được đăng ký cho khách hàng khác
 */

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     tags: [Customer]
 *     summary: Chi tiết khách hàng
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
 *                 customer:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Khách hàng không tồn tại
 *   put:
 *     tags: [Customer]
 *     summary: Cập nhật khách hàng
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
 *             $ref: '#/components/schemas/CustomerInput'
 *     responses:
 *       200:
 *         description: Đã cập nhật khách hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 customer:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         description: ID không hợp lệ, loại khách hàng không hợp lệ, hoặc thiếu tên/tên công ty theo loại
 *       404:
 *         description: Khách hàng không tồn tại
 *       409:
 *         description: Số điện thoại đã được đăng ký cho khách hàng khác
 *   delete:
 *     tags: [Customer]
 *     summary: Xóa khách hàng
 *     description: Không cho xóa nếu khách hàng đã có đơn hàng trong hệ thống.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Đã xóa khách hàng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Khách hàng không tồn tại
 *       409:
 *         description: Không thể xóa — khách hàng đã có đơn hàng trong hệ thống
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerInput:
 *       type: object
 *       required: [phone]
 *       properties:
 *         customer_type:
 *           type: string
 *           enum: [individual, business]
 *           default: individual
 *         full_name:
 *           type: string
 *           description: Bắt buộc khi customer_type = individual
 *         company_name:
 *           type: string
 *           description: Bắt buộc khi customer_type = business
 *         contact_person: { type: string }
 *         phone:           { type: string, example: "0912345678" }
 *         email:           { type: string, nullable: true }
 *         address:         { type: string, nullable: true }
 *         tax_code:        { type: string, nullable: true }
 *         notes:           { type: string, nullable: true }
 *
 *     Customer:
 *       type: object
 *       properties:
 *         id:             { type: integer }
 *         customer_type:
 *           type: string
 *           enum: [individual, business]
 *         full_name:      { type: string, nullable: true }
 *         company_name:   { type: string, nullable: true }
 *         contact_person: { type: string, nullable: true }
 *         phone:          { type: string }
 *         email:          { type: string, nullable: true }
 *         address:        { type: string, nullable: true }
 *         tax_code:       { type: string, nullable: true }
 *         notes:          { type: string, nullable: true }
 *         total_orders:
 *           type: integer
 *           description: Chỉ có trong danh sách (GET /api/customers) — tổng số đơn hàng của khách
 *         created_at:     { type: string, format: date-time }
 *         updated_at:     { type: string, format: date-time, nullable: true }
 */
