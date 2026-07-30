const pool = require('../config/database');

// ────────────────────────────────────────────────────────────────────────────
// Báo cáo kinh doanh theo KỲ (tháng) cho Manager.
//
// Khác với báo cáo tổng quan của kế toán (thiên về giao dịch, doanh thu, công nợ),
// báo cáo này lấy góc nhìn điều hành: LỢI NHUẬN = Doanh thu − Chi phí, hiệu suất
// đội xe, sức khỏe dòng tiền, năng suất tài xế — kèm so sánh với kỳ liền trước.
//
// Chuẩn hóa toàn bộ theo giờ VN (Asia/Ho_Chi_Minh) để không lệch mốc ngày/tháng
// khi DB chạy ở UTC. Ranh giới kỳ dùng make_date(year, month, 1).
// Định nghĩa doanh thu THỐNG NHẤT với báo cáo còn lại: chuyến `completed`, tính
// theo `completed_at` (đúng ngày chạy).
// ────────────────────────────────────────────────────────────────────────────

const TZ = 'Asia/Ho_Chi_Minh';

// Điều kiện "chuyến hoàn thành nằm trong kỳ (year, month)" — dùng chung nhiều query.
const inPeriodCompleted = `
    os.status = 'completed'
    AND (os.completed_at AT TIME ZONE '${TZ}') >= make_date($1, $2, 1)
    AND (os.completed_at AT TIME ZONE '${TZ}') <  (make_date($1, $2, 1) + INTERVAL '1 month')
`;

// Nợ PHẢI THU của công ty gồm cả nợ khách lẻ/doanh nghiệp ('customer') lẫn nợ đối tác
// giao việc ('partner') — cả hai đều là tiền bên mua dịch vụ còn nợ. Doanh thu ở trên
// tính TẤT CẢ chuyến hoàn thành (cả đơn đối tác), nên nếu phần công nợ chỉ lấy
// 'customer' thì DSO và tỷ lệ thu hồi bị bóp méo: mẫu số có doanh thu đối tác mà tử số
// không có nợ/tiền thu của đối tác. Dùng chung hằng số này ở MỌI query công nợ để các
// con số trong báo cáo cộng khớp nhau.
const RECEIVABLE_DEBT_TYPES = "('customer','partner')";

// Bên nợ (khách hoặc đối tác) — chuẩn hoá tên + loại để bảng chi tiết và bảng rủi ro
// hiển thị cùng một tập dữ liệu với phần tổng hợp.
const RECEIVABLE_PARTY_JOIN = `
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN partners  pt ON pt.id = d.partner_id
`;
// Ưu tiên partner giống RECEIVABLE_PARTY_TYPE (một dòng nợ chỉ set 1 trong 2 id, nhưng
// để hai biểu thức không thể lệch nhau nếu dữ liệu bẩn).
const RECEIVABLE_PARTY_KEY = `COALESCE('p' || d.partner_id, 'c' || d.customer_id)`;
const RECEIVABLE_PARTY_NAME = `
    COALESCE(c.full_name, c.company_name, pt.company_name, pt.short_name, 'Không tên')
`;
const RECEIVABLE_PARTY_TYPE = `CASE WHEN d.partner_id IS NOT NULL THEN 'partner' ELSE 'customer' END`;
// Nợ không gắn được vào khách/đối tác nào thì bảng chi tiết không thể hiện được →
// loại luôn khỏi phần tổng để tổng và chi tiết không lệch nhau.
const RECEIVABLE_HAS_PARTY = '(d.customer_id IS NOT NULL OR d.partner_id IS NOT NULL)';

