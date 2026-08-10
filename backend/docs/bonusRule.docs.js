/**
 * @swagger
 * tags:
 *   name: BonusRule
 *   description: Cấu hình quy tắc thưởng (bonus_rules) — điều kiện tự động cấp thưởng theo KPI/doanh thu/số chuyến/không sự cố (Manager only)
 */

/**
 * @swagger
 * /api/bonus-rules:
 *   get:
 *     tags: [BonusRule]
 *     summary: Danh sách quy tắc thưởng (Manager cấu hình, Accountant chỉ đọc)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vehicle_group_id
 *         schema: { type: integer }
 *         description: Lọc theo nhóm xe
 *       - in: query
 *         name: bonus_type
 *         schema:
 *           type: string
 *           enum: [kpi, top_revenue, top_trips, zero_incident, overtime, holiday, custom]
 *       - in: query
 *         name: is_active
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Lọc theo trạng thái kích hoạt
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rules:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BonusRule'
 *                 bonusTypes:
 *                   type: object
 *                   description: |
 *                     Nguồn sự thật cho dropdown loại thưởng của UI.
 *                     `implemented` là các loại bộ tính lương thật sự đọc — chỉ những loại này
 *                     mới tạo/bật được. `all` là toàn bộ loại có trong CHECK của DB, chỉ dùng để
 *                     hiển thị đúng tên cho rule cũ.
 *                   properties:
 *                     all:         { type: array, items: { type: string } }
 *                     implemented: { type: array, items: { type: string }, example: [kpi, top_revenue, holiday] }
 *   post:
 *     tags: [BonusRule]
 *     summary: Tạo quy tắc thưởng mới (Manager)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BonusRuleInput'
 *     responses:
 *       201:
 *         description: Đã tạo quy tắc thưởng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 rule:
 *                   $ref: '#/components/schemas/BonusRule'
 *       400:
 *         description: |
 *           Lỗi cấu hình quy tắc (luôn là 4xx, kèm thông điệp nói rõ sai ở đâu):
 *           thiếu title/bonus_type; loại thưởng không hợp lệ; loại thưởng chưa được bộ tính
 *           lương hỗ trợ (ngoài kpi/top_revenue/holiday); thiếu cả reward_amount lẫn
 *           reward_multiplier khi rule đang bật; thiếu min_revenue khi bonus_type = kpi;
 *           thiếu reward_multiplier hoặc hệ số < 1 khi bonus_type = holiday.
 */

/**
 * @swagger
 * /api/bonus-rules/{id}:
 *   get:
 *     tags: [BonusRule]
 *     summary: Chi tiết quy tắc thưởng (Manager)
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
 *                 rule:
 *                   $ref: '#/components/schemas/BonusRule'
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Quy tắc thưởng không tồn tại
 *   put:
 *     tags: [BonusRule]
 *     summary: Cập nhật quy tắc thưởng (Manager)
 *     description: Các trường không truyền sẽ giữ nguyên giá trị hiện tại.
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
 *             $ref: '#/components/schemas/BonusRuleInput'
 *     responses:
 *       200:
 *         description: Đã cập nhật
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 rule:
 *                   $ref: '#/components/schemas/BonusRule'
 *       400:
 *         description: ID không hợp lệ, hoặc dữ liệu cập nhật không hợp lệ
 *       404:
 *         description: Quy tắc thưởng không tồn tại
 *   delete:
 *     tags: [BonusRule]
 *     summary: Xóa quy tắc thưởng (Manager)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Đã xóa quy tắc thưởng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       400:
 *         description: ID không hợp lệ
 *       404:
 *         description: Quy tắc thưởng không tồn tại
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     BonusRuleInput:
 *       type: object
 *       required: [title, bonus_type]
 *       properties:
 *         title:
 *           type: string
 *           example: "Thưởng vượt KPI doanh thu"
 *         bonus_type:
 *           type: string
 *           enum: [kpi, top_revenue, top_trips, zero_incident, overtime, holiday, custom]
 *           description: |
 *             Tạo mới / bật lại chỉ chấp nhận kpi, top_revenue, holiday — các loại còn lại
 *             không công thức lương nào đọc nên sẽ bị từ chối 400. Chúng chỉ hợp lệ khi sửa
 *             một rule cũ đang giữ nguyên loại đó (vd sửa tiêu đề, hoặc tắt rule).
 *         vehicle_group_id:
 *           type: integer
 *           nullable: true
 *           description: Bỏ trống để áp dụng mọi nhóm xe
 *         reward_amount:
 *           type: number
 *           nullable: true
 *           description: Cần ít nhất một trong reward_amount hoặc reward_multiplier
 *         reward_multiplier:
 *           type: number
 *           nullable: true
 *         conditions_json:
 *           type: object
 *           nullable: true
 *           description: Với bonus_type = kpi bắt buộc { min_revenue }
 *           example: { min_revenue: 50000000 }
 *         is_active:
 *           type: boolean
 *           default: true
 *
 *     BonusRule:
 *       type: object
 *       properties:
 *         id:                { type: integer }
 *         vehicle_group_id:  { type: integer, nullable: true }
 *         title:             { type: string }
 *         bonus_type:
 *           type: string
 *           enum: [kpi, top_revenue, top_trips, zero_incident, overtime, holiday, custom]
 *         reward_amount:     { type: string, nullable: true }
 *         reward_multiplier: { type: string, nullable: true }
 *         conditions_json:   { type: object, nullable: true }
 *         is_active:         { type: boolean }
 *         created_at:        { type: string, format: date-time }
 *         updated_at:        { type: string, format: date-time }
 */
