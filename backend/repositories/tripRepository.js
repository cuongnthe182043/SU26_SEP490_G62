const pool = require('../config/database');
const {
    SHIPMENT_STATUS,
    ASSIGNMENT_TYPE,
    ACTIVE_STATUSES,
    STATUS_TIMESTAMP_COL,
} = require('../constants/tripConstants');

const getDriverVehicleGroupId = async (driverId) => {
    const result = await pool.query(
        `SELECT v.vehicle_group_id
         FROM drivers d
         JOIN vehicles v ON d.vehicle_id = v.id
         WHERE d.profile_id = $1`,
        [driverId],
    );
    return result.rows[0]?.vehicle_group_id ?? null;
};

const getAvailableTrips = async (vehicleGroupId) => {
    const result = await pool.query(
        `SELECT
            os.id,
            os.order_id,
            os.shipment_index,
            os.vehicle_group_id,
            os.pickup_address,
            os.delivery_address,
            os.cargo_weight_kg,
            os.estimated_price,
            os.status,
            os.notes,
            os.version,
            os.created_at,
            o.cargo_name,
            vg.name AS vehicle_group_name,
            vg.max_load_weight_kg
         FROM order_shipments os
         JOIN orders o ON os.order_id = o.id
         JOIN vehicle_groups vg ON os.vehicle_group_id = vg.id
         WHERE os.status = $1
           AND os.vehicle_group_id = $2
         ORDER BY os.created_at ASC`,
        [SHIPMENT_STATUS.AVAILABLE, vehicleGroupId],
    );
    return result.rows;
};

const getActiveTrip = async (driverId) => {
    const result = await pool.query(
        `SELECT
            os.id,
            os.order_id,
            os.shipment_index,
            os.pickup_address,
            os.delivery_address,
            os.cargo_weight_kg,
            os.estimated_price,
            os.actual_price,
            os.status,
            os.notes,
            os.version,
            os.claimed_at,
            os.picking_at,
            os.loaded_at,
            os.transit_at,
            os.arrived_at,
            os.completed_at,
            o.cargo_name,
            o.notes AS order_notes,
            o.payment_type AS order_payment_type,
            (
                SELECT MAX(s2.shipment_index)
                FROM order_shipments s2
                WHERE s2.order_id = os.order_id
            ) AS max_shipment_index
         FROM order_shipments os
         JOIN orders o ON os.order_id = o.id
         WHERE os.owner_driver_id = $1
           AND os.status = ANY($2::text[])
         LIMIT 1`,
        [driverId, ACTIVE_STATUSES],
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
        ...row,
        is_final_shipment: Number(row.shipment_index) === Number(row.max_shipment_index),
    };
};

const getTripById = async (tripId) => {
    const result = await pool.query(
        `SELECT os.*, o.cargo_name, o.notes AS order_notes
         FROM order_shipments os
         JOIN orders o ON os.order_id = o.id
         WHERE os.id = $1`,
        [tripId],
    );
    return result.rows[0] ?? null;
};

const claimTrip = async (tripId, driverId, currentVersion, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE order_shipments
             SET status          = $1,
                 owner_driver_id = $2,
                 version         = version + 1,
                 claimed_at      = NOW(),
                 updated_at      = NOW()
             WHERE id      = $3
               AND status  = $4
               AND version = $5
             RETURNING *`,
            [SHIPMENT_STATUS.CLAIMED, driverId, tripId, SHIPMENT_STATUS.AVAILABLE, currentVersion],
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return null;
        }

        await client.query(
            `INSERT INTO shipment_assignments
                 (shipment_id, driver_id, vehicle_id, assignment_type, assigned_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [tripId, driverId, vehicleId, ASSIGNMENT_TYPE.SELF_CLAIM],
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateTripStatus = async (tripId, newStatus) => {
    const tsCol = STATUS_TIMESTAMP_COL[newStatus];
    const query = tsCol
        ? `UPDATE order_shipments
           SET status = $2, ${tsCol} = NOW(), updated_at = NOW()
           WHERE id = $1 RETURNING *`
        : `UPDATE order_shipments
           SET status = $2, updated_at = NOW()
           WHERE id = $1 RETURNING *`;

    const result = await pool.query(query, [tripId, newStatus]);
    return result.rows[0];
};

const isFinalShipment = async (tripId) => {
    const result = await pool.query(
        `SELECT os.shipment_index,
                (SELECT MAX(s2.shipment_index)
                 FROM order_shipments s2
                 WHERE s2.order_id = os.order_id) AS max_index
         FROM order_shipments os
         WHERE os.id = $1`,
        [tripId],
    );
    if (!result.rows[0]) return false;
    const { shipment_index, max_index } = result.rows[0];
    return Number(shipment_index) === Number(max_index);
};

const saveCompletionProof = async (orderId, shipmentId, driverId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO completion_proofs (order_id, shipment_id, captured_by, file_url, is_realtime)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (order_id) DO UPDATE
             SET file_url    = EXCLUDED.file_url,
                 captured_at = NOW()
         RETURNING *`,
        [orderId, shipmentId, driverId, fileUrl],
    );
    return result.rows[0];
};

const getDriverStats = async (driverId) => {
    const result = await pool.query(
        `SELECT
            COUNT(*) FILTER (
                WHERE claimed_at >= CURRENT_DATE
            )::int                                          AS today_total,
            COUNT(*) FILTER (
                WHERE status = $2
                  AND completed_at >= CURRENT_DATE
            )::int                                          AS today_completed,
            COUNT(*) FILTER (
                WHERE status = $2
                  AND DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', NOW())
            )::int                                          AS month_completed
         FROM order_shipments
         WHERE owner_driver_id = $1`,
        [driverId, SHIPMENT_STATUS.COMPLETED],
    );
    return result.rows[0];
};

const getDriverVehicleId = async (driverId) => {
    const result = await pool.query(
        'SELECT vehicle_id FROM drivers WHERE profile_id = $1',
        [driverId],
    );
    return result.rows[0]?.vehicle_id ?? null;
};

module.exports = {
    getDriverVehicleGroupId,
    getAvailableTrips,
    getActiveTrip,
    getTripById,
    claimTrip,
    updateTripStatus,
    isFinalShipment,
    saveCompletionProof,
    getDriverVehicleId,
    getDriverStats,
};
