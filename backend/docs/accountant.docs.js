/**
 * @swagger
 * tags:
 *   name: Accountant
 *   description: Nghiệp vụ kế toán — thống kê tài chính, quản lý đơn hàng và thanh toán
 */

/**
 * @swagger
 * /accountant/finance/stats:
 *   get:
 *     tags: [Accountant]
 *     summary: Thống kê tài chính tổng quan (doanh thu, công nợ, chi phí)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date, example: "2025-06-01" }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date, example: "2025-06-30" }
 *     responses:
 *       200:
 *         description: Tổng doanh thu, tổng chi phí, tổng công nợ, số đơn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_revenue:      { type: string, example: "150000000.00" }
 *                 total_expense:      { type: string, example: "8500000.00" }
 *                 total_customer_debt: { type: string, example: "12000000.00" }
 *                 total_driver_debt:  { type: string, example: "3000000.00" }
 *                 order_count:        { type: integer, example: 42 }
 *                 completed_count:    { type: integer, example: 38 }
 *       403:
 *         description: Không có quyền (chỉ Accountant)
 */

/**
 * @swagger
 * /accountant/orders:
 *   get:
 *     tags: [Accountant]
 *     summary: Danh sách orders kèm trạng thái thanh toán (phân trang)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [unpaid, partial, paid]
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Danh sách orders kèm tổng tiền, đã thanh toán, còn nợ
 *       403:
 *         description: Không có quyền
 *   post:
 *     tags: [Accountant]
 *     summary: Tạo order mới (kế toán tạo hộ)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, pickup_address, destination_address, vehicle_group]
 *             properties:
 *               customer_id:         { type: integer }
 *               pickup_address:      { type: string }
 *               destination_address: { type: string }
 *               vehicle_group:       { type: string, example: "5m2" }
 *               cargo_note:          { type: string }
 *               total_amount:        { type: number, example: 5000000 }
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high]
 *                 default: normal
 *     responses:
 *       201:
 *         description: Tạo order thành công
 *       422:
 *         description: Dữ liệu không hợp lệ
 */

/**
 * @swagger
 * /accountant/orders/import:
 *   post:
 *     tags: [Accountant]
 *     summary: Import hàng loạt orders từ file Excel
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File .xlsx theo template chuẩn
 *     responses:
 *       200:
 *         description: Kết quả import
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success_count: { type: integer }
 *                 failed_rows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:    { type: integer }
 *                       reason: { type: string }
 *       422:
 *         description: File không đúng định dạng hoặc thiếu cột bắt buộc
 */

/**
 * @swagger
 * /accountant/orders/{id}/payments:
 *   get:
 *     tags: [Accountant]
 *     summary: Lịch sử các lần thanh toán của một order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: order_id
 *     responses:
 *       200:
 *         description: Danh sách payments (số tiền, phương thức, thời gian, người ghi)
 *       404:
 *         description: Không tìm thấy order
 *   post:
 *     tags: [Accountant]
 *     summary: Ghi nhận một khoản thanh toán mới cho order
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
 *             required: [amount, payment_method]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000000
 *               payment_method:
 *                 type: string
 *                 enum: [cash, bank_transfer, offset]
 *               paid_at:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đã ghi nhận, order.paid_amount cập nhật
 *       422:
 *         description: Số tiền vượt quá còn nợ hoặc dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy order
 */
