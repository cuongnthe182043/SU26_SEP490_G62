/**
 * @swagger
 * tags:
 *   name: Coordinator
 *   description: Nghiệp vụ điều phối (Coordinator only)
 */

/**
 * @swagger
 * /api/coordinator/import-excel:
 *   post:
 *     tags: [Coordinator]
 *     summary: Import danh sách orders từ file Excel
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
 *                 description: File Excel (.xlsx / .xls)
 *     responses:
 *       200:
 *         description: Import thành công, trả về số bản ghi đã tạo
 *       422:
 *         description: File không đúng định dạng hoặc dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền (chỉ Coordinator)
 */
