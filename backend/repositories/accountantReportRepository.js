const pool = require('../config/database');

const getReportOverview = async ({ months = 6, granularity = 'month' } = {}) => {
    const [
        revenueChart,
        topCustomers,
        topPartners,
        debtAging,
        payrollSummary,
        revenueByVehicle,
        driverHoldings,
    ] = await Promise.all([
        _getRevenueTrend(granularity, months),
        _getTopCustomers(),
        _getTopPartners(),
        _getDebtAging(),
        _getPayrollSummary(),
        _getRevenueByVehicle(months),
        _getDriverHoldings(),
    ]);

    return {
        revenueChart,
        topCustomers,
        topPartners,
        debtAging,
        payrollSummary,
        revenueByVehicle,
        driverHoldings,
    };
};

// Xu hướng doanh thu theo ngày / tuần / tháng.
// Doanh thu tính theo completed_at của chuyến (đúng ngày chạy — nhất quán KPI/lương/sổ).
// Cửa sổ thời gian: day = 30 ngày, week = 12 tuần, month = theo bộ lọc months.
const _getRevenueTrend = async (granularity, months) => {
    const CONFIG = {
        day:   { trunc: 'day',   step: '1 day',   span: `29 days`,               labelFmt: 'DD/MM' },
        week:  { trunc: 'week',  step: '1 week',  span: `11 weeks`,              labelFmt: '"T"DD/MM' },
        month: { trunc: 'month', step: '1 month', span: `${months - 1} months`,  labelFmt: 'MM/YYYY' },
    };
    const cfg = CONFIG[granularity] ?? CONFIG.month;

    // Gom nhóm theo giờ VN để không lệch bucket khi DB chạy ở UTC.
    const { rows } = await pool.query(`
        WITH bucket_series AS (
            SELECT generate_series(
                DATE_TRUNC('${cfg.trunc}', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') - INTERVAL '${cfg.span}'),
                DATE_TRUNC('${cfg.trunc}', (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')),
                INTERVAL '${cfg.step}'
            )::DATE AS bucket
        )
        SELECT
            TO_CHAR(bs.bucket, '${cfg.labelFmt}')       AS label,
            COALESCE(SUM(os.actual_price), 0)::float    AS revenue,
            COUNT(DISTINCT os.order_id)::int            AS order_count
        FROM bucket_series bs
        LEFT JOIN order_shipments os
            ON DATE_TRUNC('${cfg.trunc}', (os.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh'))::DATE = bs.bucket
            AND os.status = 'completed'
        GROUP BY bs.bucket
        ORDER BY bs.bucket
    `);
    return rows;
};

// Doanh thu tính theo os.status = 'completed' (cấp CHUYẾN) — thống nhất với
// _getRevenueTrend / _getRevenueByVehicle, KHÔNG dùng o.derived_status (cấp ĐƠN,
// có thể completed sớm hơn/khác các chuyến còn lại vì các chuyến trong 1 đơn chạy
// độc lập theo BR-008). Doanh thu và công nợ mỗi đơn được gộp riêng trong subquery
// (1 dòng / order_id) TRƯỚC KHI join vào customers, tránh Cartesian product khi
// một đơn có nhiều chuyến (order_shipments) và/hoặc nhiều công nợ (debts) —
// cả hai bảng đều không có quan hệ 1-1 với order_id.
const _getTopCustomers = async () => {
    const { rows } = await pool.query(`
        WITH shipment_revenue AS (
            SELECT order_id, COALESCE(SUM(actual_price), 0) AS revenue
            FROM order_shipments
            WHERE status = 'completed'
            GROUP BY order_id
        ),
        debt_paid AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments
            GROUP BY debt_id
        ),
        order_debt AS (
            SELECT d.order_id,
                   SUM(GREATEST(d.total_amount - COALESCE(dp.paid, 0), 0)) AS outstanding
            FROM debts d
            LEFT JOIN debt_paid dp ON dp.debt_id = d.id
            WHERE d.debt_type = 'customer'
            GROUP BY d.order_id
        )
        SELECT
            COALESCE(c.full_name, c.company_name, 'Không tên') AS name,
            c.phone,
            c.company_name,
            COUNT(DISTINCT o.id)::int              AS total_orders,
            COALESCE(SUM(sr.revenue), 0)::float     AS total_revenue,
            COALESCE(SUM(od.outstanding), 0)::float AS outstanding_debt
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        JOIN shipment_revenue sr ON sr.order_id = o.id
        LEFT JOIN order_debt od ON od.order_id = o.id
        WHERE o.partner_id IS NULL   -- đơn đối tác: doanh thu tính về đối tác, không về khách chủ hàng
        GROUP BY c.id, c.full_name, c.phone, c.company_name
        ORDER BY total_revenue DESC
        LIMIT 10
    `);
    return rows;
};