// A. Doanh thu cước thuần + số chuyến hoàn thành trong kỳ.
//
// revenue_credit tách riêng phần doanh thu BÁN CHỊU (payment_type = 'client_credit') —
// chỉ phần này mới sinh ra nợ phải thu. Đơn tiền mặt/chuyển khoản thu ngay tại chuyến
// (tiền qua tay tài xế, theo dõi ở "tiền tài xế đang cầm"), không bao giờ nằm trong
// bảng công nợ khách. Dùng revenue_credit làm mẫu số cho DSO và tỷ lệ thu hồi để hai
// chỉ số này cùng một cơ sở với tử số, thay vì chia cho tổng doanh thu.
const _revenue = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            COALESCE(SUM(os.actual_price), 0)::float AS revenue,
            COALESCE(SUM(os.actual_price) FILTER (WHERE o.payment_type = 'client_credit'), 0)::float
                                                     AS revenue_credit,
            COUNT(*)::int                            AS trips
        FROM order_shipments os
        JOIN orders o ON o.id = os.order_id
        WHERE ${inPeriodCompleted}
    `, [year, month]);
    return rows[0];
};

// A. Chi phí vận hành công ty chịu (KHÔNG gồm chi hộ khách toll/parking/etc —
// những khoản đó thu lại từ khách). Tách 2 nhóm để hiển thị cơ cấu chi phí:
//   - vehicle : nhiên liệu / sửa chữa / bảo dưỡng / khấu hao / khác (bảng expenses)
//   - office  : phiếu chi văn phòng / thuê / tiện ích / đền bù ... (payment_vouchers)
const _operatingCost = async (year, month) => {
    const [veh, off] = await Promise.all([
        pool.query(`
            SELECT COALESCE(SUM(amount), 0)::float AS amount
            FROM expenses
            WHERE status = 'approved'
              AND expense_type IN ('fuel','repair','maintenance','depreciation','other')
              AND expense_date >= make_date($1, $2, 1)
              AND expense_date <  (make_date($1, $2, 1) + INTERVAL '1 month')
        `, [year, month]),
        pool.query(`
            SELECT COALESCE(SUM(amount), 0)::float AS amount
            FROM payment_vouchers
            WHERE status IN ('approved','paid')
              -- prepaid_refund là TRẢ LẠI tiền khách ứng trước cho đơn đã huỷ, không phải
              -- chi phí vận hành: sổ tài chính ghi nó vào 131 (phải thu) với event
              -- 'prepaid_refunded', không phải 'expense_recorded'. Tính vào đây sẽ đội
              -- chi phí và làm lợi nhuận gộp thấp giả tạo.
              AND voucher_type <> 'prepaid_refund'
              AND (COALESCE(paid_at, approved_at) AT TIME ZONE '${TZ}') >= make_date($1, $2, 1)
              AND (COALESCE(paid_at, approved_at) AT TIME ZONE '${TZ}') <  (make_date($1, $2, 1) + INTERVAL '1 month')
        `, [year, month]),
    ]);
    const vehicle = veh.rows[0].amount;
    const office  = off.rows[0].amount;
    return { vehicle, office, total: vehicle + office };
};

// A. Chi phí lương (lương + thưởng đã tính của kỳ). Dùng gross_salary — lương cơ bản
// cộng các khoản thưởng — CỐ TÌNH bỏ expense_reimbursement (hoàn ứng chi hộ, đã nằm
// trong expenses) và các khoản khấu trừ, để không trùng/lệch chi phí vận hành.
const _payrollCost = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            COALESCE(SUM(gross_salary), 0)::float AS cost,
            COUNT(*)::int                         AS driver_count
        FROM payrolls
        WHERE payroll_year = $1 AND payroll_month = $2
    `, [year, month]);
    return rows[0];
};

// Gộp P&L cho 1 kỳ.
const _pnlForPeriod = async (year, month) => {
    const [rev, cost, pay] = await Promise.all([
        _revenue(year, month),
        _operatingCost(year, month),
        _payrollCost(year, month),
    ]);
    const revenue        = rev.revenue;
    const revenue_credit = rev.revenue_credit;
    const operating_cost = cost.total;
    const payroll_cost   = pay.cost;
    const gross_profit   = revenue - operating_cost - payroll_cost;
    const margin_pct     = revenue > 0 ? (gross_profit / revenue) * 100 : 0;
    return {
        revenue,
        revenue_credit,
        operating_cost,
        operating_cost_vehicle: cost.vehicle,
        operating_cost_office:  cost.office,
        payroll_cost,
        gross_profit,
        margin_pct,
        completed_trips: rev.trips,
        driver_count: pay.driver_count,
    };
};

