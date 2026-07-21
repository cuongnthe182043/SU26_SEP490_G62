/**
 * @swagger
 * tags:
 *   name: Manager
 *   description: Các chức năng dành riêng cho vai trò Manager (duyệt lương, duyệt phiếu chi, quản lý đối tác, báo cáo...)
 */

/**
 * @swagger
 * /api/manager/dashboard:
 *   get:
 *     tags: [Manager]
 *     summary: Dashboard tổng quan cho Manager
 *     description: Gộp overview (nhân sự, xe, workflow), finance stats, các hàng đợi chờ duyệt (ứng lương, nộp công nợ, yêu cầu phiếu thu) và thông tin công ty.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dữ liệu dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     workforce: { type: object, description: "total_users, active_users, inactive_users, manager_count, coordinator_count, accountant_count, driver_count, active_staff" }
 *                     fleet: { type: object, description: "active, maintenance, broken, retired" }
 *                     workflow: { type: object, description: "pending_advances, pending_advances_amount, pending_repayments, pending_repayments_amount, pending_receipts, processing_receipts" }
 *                 finance:
 *                   type: object
 *                   description: Thống kê tài chính tổng quan (giống accountant finance/stats)
 *                 queues:
 *                   type: object
 *                   properties:
 *                     salary_advances:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/SalaryAdvance' }
 *                     debt_repayments:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/PendingDebtRepayment' }
 *                     receipt_requests:
 *                       type: array
 *                       items: { type: object }
 *                 company:
 *                   type: object
 *                   description: Thông tin công ty (bank_qr_url, ...)
 */

/**
 * @swagger
 * /api/manager/reports/overview:
 *   get:
 *     tags: [Manager]
 *     summary: Báo cáo tổng quan (biểu đồ doanh thu, top khách hàng, aging công nợ, payroll summary, doanh thu theo nhóm xe...)
 *     description: Dữ liệu giống ReportView của Accountant — Manager xem cùng nguồn dữ liệu accountantReportRepository.getReportOverview.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 6 }
 *         description: Số tháng thống kê (1–24)
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [day, week, month], default: month }
 *         description: Mức thời gian gộp dữ liệu
 *     responses:
 *       200:
 *         description: Dữ liệu báo cáo tổng quan
 *       400:
 *         description: Số tháng thống kê không hợp lệ (1–24) hoặc mức thời gian không hợp lệ
 */

/**
 * @swagger
 * /api/manager/trip-pool:
 *   get:
 *     tags: [Manager]
 *     summary: Xem Trip Pool (danh sách chuyến AVAILABLE) — chỉ xem, không claim được
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *       - in: query
 *         name: vehicleGroupId
 *         schema: { type: integer }
 *         description: Lọc theo nhóm xe (tuỳ chọn)
 *     responses:
 *       200:
 *         description: Danh sách trip AVAILABLE (phân trang), cấu trúc giống Trip Pool của Driver
 */

/**
 * @swagger
 * /api/manager/vehicle-groups:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách nhóm xe (dùng chung cho filter KPI/Leaderboard, giống Coordinator)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách nhóm xe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicleGroups:
 *                   type: array
 *                   items: { type: object }
 */

/**
 * @swagger
 * /api/manager/trips/{id}/cancel:
 *   patch:
 *     tags: [Manager]
 *     summary: Hủy một trip cụ thể — ngoài luồng sự cố
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: shipment_id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy chuyến
 *     responses:
 *       200:
 *         description: Đã hủy chuyến
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã hủy chuyến" }
 *                 shipment: { type: object }
 *       400:
 *         description: Shipment ID không hợp lệ
 *       404:
 *         description: Không tìm thấy chuyến
 */

/**
 * @swagger
 * /api/manager/trips/{id}/reassign:
 *   patch:
 *     tags: [Manager]
 *     summary: Điều chuyển trip sang driver khác — ngoài luồng sự cố
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: shipment_id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toDriverId]
 *             properties:
 *               toDriverId:
 *                 type: integer
 *                 description: ID driver mới được điều chuyển tới
 *     responses:
 *       200:
 *         description: Đã điều chuyển chuyến
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã điều chuyển chuyến" }
 *                 shipment: { type: object }
 *       400:
 *         description: Shipment ID không hợp lệ hoặc thiếu toDriverId
 *       404:
 *         description: Không tìm thấy chuyến hoặc driver
 */

/**
 * @swagger
 * /api/manager/incidents:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách sự cố (Incident) — Manager xem và có thể resolve qua route dùng chung /api/incidents/{id}/status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Lọc theo trạng thái sự cố
 *       - in: query
 *         name: severity_level
 *         schema: { type: string }
 *         description: Lọc theo mức độ nghiêm trọng
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: newest }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách sự cố phân trang
 */

