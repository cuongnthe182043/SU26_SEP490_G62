const pool = require('../config/database');

// ─── Payroll ─────────────────────────────────────────────────────────────────

const getDriverPayrolls = async (driverId, { month = null, year = null } = {}) => {
    const conditions = ['driver_id = $1'];
    const params = [driverId];
    if (year)  { params.push(year);  conditions.push(`payroll_year = $${params.length}`); }
    if (month) { params.push(month); conditions.push(`payroll_month = $${params.length}`); }

    const result = await pool.query(
        `SELECT
            id, payroll_month, payroll_year,
            base_salary::text,
            months_of_service,
            total_revenue::text,
            revenue_share_pct::text,
            revenue_bonus::text,
            kpi_bonus::text,
            top_driver_bonus::text,
            overtime_bonus::text,
            holiday_bonus::text,
            other_bonus::text,
            insurance_employee::text,
            driver_debt_deduction::text,
            advance_deduction::text,
            absence_penalty::text,
            other_deduction::text,
            gross_salary::text,
            net_salary::text,
            status,
            paid_at
         FROM payrolls
         WHERE ${conditions.join(' AND ')}
         ORDER BY payroll_year DESC, payroll_month DESC`,
        params,
    );
    return result.rows;
};

// ─── Salary Advance ───────────────────────────────────────────────────────────

const createSalaryAdvance = async ({ driverId, amount, reason, requestMonth, requestYear }) => {
    // Một tháng chỉ được có 1 request đang pending/approved
    const existing = await pool.query(
        `SELECT id FROM salary_advances
         WHERE driver_id = $1
           AND request_month = $2
           AND request_year  = $3
           AND status IN ('pending','approved')
         LIMIT 1`,
        [driverId, requestMonth, requestYear],
    );
    if (existing.rows.length > 0) {
        throw new Error('Đã có yêu cầu ứng lương đang chờ xử lý trong tháng này');
    }

    const result = await pool.query(
        `INSERT INTO salary_advances
             (driver_id, amount, reason, request_month, request_year, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [driverId, amount, reason ?? null, requestMonth, requestYear],
    );
    return result.rows[0];
};

const getDriverAdvances = async (driverId, { status = null } = {}) => {
    const params = [driverId];
    let where = 'WHERE driver_id = $1';
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }

    const result = await pool.query(
        `SELECT id, amount::text, reason, request_month, request_year,
                status, reject_reason, created_at, paid_at
         FROM salary_advances
         ${where}
         ORDER BY created_at DESC`,
        params,
    );
    return result.rows;
};

module.exports = { getDriverPayrolls, createSalaryAdvance, getDriverAdvances };
