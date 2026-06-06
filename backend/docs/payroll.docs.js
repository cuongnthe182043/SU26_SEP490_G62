/**
 * @swagger
 * tags:
 *   - name: Payroll — Driver
 *     description: Driver xem lương ước tính, lịch sử bảng lương, và yêu cầu ứng lương
 */

/**
 * @swagger
 * /api/payroll/estimate:
 *   get:
 *     tags: [Payroll — Driver]
 *     summary: Ước tính lương tháng hiện tại (real-time, chưa finalized)
 *     description: |
 *       Tính lương dự kiến dựa trên:
 *       - Lương cứng theo thâm niên (< 12 tháng = 8M, ≥ 12 tháng = 9M)
 *       - Số ngày công thực tế = 28 − ngày nghỉ không lương trong tháng
 *       - Thưởng doanh thu 15% từ KPI tháng đó
 *       - Phụ cấp điện thoại 200,000₫
 *       - Thưởng vượt KPI (Rule 5) và thưởng lái xe xuất sắc (Rule 4) nếu đủ điều kiện
 *       - Trừ BHXH người lao động: 5,310,000 × 10.5% = 557,550₫
 *       - Trừ ứng lương đã được duyệt trong tháng
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: Tháng (mặc định = tháng hiện tại)
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Năm (mặc định = năm hiện tại)
 *     responses:
 *       200:
 *         description: Ước tính lương tháng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PayrollEstimate'
 *       400:
 *         description: Driver chưa được gán xe hoặc tháng không hợp lệ
 */

/**
 * @swagger
 * /api/payroll/me:
 *   get:
 *     tags: [Payroll — Driver]
 *     summary: Lịch sử bảng lương đã finalized (kế toán tạo)
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
 *         description: Danh sách bảng lương
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payrolls:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payroll'
 */

/**
 * @swagger
 * /api/payroll/advance:
 *   get:
 *     tags: [Payroll — Driver]
 *     summary: Danh sách yêu cầu ứng lương của driver
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *         description: Lọc theo trạng thái (tuỳ chọn)
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 advances:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SalaryAdvance'
 *
 *   post:
 *     tags: [Payroll — Driver]
 *     summary: Yêu cầu ứng lương (BR-029 — Driver request → Manager approve)
 *     description: |
 *       **Quy tắc nghiệp vụ:**
 *       - Chỉ được thực hiện **vào ngày 25** hàng tháng
 *       - Số tiền tối đa **5,000,000₫** mỗi tháng
 *       - Mỗi tháng chỉ có **1 yêu cầu** đang pending/approved
 *       - Flow: Driver gửi → Manager duyệt → Kế toán giải ngân
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, requestMonth, requestYear]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 3000000
 *                 description: Số tiền ứng (tối đa 5,000,000)
 *               reason:
 *                 type: string
 *                 example: Chi phí gia đình
 *                 description: Lý do ứng lương (tuỳ chọn)
 *               requestMonth:
 *                 type: integer
 *                 example: 6
 *               requestYear:
 *                 type: integer
 *                 example: 2026
 *     responses:
 *       201:
 *         description: Yêu cầu đã gửi, chờ quản lý duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 advance:
 *                   $ref: '#/components/schemas/SalaryAdvance'
 *       400:
 *         description: Không phải ngày 25, hoặc số tiền vượt giới hạn
 *       409:
 *         description: Đã có yêu cầu ứng lương trong tháng này
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PayrollEstimate:
 *       type: object
 *       properties:
 *         month:               { type: integer, example: 6 }
 *         year:                { type: integer, example: 2026 }
 *         months_of_service:   { type: integer, example: 15, description: "Số tháng làm việc" }
 *         base_salary:         { type: string, example: "9000000.00", description: "Lương cứng (8M hoặc 9M)" }
 *         actual_working_days: { type: integer, example: 27, description: "28 − ngày nghỉ không lương" }
 *         unpaid_days:         { type: integer, example: 1 }
 *         absence_penalty:     { type: string, example: "321428.57", description: "Tiền trừ do nghỉ không lương" }
 *         pro_rated_base:      { type: string, example: "8678571.43", description: "Lương cứng theo ngày công thực tế" }
 *         total_revenue:       { type: string, example: "15000000.00" }
 *         revenue_share_pct:   { type: string, example: "15.00" }
 *         revenue_bonus:       { type: string, example: "2250000.00", description: "15% × total_revenue" }
 *         phone_allowance:     { type: string, example: "200000.00" }
 *         kpi_bonus:           { type: string, example: "2000000.00", description: "Rule 5 — Thưởng vượt KPI" }
 *         top_driver_bonus:    { type: string, example: "1000000.00", description: "Rule 4 — Lái xe xuất sắc nhất" }
 *         insurance_employee:  { type: string, example: "557550.00", description: "BHXH NLĐ: 5,310,000 × 10.5%" }
 *         advance_deduction:   { type: string, example: "0.00", description: "Ứng lương đã được duyệt tháng này" }
 *         estimated_gross:     { type: string, example: "14128571.43" }
 *         estimated_net:       { type: string, example: "13571021.43", description: "Ước tính thực nhận" }
 *
 *     Payroll:
 *       type: object
 *       properties:
 *         id:                    { type: integer }
 *         payroll_month:         { type: integer, example: 5 }
 *         payroll_year:          { type: integer, example: 2026 }
 *         base_salary:           { type: string, example: "9000000.00" }
 *         months_of_service:     { type: integer, example: 15 }
 *         total_revenue:         { type: string }
 *         revenue_share_pct:     { type: string }
 *         revenue_bonus:         { type: string }
 *         kpi_bonus:             { type: string }
 *         top_driver_bonus:      { type: string }
 *         holiday_bonus:         { type: string }
 *         other_bonus:           { type: string, description: "Bao gồm phụ cấp điện thoại 200K và các khoản khác" }
 *         insurance_employee:    { type: string }
 *         driver_debt_deduction: { type: string }
 *         advance_deduction:     { type: string }
 *         absence_penalty:       { type: string }
 *         gross_salary:          { type: string }
 *         net_salary:            { type: string }
 *         status:
 *           type: string
 *           enum: [pending, reviewed, approved, paid]
 *         paid_at:               { type: string, format: date-time, nullable: true }
 *
 *     SalaryAdvance:
 *       type: object
 *       properties:
 *         id:            { type: integer }
 *         amount:        { type: string, example: "3000000.00" }
 *         reason:        { type: string, nullable: true }
 *         request_month: { type: integer, example: 6 }
 *         request_year:  { type: integer, example: 2026 }
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, paid]
 *         reject_reason: { type: string, nullable: true }
 *         created_at:    { type: string, format: date-time }
 *         paid_at:       { type: string, format: date-time, nullable: true }
 */
