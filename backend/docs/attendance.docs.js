/**
 * @swagger
 * tags:
 *   name: Attendance
 *   description: Chấm công thủ công (attendance_overrides) — Coordinator/Manager đánh dấu vắng không phép/nửa công cho driver, dùng khi chốt lương và tính thưởng Tết
 */

/**
 * @swagger
 * /api/attendance/grid:
 *   get:
 *     tags: [Attendance]
 *     summary: Lưới chấm công theo tháng của toàn bộ driver (Coordinator, Manager)
 *     description: >
 *       Gộp attendance_overrides (đánh dấu thủ công) + leave_requests (đơn nghỉ đã duyệt) thành
 *       trạng thái hiệu lực cho từng ngày của từng driver trong tháng. Nếu không có override và
 *       không có đơn nghỉ, mặc định là 'present'.
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
 *         schema: { type: integer, minimum: 2020, maximum: 2100 }
 *       - in: query
 *         name: driver_id
 *         schema: { type: integer }
 *         description: Lọc theo 1 driver (tuỳ chọn)
 *       - in: query
 *         name: vehicle_group_id
 *         schema: { type: integer }
 *         description: Lọc theo nhóm xe (tuỳ chọn)
 *     responses:
 *       200:
 *         description: Lưới chấm công theo tháng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 drivers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       driver_id:          { type: integer }
 *                       full_name:          { type: string }
 *                       plate_number:       { type: string, nullable: true }
 *                       vehicle_group_name: { type: string, nullable: true }
 *                       days:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             work_date:         { type: string, format: date }
 *                             status:
 *                               type: string
 *                               enum: [present, leave_paid, leave_unpaid, absent_unexcused, half_day]
 *                             status_label:      { type: string }
 *                             override_id:       { type: integer, nullable: true }
 *                             override_notes:    { type: string, nullable: true }
 *                             leave_request_id:  { type: integer, nullable: true }
 *                             editable:          { type: boolean }
 *                       summary:
 *                         type: object
 *                         description: Số ngày trong tháng theo từng trạng thái
 *                         properties:
 *                           present:          { type: integer }
 *                           leave_paid:       { type: integer }
 *                           leave_unpaid:     { type: integer }
 *                           absent_unexcused: { type: integer }
 *                           half_day:         { type: integer }
 *                 status_labels:
 *                   type: object
 *                   description: Nhãn tiếng Việt cho từng mã trạng thái
 *                   additionalProperties: { type: string }
 *       400:
 *         description: Tháng hoặc năm không hợp lệ
 */

/**
 * @swagger
 * /api/attendance:
 *   post:
 *     tags: [Attendance]
 *     summary: Đánh dấu chấm công thủ công cho một driver trong một ngày (Coordinator, Manager)
 *     description: >
 *       Chỉ cho phép đánh dấu 3 trạng thái: present (có mặt, dùng để ghi đè), absent_unexcused
 *       (vắng không phép), half_day (nửa công — tính 0.5 công khi chốt lương). Không cho chấm
 *       công ngày trong tương lai. Nếu ngày đó driver đã có đơn nghỉ được duyệt (leave_requests),
 *       không được đánh dấu absent_unexcused/half_day — phải đánh dấu 'present' để ghi đè trước.
 *       Dùng UPSERT theo (driver_id, work_date) — gọi lại sẽ cập nhật bản ghi cũ.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, work_date, status]
 *             properties:
 *               driver_id: { type: integer, example: 12 }
 *               work_date: { type: string, format: date, example: "2026-07-15" }
 *               status:
 *                 type: string
 *                 enum: [present, absent_unexcused, half_day]
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Đã chấm công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 record:
 *                   $ref: '#/components/schemas/AttendanceOverride'
 *       400:
 *         description: Thiếu driver_id/work_date, trạng thái không hợp lệ, ngày trong tương lai, hoặc ngày đã có đơn nghỉ được duyệt
 */

/**
 * @swagger
 * /api/attendance/{driverId}/{workDate}:
 *   delete:
 *     tags: [Attendance]
 *     summary: Xoá đánh dấu chấm công thủ công, quay lại trạng thái mặc định (Coordinator, Manager)
 *     description: Quay lại suy luận mặc định từ leave_requests (nếu có) hoặc 'present'.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: workDate
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Đã xoá đánh dấu chấm công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *       404:
 *         description: Không tìm thấy đánh dấu chấm công để xoá
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AttendanceOverride:
 *       type: object
 *       properties:
 *         id:         { type: integer }
 *         driver_id:  { type: integer }
 *         work_date:  { type: string, format: date }
 *         status:
 *           type: string
 *           enum: [present, absent_unexcused, half_day]
 *         notes:      { type: string, nullable: true }
 *         marked_by:  { type: integer }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 */
