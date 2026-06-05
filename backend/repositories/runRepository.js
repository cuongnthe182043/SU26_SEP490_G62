const pool = require('../config/database');

const getRunsByShipment = async (shipmentId) => {
    const result = await pool.query(
        `SELECT id, shipment_id, run_index, driver_id, vehicle_id,
                status, started_at, completed_at, notes
         FROM trip_runs
         WHERE shipment_id = $1
         ORDER BY run_index ASC`,
        [shipmentId],
    );
    return result.rows;
};

// Driver bắt đầu lượt chạy (pending → in_progress)
// BR-012: chỉ 1 run in_progress tại một thời điểm
const startRun = async (shipmentId, runIndex, driverId, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const inProgress = await client.query(
            `SELECT id FROM trip_runs
             WHERE shipment_id = $1 AND status = 'in_progress' LIMIT 1`,
            [shipmentId],
        );
        if (inProgress.rows.length > 0) {
            await client.query('ROLLBACK');
            throw new Error('Đang có lượt chạy khác đang thực hiện, hoàn thành trước khi bắt đầu lượt mới');
        }

        const result = await client.query(
            `UPDATE trip_runs
             SET status     = 'in_progress',
                 driver_id  = COALESCE($3, driver_id),
                 vehicle_id = COALESCE($4, vehicle_id),
                 started_at = NOW(),
                 updated_at = NOW()
             WHERE shipment_id = $1 AND run_index = $2 AND status = 'pending'
             RETURNING *`,
            [shipmentId, runIndex, driverId, vehicleId],
        );

        await client.query('COMMIT');
        return result.rows[0] ?? null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Driver hoàn thành lượt chạy (in_progress → completed)
const completeRun = async (shipmentId, runIndex, notes = null) => {
    const result = await pool.query(
        `UPDATE trip_runs
         SET status       = 'completed',
             completed_at = NOW(),
             notes        = COALESCE($4, notes),
             updated_at   = NOW()
         WHERE shipment_id = $1 AND run_index = $2 AND status = 'in_progress'
         RETURNING *`,
        [shipmentId, runIndex, notes, notes],
    );
    return result.rows[0] ?? null;
};

// Kiểm tra tất cả runs đã completed chưa (BR-012)
const areAllRunsCompleted = async (shipmentId) => {
    const result = await pool.query(
        `SELECT COUNT(*) FILTER (WHERE status <> 'completed') AS pending_count
         FROM trip_runs WHERE shipment_id = $1`,
        [shipmentId],
    );
    return Number(result.rows[0]?.pending_count ?? 1) === 0;
};

module.exports = { getRunsByShipment, startRun, completeRun, areAllRunsCompleted };