// Top đối tác theo doanh thu — CHỈ các đơn thuộc đối tác (o.partner_id). Doanh thu +
// công nợ đối tác gộp riêng theo order trước khi join (tránh Cartesian như top khách).
const _getTopPartners = async () => {
    const { rows } = await pool.query(`
        WITH shipment_revenue AS (
            SELECT order_id, COALESCE(SUM(actual_price), 0) AS revenue
            FROM order_shipments
            WHERE status = 'completed'
            GROUP BY order_id
        ),
        debt_paid AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments
            GROUP BY debt_id
        ),
        order_debt AS (
            SELECT d.order_id,
                   SUM(GREATEST(d.total_amount - COALESCE(dp.paid, 0), 0)) AS outstanding
            FROM debts d
            LEFT JOIN debt_paid dp ON dp.debt_id = d.id
            WHERE d.debt_type = 'partner'
            GROUP BY d.order_id
        )
        SELECT
            p.company_name                          AS name,
            p.short_name,
            p.phone,
            COUNT(DISTINCT o.id)::int               AS total_orders,
            COALESCE(SUM(sr.revenue), 0)::float      AS total_revenue,
            COALESCE(SUM(od.outstanding), 0)::float  AS outstanding_debt
        FROM partners p
        JOIN orders o ON o.partner_id = p.id
        JOIN shipment_revenue sr ON sr.order_id = o.id
        LEFT JOIN order_debt od ON od.order_id = o.id
        GROUP BY p.id, p.company_name, p.short_name, p.phone
        ORDER BY total_revenue DESC
        LIMIT 10
    `);
    return rows;
};

// "Quá hạn" tính theo due_date (hạn thanh toán thực tế), fallback về created_at
// cho các đường tạo debt cũ chưa set due_date (ví dụ createCustomerDebtForTrip,
// record-collection client_credit...). Nợ chưa tới hạn (due_date ở tương lai)
// được gộp vào bucket đầu (0-30) qua GREATEST(...,0) thay vì báo âm ngày quá hạn.
const _getDebtAging = async () => {
    const { rows } = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments GROUP BY debt_id
        ),
        overdue AS (
            SELECT
                d.id,
                GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0) AS remaining,
                GREATEST(NOW()::date - COALESCE(d.due_date, d.created_at::date), 0) AS overdue_days
            FROM debts d
            LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
            WHERE d.debt_type = 'customer'
        )
        SELECT
            COALESCE(SUM(remaining) FILTER (WHERE overdue_days <= 30), 0)::float AS d0_30,
            COALESCE(SUM(remaining) FILTER (WHERE overdue_days > 30 AND overdue_days <= 60), 0)::float AS d30_60,
            COALESCE(SUM(remaining) FILTER (WHERE overdue_days > 60 AND overdue_days <= 90), 0)::float AS d60_90,
            COALESCE(SUM(remaining) FILTER (WHERE overdue_days > 90), 0)::float AS d90_plus
        FROM overdue
        WHERE remaining > 0.01
    `);
    return rows[0];
};

const _getPayrollSummary = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();

    const { rows } = await pool.query(`
        SELECT
            status,
            COUNT(*)::int         AS count,
            COALESCE(SUM(net_salary), 0)::float AS total_net
        FROM payrolls
        WHERE payroll_month = $1 AND payroll_year = $2
        GROUP BY status
    `, [month, year]);

    const summary = { month, year, pending: 0, reviewed: 0, approved: 0, paid: 0, total_net: 0 };
    for (const row of rows) {
        summary[row.status] = row.count;
        summary.total_net  += row.total_net;
    }
    return summary;
};

// Doanh thu theo từng xe (cước thuần, chuyến hoàn thành trong kỳ)
const _getRevenueByVehicle = async (months) => {
    const { rows } = await pool.query(`
        SELECT
            v.plate_number,
            vg.name AS vehicle_group_name,
            COALESCE(SUM(os.actual_price), 0)::float AS revenue,
            COUNT(os.id)::int AS trip_count
        FROM order_shipments os
        JOIN v_shipment_current sc ON sc.shipment_id = os.id
        JOIN vehicles v ON v.id = sc.vehicle_id
        LEFT JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
        WHERE os.status = 'completed'
          AND os.completed_at >= NOW() - $1 * INTERVAL '1 month'
        GROUP BY v.plate_number, vg.name
        ORDER BY revenue DESC
        LIMIT 12
    `, [months]);
    return rows;
};

// Tiền tài xế đang cầm (nợ driver còn lại, tính động từ debt_payments confirmed)
const _getDriverHoldings = async () => {
    const { rows } = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments GROUP BY debt_id
        )
        SELECT
            p.full_name AS driver_name,
            COALESCE(SUM(GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0)), 0)::float AS holding,
            COUNT(d.id) FILTER (WHERE GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0) > 0.01)::int AS debt_count
        FROM debts d
        JOIN profiles p ON p.id = d.driver_id
        LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
        WHERE d.debt_type = 'driver'
        GROUP BY p.id, p.full_name
        HAVING COALESCE(SUM(GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0)), 0) > 0.01
        ORDER BY holding DESC
        LIMIT 10
    `);
    return rows;
};

module.exports = { getReportOverview };

