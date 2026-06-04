const pool = require('../config/database');

const mapRow = (row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    message: row.body ?? '',
    type: row.type,
    target_id: row.entity_id,
    entity_type: row.entity_type,
    is_read: row.is_read,
    created_at: row.created_at,
});

const createNotification = async ({
    userId,
    title,
    message,
    type = 'SYSTEM_ALERT',
    entityType = null,
    entityId = null,
}) => {
    const result = await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, title, message ?? null, type, entityType, entityId],
    );
    return mapRow(result.rows[0]);
};

const listByUser = async (userId, { limit = 50, offset = 0 } = {}) => {
    const result = await pool.query(
        `SELECT *
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset],
    );
    return result.rows.map(mapRow);
};

const countUnread = async (userId) => {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
};

const markAsRead = async (userId, notificationId) => {
    const result = await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [notificationId, userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
};

const markAllAsRead = async (userId) => {
    await pool.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId],
    );
};

const countAll = async (userId) => {
    const result = await pool.query(
        `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`,
        [userId],
    );
    return Number(result.rows[0]?.count ?? 0);
};

const getById = async (userId, notificationId) => {
    const result = await pool.query(
        `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
        [notificationId, userId],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
};

module.exports = {
    createNotification,
    listByUser,
    countUnread,
    countAll,
    markAsRead,
    markAllAsRead,
    getById,
};