// B. Hiệu suất từng xe trong kỳ (doanh thu, số chuyến, tổng km → doanh thu/km).
const _fleet = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            v.plate_number,
            vg.name AS vehicle_group_name,
            COALESCE(SUM(os.actual_price), 0)::float     AS revenue,
            COUNT(*)::int                                AS trip_count,
            COALESCE(SUM(os.actual_distance_km), 0)::float AS distance_km
        FROM order_shipments os
        JOIN v_shipment_current sc ON sc.shipment_id = os.id
        JOIN vehicles v ON v.id = sc.vehicle_id
        LEFT JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
        WHERE ${inPeriodCompleted}
        GROUP BY v.plate_number, vg.name
        ORDER BY revenue DESC
        LIMIT 12
    `, [year, month]);
    return rows.map(r => ({
        ...r,
        revenue_per_km: r.distance_km > 0 ? r.revenue / r.distance_km : 0,
    }));
};

// B. Tỷ lệ chuyến hỏng toàn đội trong kỳ (completed vs failed).
const _fleetOps = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'failed')::int    AS failed
        FROM order_shipments
        WHERE (COALESCE(completed_at, failed_at) AT TIME ZONE '${TZ}') >= make_date($1, $2, 1)
          AND (COALESCE(completed_at, failed_at) AT TIME ZONE '${TZ}') <  (make_date($1, $2, 1) + INTERVAL '1 month')
    `, [year, month]);
    const { completed, failed } = rows[0];
    const denom = completed + failed;
    return { completed, failed, failed_rate: denom > 0 ? (failed / denom) * 100 : 0 };
};

// D. Năng suất tài xế trong kỳ (doanh thu + số chuyến). Gán tài xế theo chủ chuyến
// hiện tại (v_shipment_current.owner_driver_id) — nhất quán với cách gán xe.
const _drivers = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            p.full_name AS driver_name,
            COALESCE(SUM(os.actual_price), 0)::float AS revenue,
            COUNT(*)::int                            AS trip_count
        FROM order_shipments os
        JOIN v_shipment_current sc ON sc.shipment_id = os.id
        JOIN profiles p ON p.id = sc.owner_driver_id
        WHERE ${inPeriodCompleted}
        GROUP BY p.id, p.full_name
        ORDER BY revenue DESC
        LIMIT 10
    `, [year, month]);
    return rows;
};

// C. Tiền bên mua dịch vụ (khách + đối tác) đã thanh toán và được xác nhận trong kỳ,
// dùng làm tử số của tỷ lệ thu hồi. Cùng phạm vi công nợ với _debtAging.
const _collectedInPeriod = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT COALESCE(SUM(dp.amount), 0)::float AS collected
        FROM debt_payments dp
        JOIN debts d ON d.id = dp.debt_id
        WHERE dp.status = 'confirmed'
          AND d.debt_type IN ${RECEIVABLE_DEBT_TYPES}
          AND ${RECEIVABLE_HAS_PARTY}
          AND (dp.confirmed_at AT TIME ZONE '${TZ}') >= make_date($1, $2, 1)
          AND (dp.confirmed_at AT TIME ZONE '${TZ}') <  (make_date($1, $2, 1) + INTERVAL '1 month')
    `, [year, month]);
    return rows[0].collected;
};

// C. Phân tích nợ phải thu theo tuổi — thời điểm HIỆN TẠI (không theo kỳ). Tính theo
// due_date thực tế, fallback created_at; chưa tới hạn gộp vào bucket đầu.
// Phạm vi (loại nợ + điều kiện có bên nợ) PHẢI giống _receivableDetail/_riskyParties,
// nếu không thì ô "Nợ phải thu" và dòng TỔNG CỘNG của bảng chi tiết sẽ lệch nhau.
const _debtAging = async () => {
    const { rows } = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments GROUP BY debt_id
        ),
        overdue AS (
            SELECT
                GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0) AS remaining,
                GREATEST(
                    (NOW() AT TIME ZONE '${TZ}')::date
                    - COALESCE(d.due_date, (d.created_at AT TIME ZONE '${TZ}')::date), 0
                ) AS overdue_days
            FROM debts d
            LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
            WHERE d.debt_type IN ${RECEIVABLE_DEBT_TYPES}
              AND ${RECEIVABLE_HAS_PARTY}
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

