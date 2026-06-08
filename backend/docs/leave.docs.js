/**
 * @swagger
 * tags:
 *   - name: Leave — Driver
 *     description: Driver đăng ký nghỉ phép. Auto-approved — hệ thống ghi nhận ngay, kế toán dùng để tính ngày công.
 */

/**
 * @swagger
 * /api/leave/me:
 *   get:
 *     tags: [Leave — Driver]
 *     summary: Lịch sử đăng ký nghỉ của driver
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: Lọc theo tháng (tuỳ chọn)
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Lọc theo năm (tuỳ chọn)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaves:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaveRequest'
 */

/**
 * @swagger
 * /api/leave/summary:
 *   get:
 *     tags: [Leave — Driver]
 *     summary: Tổng quan ngày công trong tháng
 *     description: |
 *       Trả về số ngày đi làm thực tế trong tháng:
 *       - `working_days` = 28 − số ngày nghỉ **không lương** đã được approved
 *       - Ngày nghỉ **có lương** (lễ, việc riêng) không trừ vào ngày công
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AttendanceSummary'
 */

/**
 * @swagger
 * /api/leave:
 *   post:
 *     tags: [Leave — Driver]
 *     summary: Đăng ký nghỉ (auto-approved — áp dụng ngay)
 *     description: |
 *       Driver đăng ký nghỉ cho một ngày cụ thể.
 *
 *       **Loại nghỉ:**
 *       - `paid` — Hưởng nguyên lương: nghỉ lễ quốc gia (Tết, 30/4, 1/5, 2/9, Giỗ Tổ), kết hôn (3 ngày), tang (3 ngày)
 *       - `unpaid` — Không lương: trừ `(lương cứng / 28)` mỗi ngày vắng mặt
 *
 *       Mỗi driver chỉ được đăng ký **1 lần** cho mỗi ngày (UNIQUE constraint).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leaveDate, leaveType]
 *             properties:
 *               leaveDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-06-25"
 *               leaveType:
 *                 type: string
 *                 enum: [paid, unpaid]
 *                 example: unpaid
 *               reason:
 *                 type: string
 *                 example: "Việc gia đình"
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 leave:
 *                   $ref: '#/components/schemas/LeaveRequest'
 *       400:
 *         description: Thiếu trường bắt buộc hoặc leaveType không hợp lệ
 *       409:
 *         description: Ngày này đã được đăng ký nghỉ
 */

/**
 * @swagger
 * /api/leave/{id}:
 *   delete:
 *     tags: [Leave — Driver]
 *     summary: Huỷ đăng ký nghỉ (chỉ được huỷ ngày tương lai)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Huỷ thành công
 *       422:
 *         description: Không thể huỷ — ngày đã qua hoặc không thuộc về driver này
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LeaveRequest:
 *       type: object
 *       properties:
 *         id:         { type: integer }
 *         leave_date: { type: string, format: date, example: "2026-06-25" }
 *         leave_type:
 *           type: string
 *           enum: [paid, unpaid]
 *           description: "paid: hưởng nguyên lương | unpaid: không lương (trừ ngày công)"
 *         reason:     { type: string, nullable: true }
 *         status:
 *           type: string
 *           enum: [approved, rejected]
 *           default: approved
 *         created_at: { type: string, format: date-time }
 *
 *     AttendanceSummary:
 *       type: object
 *       properties:
 *         total_leaves: { type: string, example: "2", description: "Tổng ngày nghỉ (approved)" }
 *         unpaid_days:  { type: string, example: "1", description: "Số ngày không lương" }
 *         paid_days:    { type: string, example: "1", description: "Số ngày nghỉ có lương" }
 *         working_days: { type: integer, example: 27, description: "28 − unpaid_days (ngày công tính lương)" }
 */
