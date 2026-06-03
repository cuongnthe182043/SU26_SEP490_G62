const pool = require('../config/database');

// ─── Create ───────────────────────────────────────────────────────────────────

const createIncident = async ({ shipmentId, reportedBy, incidentType, severityLevel, description, location }) => {
    const result = await pool.query(
        `INSERT INTO incidents
            (shipment_id, reported_by, incident_type, severity_level, description, location)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [shipmentId, reportedBy, incidentType, severityLevel, description, location ?? null],
    );
    return result.rows[0];
};

const addIncidentEvidence = async (incidentId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO incident_evidences (incident_id, file_url)
         VALUES ($1, $2)
         RETURNING *`,
        [incidentId, fileUrl],
    );
    return result.rows[0];
};

// ─── Read ─────────────────────────────────────────────────────────────────────

const getIncidentById = async (incidentId) => {
    const result = await pool.query(
        `SELECT
            i.*,
            COALESCE(
                json_agg(ie.file_url ORDER BY ie.uploaded_at)
                FILTER (WHERE ie.id IS NOT NULL),
                '[]'::json
            ) AS image_urls
         FROM incidents i
         LEFT JOIN incident_evidences ie ON ie.incident_id = i.id
         WHERE i.id = $1
         GROUP BY i.id`,
        [incidentId],
    );
    return result.rows[0] ?? null;
};

const getIncidentsByDriver = async (driverId, { limit = 20, offset = 0 } = {}) => {
    const [rows, countRow] = await Promise.all([
        pool.query(
            `SELECT
                i.id,
                i.shipment_id,
                i.incident_type,
                i.severity_level,
                i.description,
                i.location,
                i.status,
                i.occurred_at,
                i.resolved_at,
                i.created_at,
                COALESCE(
                    json_agg(ie.file_url ORDER BY ie.uploaded_at)
                    FILTER (WHERE ie.id IS NOT NULL),
                    '[]'::json
                ) AS image_urls
             FROM incidents i
             LEFT JOIN incident_evidences ie ON ie.incident_id = i.id
             WHERE i.reported_by = $1
             GROUP BY i.id
             ORDER BY i.created_at DESC
             LIMIT $2 OFFSET $3`,
            [driverId, limit, offset],
        ),
        pool.query(
            `SELECT COUNT(*) FROM incidents WHERE reported_by = $1`,
            [driverId],
        ),
    ]);
    return { rows: rows.rows, total: Number(countRow.rows[0].count) };
};

// ─── Notification helpers ─────────────────────────────────────────────────────

const getCoordinatorIds = async () => {
    const result = await pool.query(
        `SELECT p.id
         FROM profiles p
         JOIN roles r ON r.id = p.role_id
         WHERE r.name = 'coordinator'`,
    );
    return result.rows.map((r) => r.id);
};

const insertNotifications = async (userIds, { title, body, entityId }) => {
    if (!userIds.length) return;
    const placeholders = userIds.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ');
    const values = userIds.flatMap((uid) => [uid, title, body, 'incident_reported', entityId]);
    await pool.query(
        `INSERT INTO notifications (user_id, title, body, type, entity_id) VALUES ${placeholders}`,
        values,
    );
};

module.exports = {
    createIncident,
    addIncidentEvidence,
    getIncidentById,
    getIncidentsByDriver,
    getCoordinatorIds,
    insertNotifications,
};
