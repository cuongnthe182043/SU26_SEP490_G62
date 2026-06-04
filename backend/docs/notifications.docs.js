/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Thông báo in-app của user hiện tại
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Danh sách thông báo của user hiện tại
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Danh sách thông báo (mới nhất trước)
 */

/**
 * @swagger
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Đánh dấu tất cả thông báo là đã đọc
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đã đánh dấu tất cả đã đọc
 */

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Chi tiết một thông báo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Chi tiết thông báo
 *       404:
 *         description: Không tìm thấy
 */

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Đánh dấu một thông báo là đã đọc
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Đã đánh dấu đã đọc
 *       404:
 *         description: Không tìm thấy
 */
