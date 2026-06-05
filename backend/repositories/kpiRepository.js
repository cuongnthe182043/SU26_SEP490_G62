const pool = require('../config/database');

// ─── Driver: KPI cá nhân ──────────────────────────────────────────────────────

const getDriverKPI = async (driverId, { month = null, year = null } = {}) => {
    const conditions = ['k.driver_id = $1'];
    const params = [driverId];
    if (year)  { params.push(year);  conditions.push(`k.year = $${params.length}`); }
    if (month) { params.push(month); conditions.push(`k.month = $${params.length}`); }

    const result = await pool.query(
        `SELECT
            k.id, k.month, k.year,
            k.completed_shipments,
            k.total_revenue::text,
            k.late_deliveries,
            k.incident_count,
            k.major_incident_count,
            k.critical_incident_count,
            k.on_time_rate::text,
            vg.name AS vehicle_group_name
         FROM kpi_records k
         JOIN vehicle_groups vg ON vg.id = k.vehicle_group_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY k.year DESC, k.month DESC`,
        params,
    );
    return result.rows;
};

// ─── Driver: Vehicle group để query leaderboard đúng nhóm (BR-028) ───────────

const getDriverVehicleGroupId = async (driverId) => {
    const result = await pool.query(
        `SELECT v.vehicle_group_id, vg.name AS vehicle_group_name
         FROM drivers d
         JOIN vehicles v  ON v.id  = d.vehicle_id
         JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
         WHERE d.profile_id = $1`,
        [driverId],
    );
    return result.rows[0] ?? null;
};

// ─── Driver: Leaderboard trong nhóm xe của mình (BR-028) ─────────────────────
// Luôn trả về rank của driver hiện tại dù không trong top 20

const getLeaderboard = async (driverId, vehicleGroupId, { month, year }) => {
    const result = await pool.query(
        `WITH board AS (
            SELECT
                driver_id, driver_name,
                completed_shipments,
                total_revenue::text,
                on_time_rate::text,
                incident_count,
                revenue_rank,
                trips_rank
            FROM v_leaderboard
            WHERE vehicle_group_id = $1 AND year = $2 AND month = $3
         )
         SELECT *, (driver_id = $4) AS is_me
         FROM board
         ORDER BY revenue_rank ASC
         LIMIT 20`,
        [vehicleGroupId, year, month, driverId],
    );

    // Nếu driver không nằm trong top 20, lấy thêm rank của họ
    const rows = result.rows;
    const alreadyInTop = rows.some((r) => r.driver_id === driverId);
    if (!alreadyInTop) {
        const myRank = await pool.query(
            `SELECT
                driver_id, driver_name,
                completed_shipments,
                total_revenue::text,
                on_time_rate::text,
                incident_count,
                revenue_rank,
                trips_rank,
                TRUE AS is_me
             FROM v_leaderboard
             WHERE vehicle_group_id = $1 AND year = $2 AND month = $3
               AND driver_id = $4`,
            [vehicleGroupId, year, month, driverId],
        );
        if (myRank.rows[0]) rows.push(myRank.rows[0]);
    }

    return rows;
};

// ─── Coordinator / Manager: KPI tất cả driver theo tháng ─────────────────────

const getAllDriversKPI = async ({ month, year, vehicleGroupId = null }) => {
    const conditions = ['k.year = $1', 'k.month = $2'];
    const params = [year, month];
    if (vehicleGroupId) {
        params.push(vehicleGroupId);
        conditions.push(`k.vehicle_group_id = $${params.length}`);
    }

    const result = await pool.query(
        `SELECT
            k.driver_id,
            p.full_name AS driver_name,
            k.month, k.year,
            k.completed_shipments,
            k.total_revenue::text,
            k.late_deliveries,
            k.incident_count,
            k.major_incident_count,
            k.critical_incident_count,
            k.on_time_rate::text,
            vg.name AS vehicle_group_name
         FROM kpi_records k
         JOIN profiles p       ON p.id  = k.driver_id
         JOIN vehicle_groups vg ON vg.id = k.vehicle_group_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY k.total_revenue DESC`,
        params,
    );
    return result.rows;
};

// ─── Coordinator / Manager / Accountant: KPI của 1 driver cụ thể ─────────────

