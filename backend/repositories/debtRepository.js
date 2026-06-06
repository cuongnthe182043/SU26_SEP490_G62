const pool = require('../config/database');

// ─── Driver: danh sách công nợ của mình ───────────────────────────────────────
// Trả thêm:
//   pending_amount  — tổng các khoản đã báo nộp, chờ kế toán xác nhận
//   net_remaining   — số tiền còn cần báo nộp (remaining - pending)

const getDriverDebts = async (driverId, { status = null } = {}) => {
    const params = [driverId];
    let where = `WHERE d.debt_type = 'driver' AND d.driver_id = $1`;
    if (status) { params.push(status); where += ` AND d.status = $${params.length}`; }

    const result = await pool.query(
        `SELECT
            d.id,
            d.total_amount::text,
            d.paid_amount::text,
            (d.total_amount - d.paid_amount)::text              AS remaining,
            COALESCE(pend.total_pending, 0)::text               AS pending_amount,
            GREATEST(d.total_amount - d.paid_amount
                     - COALESCE(pend.total_pending, 0), 0)::text AS net_remaining,
            d.status,
            d.due_date,
            d.notes,
            d.created_at,
            d.updated_at,
            os.id        AS shipment_id,
            o.id         AS order_id,
            o.cargo_name
         FROM debts d
         LEFT JOIN order_shipments os ON os.id = d.shipment_id
         LEFT JOIN orders o            ON o.id  = d.order_id
         LEFT JOIN (
             SELECT debt_id, SUM(amount) AS total_pending
             FROM debt_payments
             WHERE status = 'pending'
             GROUP BY debt_id
         ) pend ON pend.debt_id = d.id
         ${where}
         ORDER BY d.created_at DESC`,
        params,
    );
    return result.rows;
};

// ─── Driver: lịch sử nộp tiền của 1 khoản nợ ─────────────────────────────────

const getDebtPayments = async (debtId, driverId) => {
    const result = await pool.query(
        `SELECT
            dp.id,
            dp.amount::text,
            dp.payment_method,
            dp.status,
            dp.paid_at,
            dp.notes
         FROM debt_payments dp
         JOIN debts d ON d.id = dp.debt_id
         WHERE dp.debt_id = $1
           AND d.driver_id = $2
           AND d.debt_type = 'driver'
         ORDER BY dp.paid_at DESC`,
        [debtId, driverId],
    );
    return result.rows;
};

// ─── Driver: báo nộp tiền — tạo bản ghi pending, chờ kế toán xác nhận ────────
// Flow: driver báo → kế toán confirm → debt.paid_amount được cập nhật (BR-020)
// Validation: amount <= net_remaining (remaining - pending đang chờ)

const remitDebt = async (debtId, driverId, { amount, paymentMethod, notes }) => {
    const debtRes = await pool.query(
        `SELECT d.* FROM debts d
         WHERE d.id = $1 AND d.debt_type = 'driver' AND d.driver_id = $2`,
        [debtId, driverId],
    );
    if (!debtRes.rows[0]) throw new Error('Khoản nợ không tồn tại hoặc không thuộc về bạn');
    const debt = debtRes.rows[0];

    if (debt.status === 'paid') throw new Error('Khoản nợ này đã thanh toán đầy đủ');

    const pendingRes = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_pending
         FROM debt_payments WHERE debt_id = $1 AND status = 'pending'`,
        [debtId],
    );
    const netRemaining = Number(debt.total_amount)
        - Number(debt.paid_amount)
        - Number(pendingRes.rows[0].total_pending);

    if (Number(amount) > netRemaining) {
        throw new Error(
            `Số tiền nộp (${amount}) vượt quá số tiền còn cần nộp (${netRemaining.toFixed(0)})`,
        );
    }

    const result = await pool.query(
        `INSERT INTO debt_payments
            (debt_id, amount, payment_method, status, created_by, notes)
         VALUES ($1, $2, $3, 'pending', $4, $5)
         RETURNING *`,
        [debtId, amount, paymentMethod ?? 'cash', driverId, notes ?? null],
    );
    return result.rows[0];
};

// ─── Driver: tổng quan nợ (dùng cho dashboard + màn hình nợ) ─────────────────

const getDriverDebtSummary = async (driverId) => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE d.status <> 'paid')              AS open_count,
            COALESCE(SUM(d.total_amount - d.paid_amount), 0)::text  AS total_remaining,
            COALESCE(SUM(d.total_amount - d.paid_amount)
                FILTER (WHERE d.status = 'overdue'), 0)::text       AS overdue_remaining,
            COALESCE((
                SELECT SUM(dp.amount)
                FROM debt_payments dp
                JOIN debts d2 ON d2.id = dp.debt_id
                WHERE d2.driver_id = $1
                  AND d2.debt_type = 'driver'
                  AND dp.status = 'pending'
            ), 0)::text                                              AS total_pending
         FROM debts d
         WHERE d.debt_type = 'driver' AND d.driver_id = $1`,
        [driverId],
    );
    return result.rows[0];
};

module.exports = {
    getDriverDebts,
    getDebtPayments,
    remitDebt,
    getDriverDebtSummary,
};