// C. Tiền tài xế đang cầm (nợ driver còn lại) — thời điểm hiện tại.
const _driverHoldings = async () => {
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

// E. Top bên mua dịch vụ theo doanh thu TRONG KỲ (khách hàng + đối tác giao việc).
// Doanh thu gộp theo order trước khi join để tránh Cartesian product (đơn nhiều chuyến).
// Trước đây loại hẳn đơn có partner_id, nên doanh thu đơn đối tác biến mất khỏi bảng
// này dù vẫn nằm trong ô "Doanh thu" — hai con số không bao giờ đối chiếu được.
const _topCustomers = async (year, month) => {
    const { rows } = await pool.query(`
        WITH order_rev AS (
            SELECT
                o.id AS order_id,
                o.customer_id,
                o.partner_id,
                COALESCE(SUM(os.actual_price) FILTER (WHERE ${inPeriodCompleted}), 0) AS revenue,
                COUNT(*) FILTER (WHERE ${inPeriodCompleted})                          AS trips
            FROM orders o
            JOIN order_shipments os ON os.order_id = o.id
            GROUP BY o.id, o.customer_id, o.partner_id
        )
        SELECT
            COALESCE(pt.company_name, pt.short_name, c.full_name, c.company_name, 'Không tên') AS name,
            COALESCE(pt.company_name, c.company_name) AS company_name,
            CASE WHEN orv.partner_id IS NOT NULL THEN 'partner' ELSE 'customer' END AS party_type,
            COUNT(*) FILTER (WHERE orv.trips > 0)::int AS total_orders,
            COALESCE(SUM(orv.revenue), 0)::float       AS total_revenue
        FROM order_rev orv
        LEFT JOIN customers c ON c.id = orv.customer_id
        LEFT JOIN partners  pt ON pt.id = orv.partner_id
        WHERE orv.customer_id IS NOT NULL OR orv.partner_id IS NOT NULL
        GROUP BY COALESCE('p' || orv.partner_id, 'c' || orv.customer_id),
                 pt.company_name, pt.short_name, c.full_name, c.company_name,
                 CASE WHEN orv.partner_id IS NOT NULL THEN 'partner' ELSE 'customer' END
        HAVING COALESCE(SUM(orv.revenue), 0) > 0
        ORDER BY total_revenue DESC
        LIMIT 8
    `, [year, month]);
    return rows;
};

// E. Bên nợ rủi ro — dư nợ hiện tại, ưu tiên nợ quá hạn cao nhất. Cùng phạm vi công nợ
// với _debtAging / _receivableDetail.
const _riskyCustomers = async () => {
    const { rows } = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments GROUP BY debt_id
        ),
        per_party AS (
            SELECT
                ${RECEIVABLE_PARTY_KEY} AS party_key,
                ${RECEIVABLE_PARTY_NAME} AS name,
                COALESCE(c.company_name, pt.company_name) AS company_name,
                ${RECEIVABLE_PARTY_TYPE} AS party_type,
                SUM(GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0)) AS outstanding,
                SUM(GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0)) FILTER (
                    WHERE (NOW() AT TIME ZONE '${TZ}')::date
                          - COALESCE(d.due_date, (d.created_at AT TIME ZONE '${TZ}')::date) > 0
                ) AS overdue
            FROM debts d
            LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
            ${RECEIVABLE_PARTY_JOIN}
            WHERE d.debt_type IN ${RECEIVABLE_DEBT_TYPES}
              AND ${RECEIVABLE_HAS_PARTY}
            GROUP BY ${RECEIVABLE_PARTY_KEY}, ${RECEIVABLE_PARTY_NAME},
                     COALESCE(c.company_name, pt.company_name), ${RECEIVABLE_PARTY_TYPE}
        )
        SELECT name, company_name, party_type,
               outstanding::float AS outstanding,
               COALESCE(overdue, 0)::float AS overdue
        FROM per_party
        WHERE outstanding > 0.01
        ORDER BY overdue DESC NULLS LAST, outstanding DESC
        LIMIT 8
    `);
    return rows;
};

// C. Công nợ CHI TIẾT từng bên nợ — dư nợ hiện tại tách theo tuổi nợ
// (0-30 / 31-60 / 61-90 / >90 ngày, theo due_date fallback created_at, giờ VN) +
// số đơn chưa thu. Dùng chung định nghĩa với _debtAging để tổng khớp nhau.
const _customerDebtDetail = async () => {
    const { rows } = await pool.query(`
        WITH dp_agg AS (
            SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
            FROM debt_payments GROUP BY debt_id
        ),
        open_debt AS (
            SELECT
                ${RECEIVABLE_PARTY_KEY} AS party_key,
                ${RECEIVABLE_PARTY_NAME} AS name,
                COALESCE(c.company_name, pt.company_name) AS company_name,
                COALESCE(c.phone, pt.phone) AS phone,
                ${RECEIVABLE_PARTY_TYPE} AS party_type,
                d.order_id,
                GREATEST(d.total_amount - COALESCE(dp_agg.paid, 0), 0) AS remaining,
                GREATEST(
                    (NOW() AT TIME ZONE '${TZ}')::date
                    - COALESCE(d.due_date, (d.created_at AT TIME ZONE '${TZ}')::date), 0
                ) AS overdue_days
            FROM debts d
            LEFT JOIN dp_agg ON dp_agg.debt_id = d.id
            ${RECEIVABLE_PARTY_JOIN}
            WHERE d.debt_type IN ${RECEIVABLE_DEBT_TYPES}
              AND ${RECEIVABLE_HAS_PARTY}
        )
        SELECT
            od.name,
            od.company_name,
            od.phone,
            od.party_type,
            COALESCE(SUM(od.remaining), 0)::float AS outstanding,
            COALESCE(SUM(od.remaining) FILTER (WHERE od.overdue_days <= 30), 0)::float AS d0_30,
            COALESCE(SUM(od.remaining) FILTER (WHERE od.overdue_days > 30 AND od.overdue_days <= 60), 0)::float AS d30_60,
            COALESCE(SUM(od.remaining) FILTER (WHERE od.overdue_days > 60 AND od.overdue_days <= 90), 0)::float AS d60_90,
            COALESCE(SUM(od.remaining) FILTER (WHERE od.overdue_days > 90), 0)::float AS d90_plus,
            COUNT(DISTINCT od.order_id) FILTER (WHERE od.remaining > 0.01)::int AS unpaid_orders
        FROM open_debt od
        GROUP BY od.party_key, od.name, od.company_name, od.phone, od.party_type
        HAVING COALESCE(SUM(od.remaining), 0) > 0.01
        ORDER BY outstanding DESC
        LIMIT 50
    `);
    return rows;
};

// ── Orchestrator ────────────────────────────────────────────────────────────
const getBusinessReport = async ({ year, month }) => {
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const daysInMonth = new Date(year, month, 0).getDate();

    const [
        pnl, pnlPrev,
        fleet, fleetOps,
        drivers,
        collected, debtAging, driverHoldings,
        topCustomers, riskyCustomers, customerDebts,
    ] = await Promise.all([
        _pnlForPeriod(year, month),
        _pnlForPeriod(prev.year, prev.month),
        _fleet(year, month),
        _fleetOps(year, month),
        _drivers(year, month),
        _collectedInPeriod(year, month),
        _debtAging(),
        _driverHoldings(),
        _topCustomers(year, month),
        _riskyCustomers(),
        _customerDebtDetail(),
    ]);

    const receivableTotal =
        Number(debtAging.d0_30) + Number(debtAging.d30_60) +
        Number(debtAging.d60_90) + Number(debtAging.d90_plus);

    // DSO và tỷ lệ thu hồi lấy MẪU SỐ là doanh thu bán chịu, không phải tổng doanh thu:
    // chỉ doanh thu bán chịu mới sinh nợ phải thu (tử số). Chia cho tổng doanh thu sẽ
    // làm cả hai chỉ số méo theo tỷ trọng đơn tiền mặt trong kỳ.
    const creditRevenue = Number(pnl.revenue_credit || 0);
    const dso = creditRevenue > 0 ? (receivableTotal / creditRevenue) * daysInMonth : 0;
    const driverHoldingsTotal = driverHoldings.reduce((s, d) => s + Number(d.holding || 0), 0);
    const collectionRate = creditRevenue > 0 ? (collected / creditRevenue) * 100 : 0;

    return {
        period: { year, month, days_in_month: daysInMonth },
        prev,
        pnl: { ...pnl, prev: pnlPrev },
        cost_breakdown: [
            { key: 'payroll', label: 'Lương & thưởng',   amount: pnl.payroll_cost },
            { key: 'vehicle', label: 'Chi phí xe',        amount: pnl.operating_cost_vehicle },
            { key: 'office',  label: 'Chi phí văn phòng',  amount: pnl.operating_cost_office },
        ],
        fleet,
        fleet_ops: fleetOps,
        drivers,
        cashflow: {
            debt_aging: debtAging,
            receivable_total: receivableTotal,
            credit_revenue: creditRevenue,
            dso,
            collected,
            collection_rate: collectionRate,
            driver_holdings: driverHoldings,
            driver_holdings_total: driverHoldingsTotal,
        },
        top_customers: topCustomers,
        risky_customers: riskyCustomers,
        customer_debts: customerDebts,
    };
};

// ── Phase 3: chốt kỳ (immutable snapshot) ───────────────────────────────────

// Lấy bản đã chốt của 1 kỳ (kèm tên người chốt / ký duyệt). null nếu kỳ chưa chốt.
const getClosedPeriod = async (year, month) => {
    const { rows } = await pool.query(`
        SELECT
            brp.id, brp.period_year, brp.period_month, brp.status, brp.snapshot,
            brp.note, brp.closed_at, brp.signed_off_at,
            cb.full_name AS closed_by_name,
            sb.full_name AS signed_off_by_name
        FROM business_report_periods brp
        LEFT JOIN profiles cb ON cb.id = brp.closed_by
        LEFT JOIN profiles sb ON sb.id = brp.signed_off_by
        WHERE brp.period_year = $1 AND brp.period_month = $2
    `, [year, month]);
    return rows[0] || null;
};

// Danh sách các kỳ đã chốt (chỉ số P&L then chốt, không kèm snapshot đầy đủ).
const listClosedPeriods = async (limit = 24) => {
    const { rows } = await pool.query(`
        SELECT
            brp.id, brp.period_year, brp.period_month, brp.status,
            brp.revenue::float, brp.operating_cost::float, brp.payroll_cost::float,
            brp.gross_profit::float, brp.margin_pct::float,
            brp.note, brp.closed_at, brp.signed_off_at,
            cb.full_name AS closed_by_name,
            sb.full_name AS signed_off_by_name
        FROM business_report_periods brp
        LEFT JOIN profiles cb ON cb.id = brp.closed_by
        LEFT JOIN profiles sb ON sb.id = brp.signed_off_by
        ORDER BY brp.period_year DESC, brp.period_month DESC
        LIMIT $1
    `, [limit]);
    return rows;
};

// Chốt/chốt-lại kỳ: lưu nguyên bản báo cáo vào snapshot. Chốt lại (kỳ đang 'closed')
// sẽ ghi đè và xoá vết ký duyệt cũ. Không cho phép chốt khi đã 'signed_off' — chặn ở
// tầng service trước khi gọi hàm này.
const upsertClosedPeriod = async ({ year, month, snapshot, actorId, note }) => {
    const pnl = snapshot.pnl || {};
    const { rows } = await pool.query(`
        INSERT INTO business_report_periods
            (period_year, period_month, status, snapshot,
             revenue, operating_cost, payroll_cost, gross_profit, margin_pct,
             note, closed_by, closed_at, updated_at)
        VALUES ($1, $2, 'closed', $3::jsonb,
                $4, $5, $6, $7, $8,
                $9, $10, NOW(), NOW())
        ON CONFLICT (period_year, period_month) DO UPDATE SET
            status         = 'closed',
            snapshot       = EXCLUDED.snapshot,
            revenue        = EXCLUDED.revenue,
            operating_cost = EXCLUDED.operating_cost,
            payroll_cost   = EXCLUDED.payroll_cost,
            gross_profit   = EXCLUDED.gross_profit,
            margin_pct     = EXCLUDED.margin_pct,
            note           = EXCLUDED.note,
            closed_by      = EXCLUDED.closed_by,
            closed_at      = NOW(),
            signed_off_by  = NULL,
            signed_off_at  = NULL,
            updated_at     = NOW()
        RETURNING id, status
    `, [
        year, month, JSON.stringify(snapshot),
        pnl.revenue || 0, pnl.operating_cost || 0, pnl.payroll_cost || 0,
        pnl.gross_profit || 0, pnl.margin_pct || 0,
        note || null, actorId,
    ]);
    return rows[0];
};

// Ký duyệt kỳ đã chốt (khoá cứng). Trả null nếu kỳ không ở trạng thái 'closed'.
const signOffClosedPeriod = async ({ year, month, actorId }) => {
    const { rows } = await pool.query(`
        UPDATE business_report_periods
        SET status = 'signed_off', signed_off_by = $3, signed_off_at = NOW(), updated_at = NOW()
        WHERE period_year = $1 AND period_month = $2 AND status = 'closed'
        RETURNING id
    `, [year, month, actorId]);
    return rows[0] || null;
};

// Mở lại kỳ đã chốt (chưa ký duyệt) → xoá snapshot, kỳ trở về tính động. Trả false
// nếu không có kỳ 'closed' để mở (đã ký duyệt hoặc chưa từng chốt).
const reopenClosedPeriod = async ({ year, month }) => {
    const { rowCount } = await pool.query(`
        DELETE FROM business_report_periods
        WHERE period_year = $1 AND period_month = $2 AND status = 'closed'
    `, [year, month]);
    return rowCount > 0;
};

module.exports = {
    getBusinessReport,
    getClosedPeriod,
    listClosedPeriods,
    upsertClosedPeriod,
    signOffClosedPeriod,
    reopenClosedPeriod,
};
