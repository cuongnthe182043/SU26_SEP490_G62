const pool = require('../config/database');

// ─── Driver: danh sách công nợ (chỉ xem, không tự tạo/nộp) ──────────────────

const getDriverDebts = async (driverId, { status = null } = {}) => {
    const params = [driverId];
    let where = `WHERE d.debt_type = 'driver' AND d.driver_id = $1`;
    if (status) { params.push(status); where += ` AND d.status = $${params.length}`; }

    const result = await pool.query(
        `SELECT
            d.id,
            d.total_amount::text,
            d.paid_amount::text,
            (d.total_amount - d.paid_amount)::text AS remaining,
            d.status,
            d.due_date,
            d.notes,
            d.created_at,
            d.updated_at,
            os.id        AS shipment_id,
            os.trip_code,
            o.id         AS order_id,
            o.cargo_name
         FROM debts d
         LEFT JOIN order_shipments os ON os.id = d.shipment_id
         LEFT JOIN orders o            ON o.id  = d.order_id
         ${where}
         ORDER BY d.created_at DESC`,
        params,
    );
    return result.rows;
};

// ─── Driver: lịch sử thanh toán của 1 khoản nợ (kế toán ghi, driver chỉ xem) ─

const getDebtPayments = async (debtId, driverId) => {
    const result = await pool.query(
        `SELECT
            dp.id,
            dp.amount::text,
            dp.payment_method,
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

// ─── Driver: tổng quan công nợ (dashboard) ────────────────────────────────────

const getDriverDebtSummary = async (driverId) => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE d.status <> 'paid')              AS open_count,
            COALESCE(SUM(d.total_amount - d.paid_amount), 0)::text  AS total_remaining,
            COALESCE(SUM(d.total_amount - d.paid_amount)
                FILTER (WHERE d.status = 'overdue'), 0)::text       AS overdue_remaining
         FROM debts d
         WHERE d.debt_type = 'driver' AND d.driver_id = $1`,
        [driverId],
    );
    return result.rows[0];
};

module.exports = { getDriverDebts, getDebtPayments, getDriverDebtSummary };
