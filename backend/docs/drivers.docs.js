/**
 * @swagger
 * tags:
 *   name: Drivers
 *   description: Quản lý tài xế (Coordinator / Admin)
 */

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     tags: [Drivers]
 *     summary: Danh sách tất cả tài xế
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng driver profiles
 *       403:
 *         description: Không có quyền (chỉ Coordinator / Admin)
 */
