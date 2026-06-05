const pool = require('../config/database');

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

// Leaderboard theo vehicle group, tháng/năm (§23, §26)
const getLeaderboard = async (vehicleGroupId, { month, year }) => {
    const result = await pool.query(
        `SELECT
            driver_id,
            driver_name,
            completed_shipments,
            total_revenue::text,
            on_time_rate::text,
            incident_count,
            revenue_rank,
            trips_rank
         FROM v_leaderboard
         WHERE vehicle_group_id = $1
           AND year  = $2
           AND month = $3
         ORDER BY revenue_rank ASC
         LIMIT 20`,
        [vehicleGroupId, year, month],
    );
    return result.rows;
};

// Lấy vehicle_group_id của driver để query leaderboard đúng nhóm xe
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

module.exports = { getDriverKPI, getLeaderboard, getDriverVehicleGroupId };
