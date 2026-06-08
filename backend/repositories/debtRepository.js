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

// ─── Driver: lịch sử thanh toán của 1 khoản nợ ───────────────────────────────

const getDebtPayments = async (debtId, driverId) => {
    const result = await pool.query(
        `SELECT
            dp.id,
            dp.amount::text,
            dp.payment_method,
            dp.status,
            dp.receipt_url,
            dp.reject_reason,
            dp.paid_at,
            dp.confirmed_at,
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

// ─── Driver: gửi yêu cầu nộp tiền về công ty ─────────────────────────────────

const submitRepayment = async (driverId, debtId, { amount, paymentMethod, notes, receiptUrl }) => {
    // Verify debt belongs to this driver
    const debtRes = await pool.query(
        `SELECT id, driver_id, total_amount, paid_amount, status
         FROM debts WHERE id = $1 AND debt_type = 'driver'`,
        [debtId],
    );
    const debt = debtRes.rows[0];
    if (!debt) throw new Error('Không tìm thấy khoản công nợ');
    if (Number(debt.driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền thao tác khoản nợ này');
    if (debt.status === 'paid') throw new Error('Khoản nợ này đã được thanh toán đầy đủ');

    const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
    if (Number(amount) > remaining) {
        throw new Error(`Số tiền nộp (${Number(amount).toLocaleString('vi-VN')}đ) vượt quá số nợ còn lại (${remaining.toLocaleString('vi-VN')}đ)`);
    }

    const result = await pool.query(
        `INSERT INTO debt_payments
             (debt_id, amount, payment_method, receipt_url, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [debtId, amount, paymentMethod ?? 'cash', receiptUrl ?? null, notes ?? null, driverId],
    );
    return result.rows[0];
};

// ─── Driver: huỷ yêu cầu đang pending ────────────────────────────────────────

const cancelRepayment = async (driverId, paymentId) => {
    const res = await pool.query(
        `SELECT dp.id, dp.status, d.driver_id
         FROM debt_payments dp
         JOIN debts d ON d.id = dp.debt_id
         WHERE dp.id = $1`,
        [paymentId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Không tìm thấy yêu cầu');
    if (Number(row.driver_id) !== Number(driverId)) throw new Error('Bạn không có quyền huỷ yêu cầu này');
    if (row.status !== 'pending') throw new Error('Chỉ có thể huỷ yêu cầu đang chờ xác nhận');

    await pool.query(`DELETE FROM debt_payments WHERE id = $1`, [paymentId]);
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

module.exports = { getDriverDebts, getDebtPayments, getDriverDebtSummary, submitRepayment, cancelRepayment };
