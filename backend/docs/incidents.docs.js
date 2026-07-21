/**
 * @swagger
 * tags:
 *   name: Incidents
 *   description: Báo cáo và theo dõi sự cố (Driver tạo, Coordinator/Manager xử lý — BR-023/024/025)
 */

/**
 * @swagger
 * /api/incidents:
 *   post:
 *     tags: [Incidents]
 *     summary: Tạo báo cáo sự cố (Driver)
 *     description: |
 *       Driver không được tự đóng incident (BR-023).
 *       Driver không được tự đổi xe hoặc điều phối driver khác (BR-024/025).
 *       Các loại sự cố: vehicle_breakdown, cargo_damage, road_incident, customer_refusal, traffic_jam, other
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [incident_type, shipment_id, description]
 *             properties:
 *               incident_type:
 *                 type: string
 *                 enum: [vehicle_breakdown, cargo_damage, road_incident, customer_refusal, traffic_jam, other]
 *               shipment_id:
 *                 type: integer
 *               description:
 *                 type: string
 *                 example: Xe bị thủng lốp tại QL1A km 45
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *     responses:
 *       201:
 *         description: Báo cáo sự cố đã được tạo, coordinator nhận notification
 */

/**
 * @swagger
 * /api/incidents/staff:
 *   post:
 *     tags: [Incidents]
 *     summary: Coordinator / Manager tự tạo sự cố
 *     description: |
 *       Dùng khi khách gọi điện báo sự cố, hoặc coordinator/manager phát hiện qua giám sát
 *       (khác với POST /api/incidents — dành cho driver tự báo cáo).
 *       shipment_id có thể để trống nếu sự cố chưa gắn với chuyến cụ thể.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [incidentType, description]
 *             properties:
 *               shipmentId:
 *                 type: integer
 *                 description: Chuyến liên quan (tuỳ chọn)
 *               incidentType:
 *                 type: string
 *                 enum: [vehicle_breakdown, cargo_damage, road_incident, customer_refusal, traffic_jam, other]
 *               severityLevel:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: Tối đa 3 ảnh
 *     responses:
 *       201:
 *         description: Báo cáo sự cố đã được tạo
 *       404:
 *         description: Chuyến không tồn tại
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       409:
 *         description: Đã tồn tại sự cố cùng loại chưa xử lý cho chuyến này
 */

/**
 * @swagger
 * /api/incidents/my:
 *   get:
 *     tags: [Incidents]
 *     summary: Danh sách sự cố của driver hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Danh sách incidents của driver
 */

/**
 * @swagger
 * /api/incidents/my/counts:
 *   get:
 *     tags: [Incidents]
 *     summary: Số lượng sự cố theo trạng thái (dùng cho dashboard)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: open_count, resolved_count, total_count
 */

/**
 * @swagger
 * /api/incidents/shipment/{shipmentId}:
 *   get:
 *     tags: [Incidents]
 *     summary: Danh sách sự cố của một chuyến cụ thể
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shipmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Mảng incidents của chuyến
 */

/**
 * @swagger
 * /api/incidents/{id}:
 *   get:
 *     tags: [Incidents]
 *     summary: Chi tiết sự cố
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết incident kèm lịch sử xử lý
 *       404:
 *         description: Không tìm thấy
 *   patch:
 *     tags: [Incidents]
 *     summary: Cập nhật mô tả sự cố (Driver — chỉ khi chưa resolved)
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
 *               description: { type: string }
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       422:
 *         description: Incident đã resolved, không thể sửa
 */

/**
 * @swagger
 * /api/incidents/{id}/status:
 *   patch:
 *     tags: [Incidents]
 *     summary: Cập nhật trạng thái sự cố (Coordinator / Manager)
 *     description: Driver không được tự đóng incident (BR-023).
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [processing, resolved]
 *               resolution_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       403:
 *         description: Không có quyền
 */