/**
 * @swagger
 * /api/manager/salary-advances:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách yêu cầu ứng lương
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, paid, all], default: pending }
 *         description: Lọc theo trạng thái. Mặc định chỉ lấy pending; truyền "all" để lấy hết.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 advances:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SalaryAdvance' }
 */

/**
 * @swagger
 * /api/manager/salary-advances/{id}/approve:
 *   patch:
 *     tags: [Manager]
 *     summary: Duyệt yêu cầu ứng lương (BR-029) — sau khi duyệt, Accountant sẽ giải ngân
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: salary_advance_id
 *     responses:
 *       200:
 *         description: Đã phê duyệt yêu cầu ứng lương
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã phê duyệt yêu cầu ứng lương" }
 *                 advance: { $ref: '#/components/schemas/SalaryAdvance' }
 *       400:
 *         description: Advance ID không hợp lệ
 *       404:
 *         description: Yêu cầu ứng lương không tồn tại
 *       409:
 *         description: Yêu cầu ứng lương này đã được xử lý
 */

/**
 * @swagger
 * /api/manager/salary-advances/{id}/reject:
 *   patch:
 *     tags: [Manager]
 *     summary: Từ chối yêu cầu ứng lương
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: salary_advance_id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối
 *     responses:
 *       200:
 *         description: Đã từ chối yêu cầu ứng lương
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã từ chối yêu cầu ứng lương" }
 *                 advance: { $ref: '#/components/schemas/SalaryAdvance' }
 *       400:
 *         description: Advance ID không hợp lệ
 *       404:
 *         description: Yêu cầu ứng lương không tồn tại
 *       409:
 *         description: Yêu cầu ứng lương này đã được xử lý
 */

/**
 * @swagger
 * /api/manager/debt-repayments:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách yêu cầu nộp tiền công nợ đang chờ xác nhận (driver + customer)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repayments:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/PendingDebtRepayment' }
 */

/**
 * @swagger
 * /api/manager/debt-repayments/{paymentId}/confirm:
 *   patch:
 *     tags: [Manager]
 *     summary: Xác nhận đã nộp tiền — ghi sổ tài chính (driver_debt_paid / customer_payment)
 *     description: UPDATE có điều kiện status để chống race (2 người cùng xác nhận chỉ 1 thắng).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: integer }
 *         description: debt_payment_id
 *     responses:
 *       200:
 *         description: Đã xác nhận nộp tiền
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã xác nhận nộp tiền" }
 *                 paymentId: { type: integer }
 *                 debtId: { type: integer }
 *                 driverId: { type: integer, nullable: true }
 *       400:
 *         description: Payment ID không hợp lệ
 *       404:
 *         description: Không tìm thấy yêu cầu nộp tiền
 *       409:
 *         description: Yêu cầu này đã được xử lý
 */

/**
 * @swagger
 * /api/manager/debt-repayments/{paymentId}/reject:
 *   patch:
 *     tags: [Manager]
 *     summary: Từ chối yêu cầu nộp tiền công nợ
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: integer }
 *         description: debt_payment_id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối
 *     responses:
 *       200:
 *         description: Đã từ chối yêu cầu nộp tiền
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã từ chối yêu cầu nộp tiền" }
 *       400:
 *         description: Payment ID không hợp lệ
 *       404:
 *         description: Không tìm thấy yêu cầu nộp tiền
 *       409:
 *         description: Yêu cầu này đã được xử lý
 */

/**
 * @swagger
 * /api/manager/payrolls:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách bảng lương theo tháng/năm kèm thống kê
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *         description: Mặc định tháng hiện tại
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *         description: Mặc định năm hiện tại
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, reviewed, approved, paid] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên driver
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 payrolls:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Payroll' }
 *                 stats:
 *                   type: object
 *                   description: "total_drivers, pending_count, reviewed_count, approved_count, paid_count, total_gross, total_net"
 *                 month: { type: integer }
 *                 year: { type: integer }
 *       400:
 *         description: Trạng thái bảng lương không hợp lệ
 */

/**
 * @swagger
 * /api/manager/payrolls/{id}/review:
 *   patch:
 *     tags: [Manager]
 *     summary: Manager xác nhận bảng lương (pending → reviewed) — sau đó Accountant chi trả
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: payroll_id
 *     responses:
 *       200:
 *         description: Đã xác nhận bảng lương (reviewed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã xác nhận bảng lương (reviewed)." }
 *                 payroll: { $ref: '#/components/schemas/Payroll' }
 *       400:
 *         description: Payroll ID không hợp lệ hoặc trạng thái không phải pending
 *       404:
 *         description: Không tìm thấy phiếu lương
 */

