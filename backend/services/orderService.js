const pool = require('../config/database');

const normalizeNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numericValue = Number(String(value).replace(/,/g, '').trim());
    if (Number.isNaN(numericValue)) throw new Error('Số tiền hoặc khối lượng không hợp lệ');
    return numericValue;
};

const safeTrim = (value) => String(value ?? '').trim();

const listOrders = async () => {
    const result = await pool.query(
        `SELECT
            o.id,
            o.cargo_name,
            o.cargo_weight_kg,
            o.pickup_address,
            o.delivery_address,
            o.estimated_price,
            o.payment_type,
            o.status,
            o.notes,
            o.created_at,
            o.updated_at,
            p.full_name AS created_by_name,
            d.full_name AS driver_name
         FROM orders o
         LEFT JOIN profiles p ON p.id = o.created_by
         LEFT JOIN LATERAL (
            SELECT pr.full_name
            FROM order_shipments os
            LEFT JOIN profiles pr ON pr.id = os.owner_driver_id
            WHERE os.order_id = o.id
            ORDER BY os.shipment_index ASC
            LIMIT 1
         ) d ON TRUE
         ORDER BY o.created_at DESC`,
    );

    return result.rows;
};

const createOrder = async (userId, payload) => {
    const {
        cargo_name,
        cargo_weight_kg,
        pickup_address,
        delivery_address,
        estimated_price,
        payment_type,
        notes,
    } = payload;

    if (!cargo_name || !pickup_address || !delivery_address) {
        throw new Error('Thiếu thông tin bắt buộc');
    }

    const normalizedWeight = normalizeNumber(cargo_weight_kg);
    const normalizedPrice = normalizeNumber(estimated_price);
    const normalizedVehicleGroupId = 1;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

    const orderResult = await client.query(
            `INSERT INTO orders
                (created_by, cargo_name, cargo_weight_kg, pickup_address, delivery_address, estimated_price, payment_type, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
             RETURNING *`,
            [
                userId,
                safeTrim(cargo_name),
                normalizedWeight,
                safeTrim(pickup_address),
                safeTrim(delivery_address),
                normalizedPrice,
                safeTrim(payload.payment_type) || 'cash',
                safeTrim(notes) || null,
            ],
        );

        const order = orderResult.rows[0];

        const shipmentResult = await client.query(
            `INSERT INTO order_shipments
                (order_id, shipment_index, vehicle_group_id, pickup_address, delivery_address, cargo_weight_kg, estimated_price, status, notes)
             VALUES ($1, 1, $2, $3, $4, $5, $6, 'available', $7)
             RETURNING *`,
            [
                order.id,
                normalizedVehicleGroupId,
                order.pickup_address,
                order.delivery_address,
                order.cargo_weight_kg,
                order.estimated_price,
                order.notes,
            ],
        );

        await client.query('COMMIT');

        return {
            order,
            shipment: shipmentResult.rows[0],
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = { createOrder, listOrders };
