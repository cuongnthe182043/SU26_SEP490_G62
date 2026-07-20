/**
 * @swagger
 * tags:
 *   name: Company
 *   description: Thông tin công ty (company_info) — tên, hotline, tài khoản ngân hàng, QR chuyển khoản dùng cho phiếu thu
 */

/**
 * @swagger
 * /api/company/info:
 *   get:
 *     tags: [Company]
 *     summary: Xem thông tin công ty
 *     description: Mọi user đã đăng nhập đều xem được — driver cần bank_qr_url để show QR cho khách chuyển khoản.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 info:
 *                   $ref: '#/components/schemas/CompanyInfo'
 *   put:
 *     tags: [Company]
 *     summary: Cập nhật thông tin công ty (Manager, Admin)
 *     description: Chỉ các trường được truyền mới được cập nhật (COALESCE giữ nguyên giá trị cũ nếu không truyền).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_name:        { type: string }
 *               hotline:             { type: string }
 *               bank_name:           { type: string }
 *               bank_account_number: { type: string }
 *               bank_account_name:   { type: string }
 *     responses:
 *       200:
 *         description: Đã cập nhật
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 info:
 *                   $ref: '#/components/schemas/CompanyInfo'
 *       403:
 *         description: Không có quyền (chỉ Manager/Admin)
 */

/**
 * @swagger
 * /api/company/bank-qr:
 *   post:
 *     tags: [Company]
 *     summary: Upload ảnh QR ngân hàng công ty (Manager, Admin)
 *     description: Ảnh QR dùng để hiển thị cho driver khi thu tiền khách qua chuyển khoản (Receipt Detail).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [qr]
 *             properties:
 *               qr:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh QR ngân hàng
 *     responses:
 *       200:
 *         description: Upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 info:
 *                   $ref: '#/components/schemas/CompanyInfo'
 *       403:
 *         description: Không có quyền (chỉ Manager/Admin)
 *       422:
 *         description: Chưa chọn ảnh QR, hoặc lỗi định dạng file upload
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     CompanyInfo:
 *       type: object
 *       properties:
 *         id:                  { type: integer, example: 1 }
 *         company_name:        { type: string, nullable: true }
 *         hotline:             { type: string, nullable: true }
 *         bank_name:           { type: string, nullable: true }
 *         bank_account_number: { type: string, nullable: true }
 *         bank_account_name:   { type: string, nullable: true }
 *         bank_qr_url:         { type: string, nullable: true }
 *         updated_at:          { type: string, format: date-time, nullable: true }
 */
