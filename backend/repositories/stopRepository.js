const pool = require('../config/database');

const getStopsByShipment = async (shipmentId) => {
    const result = await pool.query(
        `SELECT id, shipment_id, stop_index, stop_type, address,
                contact_name, contact_phone, notes,
                arrived_at, completed_at, proof_url
         FROM trip_stops
         WHERE shipment_id = $1
         ORDER BY stop_index ASC`,
        [shipmentId],
    );
    return result.rows;
};

// Driver đến điểm dừng
const markStopArrived = async (stopId, shipmentId) => {
    const result = await pool.query(
        `UPDATE trip_stops
         SET arrived_at = NOW()
         WHERE id = $1 AND shipment_id = $2 AND arrived_at IS NULL
         RETURNING *`,
        [stopId, shipmentId],
    );
    return result.rows[0] ?? null;
};

// Driver hoàn thành điểm dừng (lấy hàng hoặc giao hàng)
const markStopCompleted = async (stopId, shipmentId, proofUrl = null) => {
    const result = await pool.query(
        `UPDATE trip_stops
         SET completed_at = NOW(),
             proof_url    = COALESCE($3, proof_url)
         WHERE id = $1 AND shipment_id = $2 AND completed_at IS NULL
         RETURNING *`,
        [stopId, shipmentId, proofUrl],
    );
    return result.rows[0] ?? null;
};

// Kiểm tra stop trước đó đã hoàn thành chưa (BR-011: đúng thứ tự)
const isPreviousStopDone = async (stopId, shipmentId) => {
    const cur = await pool.query(
        `SELECT stop_index FROM trip_stops WHERE id = $1 AND shipment_id = $2`,
        [stopId, shipmentId],
    );
    if (!cur.rows[0]) return false;
    const idx = cur.rows[0].stop_index;
    if (idx === 1) return true;

    const prev = await pool.query(
        `SELECT completed_at FROM trip_stops
         WHERE shipment_id = $1 AND stop_index = $2`,
        [shipmentId, idx - 1],
    );
    return !!prev.rows[0]?.completed_at;
};

module.exports = { getStopsByShipment, markStopArrived, markStopCompleted, isPreviousStopDone };
