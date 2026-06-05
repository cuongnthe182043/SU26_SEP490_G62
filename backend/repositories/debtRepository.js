const pool = require('../config/database');

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
            os.id   AS shipment_id,
            o.id    AS order_id,
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

// Driver nộp tiền về công ty (remittance) — nhiều lần được (§16, BR-020)
const remitDebt = async (debtId, driverId, { amount, paymentMethod, notes }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const debtRes = await client.query(
            `SELECT d.* FROM debts d
             WHERE d.id = $1 AND d.debt_type = 'driver' AND d.driver_id = $2
             FOR UPDATE`,
            [debtId, driverId],
        );
        if (!debtRes.rows[0]) throw new Error('Khoản nợ không tồn tại hoặc không thuộc về bạn');
        const debt = debtRes.rows[0];

        if (debt.status === 'paid') throw new Error('Khoản nợ này đã thanh toán đầy đủ');

        const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
        if (Number(amount) > remaining) {
            throw new Error(`Số tiền nộp (${amount}) vượt quá khoản còn nợ (${remaining})`);
        }

        const newPaid   = Number(debt.paid_amount) + Number(amount);
        const newStatus = newPaid >= Number(debt.total_amount) ? 'paid' : 'partial';

        await client.query(
            `INSERT INTO debt_payments (debt_id, amount, payment_method, created_by, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [debtId, amount, paymentMethod ?? 'cash', driverId, notes ?? null],
        );

        const updated = await client.query(
            `UPDATE debts
             SET paid_amount = $1, status = $2, updated_by = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [newPaid, newStatus, driverId, debtId],
        );

        await client.query('COMMIT');
        return updated.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Tổng nợ còn lại của driver (dùng cho dashboard)
const getDriverDebtSummary = async (driverId) => {
    const result = await pool.query(
        `SELECT
            COUNT(*)   FILTER (WHERE status <> 'paid')                 AS open_count,
            COALESCE(SUM(total_amount - paid_amount), 0)::text         AS total_remaining,
            COALESCE(SUM(total_amount - paid_amount)
                FILTER (WHERE status = 'overdue'), 0)::text            AS overdue_remaining
         FROM debts
         WHERE debt_type = 'driver' AND driver_id = $1`,
        [driverId],
    );
    return result.rows[0];
};

module.exports = { getDriverDebts, remitDebt, getDriverDebtSummary };
