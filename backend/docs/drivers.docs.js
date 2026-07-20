/**
 * @swagger
 * tags:
 *   name: Drivers
 *   description: Thông tin tài xế và bảo dưỡng xe
 */

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     tags: [Drivers]
 *     summary: Danh sách tất cả tài xế (Coordinator / Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng driver profiles kèm thông tin xe
 *       403:
 *         description: Không có quyền (chỉ Coordinator / Admin)
 */

/**
 * @swagger
 * /api/drivers/me/vehicle:
 *   get:
 *     tags: [Drivers]
 *     summary: Thông tin xe của driver hiện tại (Driver only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin xe gắn với driver (vehicle_group, license_plate, ...)
 *       404:
 *         description: Driver chưa được phân công xe
 */

/**
 * @swagger
 * /api/drivers/me/assignment-history:
 *   get:
 *     tags: [Drivers]
 *     summary: Lịch sử phân công xe của driver hiện tại (Driver only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng lịch sử phân công / hủy phân công xe (mới nhất trước)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:                 { type: integer }
 *                       action:             { type: string, example: assign }
 *                       note:               { type: string, nullable: true }
 *                       created_at:         { type: string, format: date-time }
 *                       vehicle_id:         { type: integer }
 *                       plate_number:       { type: string }
 *                       brand:              { type: string }
 *                       model:              { type: string }
 *                       vehicle_group_name: { type: string }
 *                       created_by:         { type: integer }
 *                       created_by_name:    { type: string }
 */

/**
 * @swagger
 * /api/drivers/maintenance/request:
 *   post:
 *     tags: [Drivers]
 *     summary: Gửi yêu cầu bảo dưỡng xe (Driver only)
 *     description: |
 *       Driver gửi yêu cầu bảo dưỡng xe đang gắn với mình. Yêu cầu ở status = requested,
 *       chờ Manager duyệt (chuyển open + xe sang MAINTENANCE) hoặc từ chối kèm lý do
 *       (mục 3 — Maintenance). Không cho gửi mới nếu xe đang có yêu cầu/đợt bảo dưỡng
 *       chưa hoàn tất.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [maintenance_type, reason]
 *             properties:
 *               maintenance_type:
 *                 type: string
 *                 enum: [scheduled, repair, inspection, emergency]
 *               reason:
 *                 type: string
 *                 description: Lý do yêu cầu bảo dưỡng (bắt buộc)
 *               bills:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Ảnh hóa đơn / chứng từ liên quan (tối đa 5 ảnh, tuỳ chọn)
 *     responses:
 *       201:
 *         description: Đã gửi yêu cầu bảo dưỡng — chờ quản lý duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:             { type: string, example: Đã gửi yêu cầu bảo dưỡng. Chờ quản lý duyệt. }
 *                 maintenanceRecordId: { type: integer }
 *       400:
 *         description: Loại bảo dưỡng không hợp lệ hoặc thiếu lý do
 *       404:
 *         description: Driver chưa được phân công xe
 *       409:
 *         description: Xe đang có yêu cầu hoặc đợt bảo dưỡng chưa hoàn tất
 */

/**
 * @swagger
 * /api/drivers/maintenance:
 *   get:
 *     tags: [Drivers]
 *     summary: Danh sách lịch bảo dưỡng của xe gắn với driver hiện tại (Driver only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng maintenance records
 */

/**
 * @swagger
 * /api/drivers/maintenance/{vehicleId}/bills:
 *   post:
 *     tags: [Drivers]
 *     summary: Upload ảnh hóa đơn bảo dưỡng (Driver only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [bill]
 *             properties:
 *               bill:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh hóa đơn bảo dưỡng
 *     responses:
 *       200:
 *         description: Đã upload hóa đơn
 */

/**
 * @swagger
 * /api/drivers/maintenance/{vehicleId}/complete:
 *   post:
 *     tags: [Drivers]
 *     summary: Driver báo hoàn tất bảo dưỡng — chờ coordinator xác nhận
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Đánh dấu ready for verification — coordinator sẽ kiểm tra
 */