/**
 * @swagger
 * /api/manager/receipt-requests:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách yêu cầu phiếu thu (order_receipt_requests) — Manager xem cùng dữ liệu Coordinator
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, approved, rejected, all] }
 *         description: Lọc theo trạng thái cụ thể (ưu tiên hơn kind nếu có)
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [all, requests, receipts, rejected], default: requests }
 *         description: "requests = pending+processing, receipts = approved, rejected = rejected"
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu/phiếu thu phân trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 requests:
 *                   type: array
 *                   items: { type: object }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 */

/**
 * @swagger
 * /api/manager/expenses:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách chi phí tài xế (Expense) toàn hệ thống, kèm thống kê
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *       - in: query
 *         name: expense_type
 *         schema: { type: string, enum: [toll, parking, etc, fuel, repair] }
 *       - in: query
 *         name: reimbursement_status
 *         schema: { type: string, enum: [pending, reimbursed] }
 *       - in: query
 *         name: month
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên driver, biển số xe, mô tả
 *       - in: query
 *         name: sort
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Expense' }
 *                 total: { type: integer }
 *                 stats:
 *                   type: object
 *                   description: "total_count, pending_count, approved_count, rejected_count, approved_total, reimbursable_total"
 */

/**
 * @swagger
 * /api/manager/expenses/{id}/approve:
 *   patch:
 *     tags: [Manager]
 *     summary: Duyệt chi phí tài xế (song song quyền Coordinator)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: expense_id
 *     responses:
 *       200:
 *         description: Đã duyệt chi phí
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã duyệt chi phí" }
 *                 expense: { $ref: '#/components/schemas/Expense' }
 *       400:
 *         description: Expense ID không hợp lệ
 *       404:
 *         description: Không tìm thấy chi phí
 */

/**
 * @swagger
 * /api/manager/expenses/{id}/reject:
 *   patch:
 *     tags: [Manager]
 *     summary: Từ chối chi phí tài xế
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: expense_id
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối
 *     responses:
 *       200:
 *         description: Đã từ chối chi phí
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã từ chối chi phí" }
 *                 expense: { $ref: '#/components/schemas/Expense' }
 *       400:
 *         description: Expense ID không hợp lệ
 *       404:
 *         description: Không tìm thấy chi phí
 */

/**
 * @swagger
 * /api/manager/vouchers:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách phiếu chi thủ công, kèm thống kê
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected, paid] }
 *       - in: query
 *         name: voucher_type
 *         schema: { type: string, enum: [office, rent, utilities, equipment, entertainment, other] }
 *       - in: query
 *         name: month
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo người nhận, lý do, người tạo
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [oldest, amount-desc, amount-asc, status] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Voucher' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *                 totalPages: { type: integer }
 *                 stats:
 *                   type: object
 *                   description: "total_count, pending_count, approved_count, paid_count, rejected_count, paid_total, awaiting_total"
 */

/**
 * @swagger
 * /api/manager/vouchers/{id}/approve:
 *   patch:
 *     tags: [Manager]
 *     summary: Duyệt phiếu chi thủ công (sau đó Accountant xác nhận đã chi để ghi sổ tài chính)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: voucher_id
 *     responses:
 *       200:
 *         description: Đã duyệt phiếu chi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã duyệt phiếu chi" }
 *                 voucher: { $ref: '#/components/schemas/Voucher' }
 *       400:
 *         description: Voucher ID không hợp lệ
 *       404:
 *         description: Không tìm thấy phiếu chi
 *       409:
 *         description: Phiếu chi đã được xử lý
 */

/**
 * @swagger
 * /api/manager/vouchers/{id}/reject:
 *   patch:
 *     tags: [Manager]
 *     summary: Từ chối phiếu chi thủ công
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: voucher_id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối (bắt buộc)
 *     responses:
 *       200:
 *         description: Đã từ chối phiếu chi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã từ chối phiếu chi" }
 *                 voucher: { $ref: '#/components/schemas/Voucher' }
 *       400:
 *         description: Cần ghi rõ lý do từ chối, hoặc Voucher ID không hợp lệ
 *       404:
 *         description: Không tìm thấy phiếu chi
 */

