const pool = require('../../config/database');

const buildDebtStatus = (paidAmount, totalAmount) => {
    if (!totalAmount || totalAmount === 0) return 'paid';
    if (paidAmount >= totalAmount - 0.01) return 'paid';
    if (paidAmount > 0) return 'partial';
    return 'unpaid';
};

const getAllDebts = async ({
    debtType = null,    // 'customer' | 'driver' | null (all)
    status = null,      // 'paid' | 'partial' | 'unpaid' | null (all)
    customerSearch = null,
    driverSearch = null,
    page = 1,
    limit = 20,
} = {}) => {
    const params = [];
    const conditions = [];

    // Join tables
    let from = `
        FROM debts d
        LEFT JOIN customers c ON c.id = d.customer_id
        LEFT JOIN profiles dr ON dr.id = d.driver_id
        LEFT JOIN orders o ON o.id = d.order_id
        LEFT JOIN order_shipments os ON os.id = d.shipment_id
    `;

    // Debt type filter
    if (debtType) {
        params.push(debtType);
        conditions.push(`d.debt_type = $${params.length}`);
    }

    // Customer search
    if (customerSearch && customerSearch.trim()) {
        params.push(`%${customerSearch.trim()}%`);
        conditions.push(`(
            c.full_name ILIKE $${params.length}
            OR c.company_name ILIKE $${params.length}
            OR c.phone ILIKE $${params.length}
        )`);
    }

    // Driver search
    if (driverSearch && driverSearch.trim()) {
        params.push(`%${driverSearch.trim()}%`);
        conditions.push(`dr.full_name ILIKE $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Status subquery (computed column)
    // Applied in JS below after fetching rows

    // Count total
    const countQuery = `
        SELECT COUNT(*)::int AS total
        ${from}
        ${where}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalItems = countResult.rows[0]?.total || 0;

    // Main query
    const offset = (page - 1) * limit;
    const queryParams = [...params, limit, offset];

    const result = await pool.query(
        `SELECT
            d.id,
            d.debt_type,
            d.total_amount::text,
            d.paid_amount::text,
            (COALESCE(d.total_amount, 0) - COALESCE(d.paid_amount, 0))::text AS remaining,
            d.status          AS raw_status,
            d.due_date,
            d.notes,
            d.created_at,
            d.updated_at,
            d.order_id,
            d.shipment_id,
            c.id              AS customer_id,
            c.full_name       AS customer_name,
            c.company_name    AS customer_company,
            c.phone           AS customer_phone,
            dr.id             AS driver_id,
            dr.full_name      AS driver_name,
            o.id              AS order_id,
            o.cargo_name      AS order_cargo_name,
            o.created_at      AS order_date
        ${from}
        ${where}
        ORDER BY d.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        queryParams,
    );

    // Compute computed_status for each row
    const debts = result.rows.map((row) => ({
        ...row,
        computed_status: buildDebtStatus(
            Number(row.paid_amount || 0),
            Number(row.total_amount || 0),
        ),
    }));

    // Apply status filter in JS (since it's a computed column)
    const filteredDebts = status
        ? debts.filter((d) => d.computed_status === status)
        : debts;

    return {
        debts: filteredDebts,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit,
    };
};

const getDebtStats = async () => {
    const result = await pool.query(`
        SELECT
            debt_type,
            COUNT(*)::int                                  AS count,
            COALESCE(SUM(total_amount), 0)::text          AS total_amount,
            COALESCE(SUM(paid_amount), 0)::text            AS total_paid,
            COALESCE(SUM(total_amount - paid_amount), 0)::text AS total_remaining
        FROM debts
        WHERE status <> 'paid'
        GROUP BY debt_type
    `);

    const byType = {};
    let overallRemaining = 0;

    for (const row of result.rows) {
        byType[row.debt_type] = {
            count: row.count,
            total_amount: Number(row.total_amount),
            total_paid: Number(row.total_paid),
            total_remaining: Number(row.total_remaining),
        };
        overallRemaining += Number(row.total_remaining);
    }

    return {
        byType,
        totalRemaining: overallRemaining,
    };
};

module.exports = { getAllDebts, getDebtStats };
