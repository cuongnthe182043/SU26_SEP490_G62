/**
 * @swagger
 * tags:
 *   name: Bonus
 *   description: Thưởng & phúc lợi (driver_bonuses) — thưởng Tết theo thâm niên/chuyên cần, phúc lợi hiếu hỉ/sinh nhật, duyệt 2 cấp (Manager duyệt → Accountant chi trả)
 */

/**
 * @swagger
 * /api/bonuses/my:
 *   get:
 *     tags: [Bonus]
 *     summary: Driver xem danh sách thưởng/phúc lợi của chính mình
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách khoản thưởng của driver hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bonuses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DriverBonus'
 */

/**
 * @swagger
 * /api/bonuses:
 *   get:
 *     tags: [Bonus]
 *     summary: Danh sách toàn bộ khoản thưởng/phúc lợi (Manager, Accountant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [tet_annual, welfare_wedding, welfare_funeral, welfare_birthday, holiday_overtime, special]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên hoặc số điện thoại nhân viên
 *       - in: query
 *         name: driver_id
 *         schema: { type: integer }
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [oldest, amount-desc, amount-asc]
 *         description: Mặc định mới nhất trước
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Nếu không truyền limit thì trả về toàn bộ (không phân trang)
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Danh sách khoản thưởng (có phân trang nếu truyền limit)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bonuses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DriverBonus'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *       400:
 *         description: Loại thưởng hoặc trạng thái không hợp lệ
 *   post:
 *     tags: [Bonus]
 *     summary: Tạo khoản phúc lợi/thưởng đột xuất (Manager, Accountant)
 *     description: >
 *       Manager tạo → tự động duyệt luôn (status = approved).
 *       Accountant tạo → giữ pending, chờ Manager duyệt.
 *       amount tự tính với welfare_birthday (200.000đ), welfare_wedding (1.000.000đ),
 *       welfare_funeral (theo beneficiary_relation). type = tet_annual không được tạo ở đây
 *       (phải dùng /api/bonuses/tet/generate).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, type]
 *             properties:
 *               driver_id: { type: integer, example: 12 }
 *               type:
 *                 type: string
 *                 enum: [welfare_wedding, welfare_funeral, welfare_birthday, holiday_overtime, special]
 *               amount:
 *                 type: number
 *                 description: Bắt buộc > 0 với holiday_overtime/special — bỏ qua với các loại tự tính amount
 *               notes: { type: string }
 *               year: { type: integer, description: Mặc định năm hiện tại }
 *               beneficiary_name: { type: string }
 *               beneficiary_relation:
 *                 type: string
 *                 enum: [self, spouse, parent, parent_in_law, child]
 *                 description: Bắt buộc khi type = welfare_funeral
 *               proof_url: { type: string }
 *     responses:
 *       201:
 *         description: Tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 bonus:
 *                   $ref: '#/components/schemas/DriverBonus'
 *       400:
 *         description: Thiếu driver_id/type, loại thưởng không hợp lệ, hoặc thiếu beneficiary_relation
 *       404:
 *         description: Nhân viên không tồn tại hoặc đã bị khóa
 */

/**
 * @swagger
 * /api/bonuses/stats:
 *   get:
 *     tags: [Bonus]
 *     summary: Thống kê tổng quan thưởng/phúc lợi theo năm (Manager, Accountant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Bỏ trống để lấy tất cả các năm
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_count:    { type: string }
 *                 pending_count:  { type: string }
 *                 approved_count: { type: string }
 *                 paid_count:     { type: string }
 *                 rejected_count: { type: string }
 *                 approved_total: { type: string, description: Tổng amount của status approved + paid }
 *                 paid_total:     { type: string }
 */

/**
 * @swagger
 * /api/bonuses/staff-lookup:
 *   get:
 *     tags: [Bonus]
 *     summary: Danh sách nhân viên đang hoạt động để chọn khi tạo phiếu thưởng (Manager, Accountant)
 *     description: Áp dụng cho mọi nhân viên (không chỉ driver) — dùng cho dropdown ở form tạo phúc lợi.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 staff:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:        { type: integer }
 *                       full_name: { type: string }
 *                       phone:     { type: string }
 *                       role:      { type: string }
 */

/**
 * @swagger
 * /api/bonuses/{id}:
 *   get:
 *     tags: [Bonus]
 *     summary: Chi tiết một khoản thưởng/phúc lợi (Manager, Accountant)
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
 *               $ref: '#/components/schemas/DriverBonus'
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Không tìm thấy khoản thưởng/phúc lợi
 */