/**
 * @swagger
 * /api/manager/spending-summary:
 *   get:
 *     tags: [Manager]
 *     summary: Tổng hợp chi từ sổ tài chính (financial_transactions) theo loại và xu hướng 6 tháng
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
 *         schema: { type: integer, minimum: 2020 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 by_type:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event_type: { type: string }
 *                       tx_count: { type: integer }
 *                       total_amount: { type: string }
 *                 trend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       year: { type: integer }
 *                       month: { type: integer }
 *                       total_amount: { type: string }
 *                 grand_total: { type: string }
 *       400:
 *         description: Tháng không hợp lệ (1-12) hoặc năm không hợp lệ
 */

/**
 * @swagger
 * /api/manager/partners:
 *   get:
 *     tags: [Manager]
 *     summary: Danh sách đối tác (Partner), kèm tổng công nợ mỗi đối tác và tổng hợp chung
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm theo tên công ty, tên viết tắt, người liên hệ, SĐT, email, mã số thuế
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Nếu không truyền limit, trả về toàn bộ danh sách (không phân trang)
 *       - in: query
 *         name: hasDebt
 *         schema: { type: string, enum: ["true", "false"] }
 *         description: Lọc đối tác đang còn nợ / không còn nợ
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [name, debt-desc, debt-asc] }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 partners:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Partner' }
 *                 summary:
 *                   type: object
 *                   description: "total_partners, partners_with_debt, total_remaining"
 *                 pagination:
 *                   type: object
 *                   description: Chỉ có khi truyền limit
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     totalPages: { type: integer }
 *   post:
 *     tags: [Manager]
 *     summary: Tạo đối tác mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartnerInput'
 *     responses:
 *       201:
 *         description: Đã tạo đối tác mới
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã tạo đối tác mới" }
 *                 partner: { $ref: '#/components/schemas/Partner' }
 *       400:
 *         description: "Tên đối tác là bắt buộc, hoặc hạn thanh toán không hợp lệ"
 */

/**
 * @swagger
 * /api/manager/partners/{id}:
 *   put:
 *     tags: [Manager]
 *     summary: Cập nhật đối tác
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: partner_id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PartnerInput'
 *     responses:
 *       200:
 *         description: Đã cập nhật đối tác
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Đã cập nhật đối tác" }
 *                 partner: { $ref: '#/components/schemas/Partner' }
 *       400:
 *         description: "Partner ID không hợp lệ, tên đối tác là bắt buộc, hoặc hạn thanh toán không hợp lệ"
 *       404:
 *         description: Đối tác không tồn tại
 */