const getDriverKPIById = async (driverId, { month = null, year = null } = {}) => {
    const conditions = ['k.driver_id = $1'];
    const params = [driverId];
    if (year)  { params.push(year);  conditions.push(`k.year = $${params.length}`); }
    if (month) { params.push(month); conditions.push(`k.month = $${params.length}`); }

    const result = await pool.query(
        `SELECT
            k.id, k.driver_id, k.month, k.year,
            k.completed_shipments,
            k.total_revenue::text,
            k.late_deliveries,
            k.incident_count,
            k.major_incident_count,
            k.critical_incident_count,
            k.on_time_rate::text,
            p.full_name AS driver_name,
            vg.name AS vehicle_group_name
         FROM kpi_records k
         JOIN profiles p       ON p.id  = k.driver_id
         JOIN vehicle_groups vg ON vg.id = k.vehicle_group_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY k.year DESC, k.month DESC`,
        params,
    );
    return result.rows;
};

// Tính lại KPI cho 1 driver trong 1 tháng cụ thể rồi UPSERT vào kpi_records
// Gọi tự động sau mỗi lần trip hoàn thành
const recalculateDriverKPI = async (driverId, month, year) => {
    // 1. Lấy vehicle_group_id của driver
    const vgRes = await pool.query(
        `SELECT v.vehicle_group_id
         FROM drivers d
         JOIN vehicles v ON v.id = d.vehicle_id
         WHERE d.profile_id = $1`,
        [driverId],
    );
    const vehicleGroupId = vgRes.rows[0]?.vehicle_group_id;
    if (!vehicleGroupId) return null; // driver chưa được gán xe, bỏ qua

    // 2. Thống kê chuyến hoàn thành trong tháng
    const shipRes = await pool.query(
        `SELECT
            COUNT(*)                                                           AS completed_shipments,
            COALESCE(SUM(COALESCE(actual_price, estimated_price, 0)), 0)      AS total_revenue
         FROM order_shipments
         WHERE owner_driver_id = $1
           AND status = 'completed'
           AND EXTRACT(MONTH FROM completed_at) = $2
           AND EXTRACT(YEAR  FROM completed_at) = $3`,
        [driverId, month, year],
    );
    const { completed_shipments, total_revenue } = shipRes.rows[0];

    // 3. Thống kê sự cố do driver tạo trong tháng
    const incRes = await pool.query(
        `SELECT
            COUNT(*)                                               AS incident_count,
            COUNT(*) FILTER (WHERE severity_level = 'high')       AS major_incident_count,
            COUNT(*) FILTER (WHERE severity_level = 'critical')   AS critical_incident_count
         FROM incidents
         WHERE reported_by = $1
           AND EXTRACT(MONTH FROM created_at) = $2
           AND EXTRACT(YEAR  FROM created_at) = $3`,
        [driverId, month, year],
    );
    const { incident_count, major_incident_count, critical_incident_count } = incRes.rows[0];

    // 4. UPSERT vào kpi_records — nếu đã có thì cập nhật, chưa có thì tạo mới
    const result = await pool.query(
        `INSERT INTO kpi_records
            (driver_id, vehicle_group_id, month, year,
             completed_shipments, total_revenue,
             late_deliveries, incident_count, major_incident_count, critical_incident_count)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9)
         ON CONFLICT (driver_id, month, year) DO UPDATE SET
             completed_shipments     = EXCLUDED.completed_shipments,
             total_revenue           = EXCLUDED.total_revenue,
             incident_count          = EXCLUDED.incident_count,
             major_incident_count    = EXCLUDED.major_incident_count,
             critical_incident_count = EXCLUDED.critical_incident_count,
             updated_at              = NOW()
         RETURNING *`,
        [
            driverId, vehicleGroupId, month, year,
            Number(completed_shipments), Number(total_revenue),
            Number(incident_count), Number(major_incident_count), Number(critical_incident_count),
        ],
    );
    return result.rows[0];
};

module.exports = {
    getDriverKPI,
    getDriverVehicleGroupId,
    getLeaderboard,
    getAllDriversKPI,
    getDriverKPIById,
    recalculateDriverKPI,
};