/**
 * @swagger
 * /api/bonuses/tet/preview:
 *   get:
 *     tags: [Bonus]
 *     summary: Xem trước thưởng Tết cho toàn bộ driver theo năm, trước khi tạo hàng loạt (Manager)
 *     description: >
 *       Tính thưởng thâm niên (2.000.000đ nếu đủ 1 năm làm việc) + thưởng chuyên cần
 *       (dựa trên số tháng nghỉ không lương/vắng không phép trong năm) cho mỗi driver.
 *       Không ghi vào DB — chỉ xem trước.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Mặc định năm hiện tại
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 year: { type: integer }
 *                 previews:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       driver_id:               { type: integer }
 *                       months_full_count:       { type: integer }
 *                       months_incomplete_count: { type: integer }
 *                       seniority_bonus:         { type: number }
 *                       attendance_bonus:        { type: number }
 *                       total:                   { type: number }
 *                       full_name:               { type: string }
 *                       phone:                   { type: string }
 *                       vehicle_group:           { type: string, nullable: true }
 *                       already_exists:
 *                         type: boolean
 *                         description: true nếu driver này đã có bản ghi tet_annual cho năm đó
 *       400:
 *         description: Năm không hợp lệ (2020–2100)
 */

/**
 * @swagger
 * /api/bonuses/tet/generate:
 *   post:
 *     tags: [Bonus]
 *     summary: Tạo hàng loạt thưởng Tết cho toàn bộ driver theo năm (Manager)
 *     description: Bỏ qua driver đã có bản ghi tet_annual cho năm đó (idempotent). Bản ghi tạo ra ở trạng thái pending, chờ Manager duyệt.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               year: { type: integer, description: Mặc định năm hiện tại }
 *     responses:
 *       201:
 *         description: Đã tạo các phiếu thưởng Tết
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:  { type: string }
 *                 inserted: { type: integer }
 *                 skipped:  { type: integer }
 *       400:
 *         description: Năm không hợp lệ (2020–2100)
 */

/**
 * @swagger
 * /api/bonuses/{id}/approve:
 *   patch:
 *     tags: [Bonus]
 *     summary: Duyệt khoản thưởng/phúc lợi (Manager)
 *     description: Chỉ duyệt được khi status hiện tại là pending. Sau khi duyệt, Accountant nhận notification để chi trả.
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
 *               amount:
 *                 type: number
 *                 description: Điều chỉnh số tiền khi duyệt (tuỳ chọn, phải > 0)
 *     responses:
 *       200:
 *         description: Đã duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 bonus:
 *                   $ref: '#/components/schemas/DriverBonus'
 *       400:
 *         description: Không tìm thấy hoặc trạng thái không phải pending, hoặc amount điều chỉnh <= 0
 */

/**
 * @swagger
 * /api/bonuses/{id}/reject:
 *   patch:
 *     tags: [Bonus]
 *     summary: Từ chối khoản thưởng/phúc lợi (Manager)
 *     description: Chỉ từ chối được khi status hiện tại là pending. Bắt buộc ghi lý do.
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
 *               reason: { type: string, example: "Đã chi trả bằng hình thức khác" }
 *     responses:
 *       200:
 *         description: Đã từ chối
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 bonus:
 *                   $ref: '#/components/schemas/DriverBonus'
 *       400:
 *         description: Thiếu lý do, hoặc trạng thái không phải pending
 */

/**
 * @swagger
 * /api/bonuses/{id}/pay:
 *   patch:
 *     tags: [Bonus]
 *     summary: Ghi nhận chi trả khoản thưởng/phúc lợi (Accountant)
 *     description: Chỉ chi trả được khi status hiện tại là approved. Ghi 1 dòng financial_transactions (event_type = bonus_paid, chi tiền mặt ngoài kỳ lương).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Đã chi trả
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 bonus:
 *                   $ref: '#/components/schemas/DriverBonus'
 *       400:
 *         description: Không tìm thấy hoặc trạng thái không phải approved
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DriverBonus:
 *       type: object
 *       properties:
 *         id:                       { type: integer }
 *         driver_id:                { type: integer }
 *         type:
 *           type: string
 *           enum: [tet_annual, welfare_wedding, welfare_funeral, welfare_birthday, holiday_overtime, special]
 *         year:                     { type: integer }
 *         amount:                   { type: string, example: "2000000.00" }
 *         notes:                    { type: string, nullable: true }
 *         months_full_count:        { type: integer, nullable: true }
 *         months_incomplete_count:  { type: integer, nullable: true }
 *         seniority_bonus:          { type: string, nullable: true }
 *         attendance_bonus:         { type: string, nullable: true }
 *         beneficiary_name:         { type: string, nullable: true }
 *         beneficiary_relation:
 *           type: string
 *           nullable: true
 *           enum: [self, spouse, parent, parent_in_law, child]
 *         proof_url:                { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *         rejection_reason:         { type: string, nullable: true }
 *         requested_by:             { type: integer, nullable: true }
 *         approved_by:              { type: integer, nullable: true }
 *         paid_by:                  { type: integer, nullable: true }
 *         requested_at:             { type: string, format: date-time, nullable: true }
 *         approved_at:              { type: string, format: date-time, nullable: true }
 *         paid_at:                  { type: string, format: date-time, nullable: true }
 *         created_at:               { type: string, format: date-time }
 *         updated_at:               { type: string, format: date-time }
 *         driver_name:              { type: string }
 *         driver_phone:             { type: string }
 *         vehicle_group:            { type: string, nullable: true }
 *         requested_by_name:        { type: string, nullable: true }
 *         approved_by_name:         { type: string, nullable: true }
 *         paid_by_name:             { type: string, nullable: true }
 */
