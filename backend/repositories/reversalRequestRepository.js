const pool = require('../config/database');

/**
 * Yêu cầu hoàn tác tầng 2 — chỉ lưu trữ, không quyết định gì.
 * Luật ai được xin / ai được duyệt nằm ở reversalService.
 */

const SELECT_COLS = `
    rr.id, rr.kind, rr.entity_type, rr.entity_id, rr.reason, rr.status,
    rr.requested_by, rr.requested_at,
    rr.decided_by, rr.decided_at, rr.decision_note,
    rr.executed_at, rr.execution_error,
    pr.full_name AS requested_by_name,
    pd.full_name AS decided_by_name
`;

const FROM_JOIN = `
    FROM reversal_requests rr
    LEFT JOIN profiles pr ON pr.id = rr.requested_by
    LEFT JOIN profiles pd ON pd.id = rr.decided_by
`;

const create = async ({ kind, entityType, entityId, reason, requestedBy }) => {
    try {
        const { rows: [row] } = await pool.query(
            `INSERT INTO reversal_requests (kind, entity_type, entity_id, reason, requested_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [kind, entityType, entityId, reason, requestedBy],
        );
        return getById(row.id);
    } catch (err) {
        // Chỉ số uq_reversal_requests_pending chặn hai yêu cầu chờ trên cùng một đối
        // tượng. Đây là va chạm bình thường (người dùng bấm lại vì sốt ruột), không
        // phải lỗi hệ thống — dịch sang thông báo người đọc hiểu được.
        if (err.code === '23505' && String(err.constraint ?? '').includes('pending')) {
            throw new Error('DUPLICATE:Đối tượng này đã có một yêu cầu hoàn tác đang chờ duyệt');
        }
        throw err;
    }
};

const getById = async (id) => {
    const { rows: [row] } = await pool.query(
        `SELECT ${SELECT_COLS} ${FROM_JOIN} WHERE rr.id = $1`, [id]);
    return row ?? null;
};

const listPending = async () => {
    const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} ${FROM_JOIN}
         WHERE rr.status = 'pending'
         ORDER BY rr.requested_at ASC`);
    return rows;
};

const listByRequester = async (profileId, { limit = 30 } = {}) => {
    const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} ${FROM_JOIN}
         WHERE rr.requested_by = $1
         ORDER BY rr.requested_at DESC
         LIMIT $2`,
        [profileId, limit],
    );
    return rows;
};

/**
 * Chốt quyết định. `AND status = 'pending'` là chốt chặn thật: hai quản lý cùng mở màn
 * duyệt và cùng bấm thì người sau không ghi đè được quyết định của người trước.
 */
const decide = async (id, { status, decidedBy, note = null }) => {
    const { rows: [row] } = await pool.query(
        `UPDATE reversal_requests
         SET status = $2, decided_by = $3, decided_at = NOW(), decision_note = $4
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [id, status, decidedBy, note],
    );
    if (!row) return null;
    return getById(id);
};

/** Ghi kết quả thực thi sau khi đã duyệt — thành công hay vì sao không lùi được. */
const markExecuted = async (id, { error = null } = {}) => {
    const { rows: [row] } = await pool.query(
        `UPDATE reversal_requests
         SET executed_at = NOW(), execution_error = $2
         WHERE id = $1
         RETURNING id`,
        [id, error],
    );
    if (!row) return null;
    return getById(id);
};

/** Người xin tự rút lại khi chưa ai duyệt. */
const cancelOwn = async (id, requestedBy) => {
    const { rows: [row] } = await pool.query(
        `UPDATE reversal_requests
         SET status = 'cancelled', decided_by = $2, decided_at = NOW(),
             decision_note = 'Người gửi tự rút lại'
         WHERE id = $1 AND requested_by = $2 AND status = 'pending'
         RETURNING id`,
        [id, requestedBy],
    );
    if (!row) return null;
    return getById(id);
};

module.exports = {
    create, getById, listPending, listByRequester, decide, markExecuted, cancelOwn,
};
