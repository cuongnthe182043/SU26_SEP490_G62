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
 *     summary: Danh sách quy tắc thưởng (Manager)
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
 *         description: Thiếu title/bonus_type, loại thưởng không hợp lệ, thiếu reward_amount/reward_multiplier, hoặc thiếu min_revenue khi bonus_type = kpi
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