/**
 * @swagger
 * /api/manager/partners/{id}/debts:
 *   get:
 *     tags: [Manager]
 *     summary: Chi tiết công nợ của một đối tác
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: partner_id
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 partner: { $ref: '#/components/schemas/Partner' }
 *                 debts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       order_id: { type: integer, nullable: true }
 *                       shipment_id: { type: integer, nullable: true }
 *                       total_amount: { type: string }
 *                       paid_amount: { type: string }
 *                       remaining: { type: string }
 *                       status: { type: string, enum: [paid, partial, unpaid] }
 *                       due_date: { type: string, format: date, nullable: true }
 *                       notes: { type: string, nullable: true }
 *                       created_at: { type: string, format: date-time }
 *                       cargo_name: { type: string, nullable: true }
 *                       customer_name: { type: string, nullable: true }
 *                       customer_company: { type: string, nullable: true }
 *       400:
 *         description: Partner ID không hợp lệ
 *       404:
 *         description: Đối tác không tồn tại
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SalaryAdvance:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         driver_id: { type: integer }
 *         amount: { type: string, example: "2000000.00" }
 *         reason: { type: string, nullable: true }
 *         request_month: { type: integer }
 *         request_year: { type: integer }
 *         status: { type: string, enum: [pending, approved, rejected, paid] }
 *         reject_reason: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         approved_at: { type: string, format: date-time, nullable: true }
 *         driver_name: { type: string }
 *         driver_phone: { type: string, nullable: true }
 *         driver_email: { type: string, nullable: true }
 *
 *     PendingDebtRepayment:
 *       type: object
 *       properties:
 *         id: { type: integer, description: debt_payment_id }
 *         debt_id: { type: integer }
 *         amount: { type: string }
 *         payment_method: { type: string, enum: [cash, bank_transfer, offset] }
 *         receipt_url: { type: string, nullable: true }
 *         notes: { type: string, nullable: true }
 *         paid_at: { type: string, format: date-time }
 *         created_at: { type: string, format: date-time }
 *         total_amount: { type: string, description: Tổng khoản nợ gốc }
 *         driver_id: { type: integer, description: Với nợ khách hàng, đây là customer_id }
 *         driver_name: { type: string }
 *         cargo_name: { type: string, nullable: true }
 *         debt_type: { type: string, enum: [driver, customer] }
 *
 *     Payroll:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         driver_id: { type: integer }
 *         payroll_month: { type: integer }
 *         payroll_year: { type: integer }
 *         base_salary: { type: string }
 *         months_of_service: { type: integer }
 *         total_revenue: { type: string }
 *         revenue_share_pct: { type: string }
 *         revenue_bonus: { type: string }
 *         kpi_bonus: { type: string }
 *         top_driver_bonus: { type: string }
 *         overtime_bonus: { type: string }
 *         other_bonus: { type: string }
 *         insurance_employee: { type: string }
 *         driver_debt_deduction: { type: string }
 *         advance_deduction: { type: string }
 *         absence_penalty: { type: string }
 *         other_deduction: { type: string }
 *         expense_reimbursement: { type: string }
 *         gross_salary: { type: string }
 *         net_salary: { type: string }
 *         status: { type: string, enum: [pending, reviewed, approved, paid] }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         approved_at: { type: string, format: date-time, nullable: true }
 *         paid_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         driver_name: { type: string }
 *         driver_phone: { type: string, nullable: true }
 *         vehicle_group_id: { type: integer, nullable: true }
 *         vehicle_group: { type: string }
 *         plate_number: { type: string }
 *
 *     Expense:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         shipment_id: { type: integer, nullable: true }
 *         expense_type: { type: string, enum: [toll, parking, etc, fuel, repair] }
 *         amount: { type: string }
 *         description: { type: string, nullable: true }
 *         expense_date: { type: string, format: date }
 *         status: { type: string, enum: [pending, approved, rejected] }
 *         reject_reason: { type: string, nullable: true }
 *         reviewed_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         reimbursement_status: { type: string, enum: [pending, reimbursed] }
 *         reimbursed_at: { type: string, format: date-time, nullable: true }
 *         driver_name: { type: string }
 *         driver_phone: { type: string, nullable: true }
 *         vehicle_plate: { type: string, nullable: true }
 *         reviewed_by_name: { type: string, nullable: true }
 *         receipt_urls:
 *           type: array
 *           items: { type: string }
 *
 *     Voucher:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         voucher_type: { type: string, enum: [office, rent, utilities, equipment, entertainment, other] }
 *         amount: { type: string }
 *         payee: { type: string }
 *         reason: { type: string }
 *         payment_method: { type: string, enum: [cash, bank_transfer] }
 *         proof_url: { type: string, nullable: true }
 *         status: { type: string, enum: [pending, approved, rejected, paid] }
 *         rejection_reason: { type: string, nullable: true }
 *         created_by: { type: integer }
 *         approved_by: { type: integer, nullable: true }
 *         paid_by: { type: integer, nullable: true }
 *         approved_at: { type: string, format: date-time, nullable: true }
 *         paid_at: { type: string, format: date-time, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *         created_by_name: { type: string }
 *         approved_by_name: { type: string, nullable: true }
 *         paid_by_name: { type: string, nullable: true }
 *
 *     Partner:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         company_name: { type: string }
 *         short_name: { type: string, nullable: true }
 *         contact_person: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         tax_code: { type: string, nullable: true }
 *         business_registration_number: { type: string, nullable: true }
 *         payment_term_days: { type: integer, nullable: true }
 *         bank_name: { type: string, nullable: true }
 *         bank_account_number: { type: string, nullable: true }
 *         bank_account_name: { type: string, nullable: true }
 *         notes: { type: string, nullable: true }
 *         created_at: { type: string, format: date-time }
 *         debt_count: { type: integer, description: Chỉ có trong danh sách }
 *         total_amount: { type: string, description: Chỉ có trong danh sách }
 *         total_paid: { type: string, description: Chỉ có trong danh sách }
 *         total_remaining: { type: string, description: Chỉ có trong danh sách }
 *         earliest_due_date: { type: string, format: date, nullable: true }
 *         latest_debt_at: { type: string, format: date-time, nullable: true }
 *
 *     PartnerInput:
 *       type: object
 *       required: [company_name]
 *       properties:
 *         company_name: { type: string }
 *         short_name: { type: string }
 *         contact_person: { type: string }
 *         phone: { type: string }
 *         email: { type: string }
 *         address: { type: string }
 *         tax_code: { type: string }
 *         business_registration_number: { type: string }
 *         payment_term_days: { type: integer, minimum: 0, maximum: 365 }
 *         bank_name: { type: string }
 *         bank_account_number: { type: string }
 *         bank_account_name: { type: string }
 *         notes: { type: string }
 */
