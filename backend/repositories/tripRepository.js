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

// Pool hiển thị ORDERS (không phải shipments riêng lẻ).
// Điều kiện: tất cả shipments trong order phải available + chưa có owner.
const getAvailableOrders = async (vehicleGroupId) => {
    const result = await pool.query(
        `SELECT
            o.id            AS order_id,
            o.cargo_name,
            o.notes         AS order_notes,
            o.payment_type,
            (SELECT os1.pickup_address
             FROM order_shipments os1
             WHERE os1.order_id = o.id
             ORDER BY os1.shipment_index ASC
             LIMIT 1)       AS pickup_address,
            (SELECT os2.delivery_address
             FROM order_shipments os2
             WHERE os2.order_id = o.id
             ORDER BY os2.shipment_index DESC
             LIMIT 1)       AS delivery_address,
            (SELECT SUM(os3.cargo_weight_kg)
             FROM order_shipments os3
             WHERE os3.order_id = o.id) AS total_cargo_weight_kg,
            (SELECT SUM(os4.estimated_price)
             FROM order_shipments os4
             WHERE os4.order_id = o.id) AS total_estimated_price,
            (SELECT COUNT(*)::int
             FROM order_shipments os5
             WHERE os5.order_id = o.id) AS total_legs,
            o.created_at,
            vg.id           AS vehicle_group_id,
            vg.name         AS vehicle_group_name,
            vg.max_load_weight_kg
         FROM orders o
         JOIN order_shipments os ON os.order_id = o.id
         JOIN vehicle_groups vg ON os.vehicle_group_id = vg.id
         WHERE os.vehicle_group_id = $1
           AND NOT EXISTS (
               SELECT 1 FROM order_shipments oc
               WHERE oc.order_id = o.id
                 AND (oc.status != 'available' OR oc.owner_driver_id IS NOT NULL)
           )
         GROUP BY o.id, o.cargo_name, o.notes, o.payment_type, o.created_at,
                  vg.id, vg.name, vg.max_load_weight_kg
         ORDER BY o.created_at ASC`,
        [vehicleGroupId],
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

// Driver nhận cả ORDER: gán owner_driver_id cho tất cả legs,
// chỉ kích hoạt leg đầu tiên (shipment_index nhỏ nhất) → CLAIMED.
const claimOrder = async (orderId, driverId, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lock tất cả rows của order trước, rồi kiểm tra trạng thái
        const locked = await client.query(
            `SELECT id, status, owner_driver_id
             FROM order_shipments
             WHERE order_id = $1
             FOR UPDATE`,
            [orderId],
        );
        const total = locked.rows.length;
        const claimable = locked.rows.filter(
            (r) => r.status === 'available' && r.owner_driver_id === null,
        ).length;
        if (total === 0 || total !== claimable) {
            await client.query('ROLLBACK');
            return null; // order đã được nhận hoặc không tồn tại
        }

        // Gán owner_driver_id cho TẤT CẢ legs (giữ status=available cho các leg sau)
        await client.query(
            `UPDATE order_shipments
             SET owner_driver_id = $2, updated_at = NOW()
             WHERE order_id = $1`,
            [orderId, driverId],
        );

        // Kích hoạt leg đầu tiên → CLAIMED
        const firstResult = await client.query(
            `UPDATE order_shipments
             SET status      = $1,
                 claimed_at  = NOW(),
                 version     = version + 1,
                 updated_at  = NOW()
             WHERE order_id = $2
               AND shipment_index = (
                   SELECT MIN(shipment_index) FROM order_shipments WHERE order_id = $2
               )
             RETURNING *`,
            [SHIPMENT_STATUS.CLAIMED, orderId],
        );
        const firstShipment = firstResult.rows[0];

        // Cập nhật order status mirror leg đầu tiên
        await client.query(
            `UPDATE orders SET status = 'claimed', updated_at = NOW() WHERE id = $1`,
            [orderId],
        );

        // Ghi assignment cho leg đầu
        await client.query(
            `INSERT INTO shipment_assignments
                 (shipment_id, driver_id, vehicle_id, assignment_type, assigned_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [firstShipment.id, driverId, vehicleId, ASSIGNMENT_TYPE.SELF_CLAIM],
        );

        await client.query('COMMIT');
        return firstShipment;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Sau khi hoàn thành 1 leg, tự động kích hoạt leg tiếp theo của cùng order.
// Trả về leg tiếp theo nếu có, null nếu là leg cuối.
const activateNextShipment = async (completedShipmentId, driverId, vehicleId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cur = await client.query(
            `SELECT order_id, shipment_index FROM order_shipments WHERE id = $1`,
            [completedShipmentId],
        );
        if (!cur.rows[0]) { await client.query('ROLLBACK'); return null; }

        const { order_id, shipment_index } = cur.rows[0];

        const nextResult = await client.query(
            `UPDATE order_shipments
             SET status     = $1,
                 claimed_at = NOW(),
                 version    = version + 1,
                 updated_at = NOW()
             WHERE order_id        = $2
               AND owner_driver_id = $3
               AND status          = 'available'
               AND shipment_index  = (
                   SELECT MIN(shipment_index)
                   FROM order_shipments
                   WHERE order_id = $2 AND shipment_index > $4
               )
             RETURNING *`,
            [SHIPMENT_STATUS.CLAIMED, order_id, driverId, shipment_index],
        );

        if (nextResult.rows[0]) {
            const next = nextResult.rows[0];
            await client.query(
                `INSERT INTO shipment_assignments
                     (shipment_id, driver_id, vehicle_id, assignment_type, assigned_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [next.id, driverId, vehicleId, ASSIGNMENT_TYPE.SELF_CLAIM],
            );
            // Mirror trạng thái leg mới kích hoạt lên orders
            await client.query(
                `UPDATE orders SET status = 'claimed', updated_at = NOW() WHERE id = $1`,
                [order_id],
            );
            await client.query('COMMIT');
            return next;
        }

        // Không có leg tiếp → order hoàn thành
        await client.query(
            `UPDATE orders SET status = 'completed', updated_at = NOW() WHERE id = $1`,
            [order_id],
        );
        await client.query('COMMIT');
        return null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const updateTripStatus = async (tripId, newStatus, cancelReason = null) => {
    const tsCol = STATUS_TIMESTAMP_COL[newStatus];
    let query, params;
    if (cancelReason && tsCol) {
        query  = `UPDATE order_shipments SET status=$2, cancel_reason=$3, ${tsCol}=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`;
        params = [tripId, newStatus, cancelReason];
    } else if (cancelReason) {
        query  = `UPDATE order_shipments SET status=$2, cancel_reason=$3, updated_at=NOW() WHERE id=$1 RETURNING *`;
        params = [tripId, newStatus, cancelReason];
    } else if (tsCol) {
        query  = `UPDATE order_shipments SET status=$2, ${tsCol}=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`;
        params = [tripId, newStatus];
    } else {
        query  = `UPDATE order_shipments SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *`;
        params = [tripId, newStatus];
    }

    const result   = await pool.query(query, params);
    const shipment = result.rows[0];
    if (shipment) {
        await pool.query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, shipment.order_id],
        );
    }
    return shipment;
};

// Hủy chuyến sớm: trả toàn bộ order về pool (tất cả legs → available, owner = NULL)
const releaseOrderToPool = async (tripId, driverId, reason) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Lấy order_id + validate driver ownership
        const cur = await client.query(
            `SELECT order_id, status FROM order_shipments WHERE id = $1 FOR UPDATE`,
            [tripId],
        );
        if (!cur.rows[0]) throw new Error('Chuyến không tồn tại');
        const { order_id, status } = cur.rows[0];

        // Ghi lý do hủy vào leg hiện tại
        await client.query(
            `UPDATE order_shipments
             SET cancel_reason = $1, cancelled_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [reason ?? null, tripId],
        );

        // Reset TẤT CẢ legs về available, xóa owner
        await client.query(
            `UPDATE order_shipments
             SET status = 'available', owner_driver_id = NULL, updated_at = NOW()
             WHERE order_id = $1`,
            [order_id],
        );

        // Reset order về available
        await client.query(
            `UPDATE orders SET status = 'available', updated_at = NOW() WHERE id = $1`,
            [order_id],
        );

        await client.query('COMMIT');
        return { order_id, released: true };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
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

const saveShipmentReceipt = async (shipmentId, driverId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO shipment_receipts (shipment_id, captured_by, file_url, is_realtime)
         VALUES ($1, $2, $3, TRUE)
         RETURNING *`,
        [shipmentId, driverId, fileUrl],
    );
    return result.rows[0];
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
    getDriverVehicleId,
    getAvailableOrders,
    getActiveTrip,
    getTripById,
    claimOrder,
    activateNextShipment,
    updateTripStatus,
    releaseOrderToPool,
    isFinalShipment,
    saveShipmentReceipt,
    saveCompletionProof,
    getDriverStats,
};
