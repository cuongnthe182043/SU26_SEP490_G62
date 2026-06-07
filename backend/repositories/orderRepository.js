const pool = require('../config/database');
const { ASSIGNMENT_TYPE } = require('../constants/tripConstants');

const selectOrderProjection = `
    SELECT
        o.id,
        o.customer_id,
        o.cargo_name,
        o.cargo_weight_kg,
        o.payment_type,
        o.total_estimated_price,
        o.total_estimated_price AS estimated_price,
        o.derived_status,
        os.status,
        o.notes,
        o.created_at,
        o.updated_at,
        os.id AS shipment_id,
        os.completed_at,
        os.vehicle_group_id,
        os.owner_driver_id,
        pickup.address AS pickup_address,
        delivery.address AS delivery_address,
        c.full_name AS customer_name,
        c.phone AS customer_phone,
        d.full_name AS driver_name,
        v.plate_number AS plate_number
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN LATERAL (
        SELECT s1.*
        FROM order_shipments s1
        WHERE s1.order_id = o.id
        ORDER BY s1.shipment_index ASC
        LIMIT 1
    ) os ON TRUE
    LEFT JOIN LATERAL (
        SELECT ts.address
        FROM trip_stops ts
        WHERE ts.shipment_id = os.id AND ts.stop_type = 'pickup'
        ORDER BY ts.stop_index ASC
        LIMIT 1
    ) pickup ON TRUE
    LEFT JOIN LATERAL (
        SELECT ts.address
        FROM trip_stops ts
        WHERE ts.shipment_id = os.id AND ts.stop_type = 'delivery'
        ORDER BY ts.stop_index ASC
        LIMIT 1
    ) delivery ON TRUE
    LEFT JOIN profiles d ON d.id = os.owner_driver_id
    LEFT JOIN vehicles v ON v.id = os.vehicle_id
`;

const listOrders = async () => {
    const result = await pool.query(`${selectOrderProjection} ORDER BY o.created_at DESC`);
    return result.rows;
};

const getDriverById = async (client, driverId) => {
    if (!driverId) return null;
    const result = await client.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            p.phone,
            d.vehicle_id,
            v.plate_number,
            v.vehicle_group_id
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
         WHERE d.profile_id = $1
         LIMIT 1`,
        [driverId],
    );
    return result.rows[0] ?? null;
};


const getDefaultVehicleGroupId = async (client) => {
    const result = await client.query(
        `SELECT id FROM vehicle_groups ORDER BY id ASC LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
};

const getDriverByPlate = async (client, plateNumber) => {
    if (!plateNumber) return null;
    const result = await client.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            p.phone,
            d.vehicle_id,
            v.plate_number,
            v.vehicle_group_id
         FROM vehicles v
         LEFT JOIN drivers d ON d.vehicle_id = v.id
         LEFT JOIN profiles p ON p.id = d.profile_id
         WHERE v.plate_number = $1
         LIMIT 1`,
        [plateNumber],
    );
    return result.rows[0] ?? null;
};

const findOrCreateCustomer = async (client, customerName, customerPhone, normalizePhone, safeTrim) => {
    const normalizedPhone = normalizePhone(customerPhone);
    if (!normalizedPhone) return null;

    const existingCustomer = await client.query(
        `SELECT id, full_name, phone
         FROM customers
         WHERE phone = $1
         LIMIT 1`,
        [normalizedPhone],
    );
    if (existingCustomer.rows[0]) return existingCustomer.rows[0];

    const createdCustomer = await client.query(
        `INSERT INTO customers (customer_type, full_name, contact_person, phone)
         VALUES ('individual', $1, $1, $2)
         RETURNING id, full_name, phone`,
        [safeTrim(customerName) || normalizedPhone, normalizedPhone],
    );
    return createdCustomer.rows[0];
};

const insertStops = async (client, shipmentId, pickupAddress, deliveryAddress, contactName, contactPhone) => {
    await client.query(
        `INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone)
         VALUES
            ($1, 1, 'pickup', $2, $4, $5),
            ($1, 2, 'delivery', $3, $4, $5)`,
        [shipmentId, pickupAddress, deliveryAddress, contactName || null, contactPhone || null],
    );
};

const createOrderWithShipment = async ({
    client,
    userId,
    orderData,
    shipmentData,
    assignmentData,
}) => {
    const orderResult = await client.query(
        `INSERT INTO orders
            (customer_id, created_by, cargo_name, cargo_weight_kg, payment_type, total_estimated_price, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
            orderData.customer_id,
            userId,
            orderData.cargo_name,
            orderData.cargo_weight_kg,
            orderData.payment_type || 'cash',
            orderData.estimated_price || 0,
            orderData.notes,
        ],
    );

    const order = orderResult.rows[0];
    const shipmentResult = await client.query(
        `INSERT INTO order_shipments
            (order_id, shipment_index, vehicle_group_id, owner_driver_id, vehicle_id, cargo_name, cargo_weight_kg, estimated_price, status, notes)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
            order.id,
            shipmentData.vehicle_group_id,
            shipmentData.owner_driver_id,
            shipmentData.vehicle_id || null,
            shipmentData.cargo_name || order.cargo_name,
            shipmentData.cargo_weight_kg,
            shipmentData.estimated_price,
            shipmentData.status,
            shipmentData.notes,
        ],
    );

    await insertStops(
        client,
        shipmentResult.rows[0].id,
        shipmentData.pickup_address,
        shipmentData.delivery_address,
        orderData.customer_name,
        orderData.customer_phone,
    );

    if (assignmentData?.driver_id && assignmentData?.vehicle_id) {
        await client.query(
            `INSERT INTO shipment_assignments
                (shipment_id, driver_id, vehicle_id, assignment_type, assigned_by, assigned_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [
                shipmentResult.rows[0].id,
                assignmentData.driver_id,
                assignmentData.vehicle_id,
                assignmentData.assignment_type ?? ASSIGNMENT_TYPE.COORDINATOR_ASSIGN,
                assignmentData.assigned_by ?? null,
            ],
        );
    }

    return {
        order: {
            ...order,
            estimated_price: order.total_estimated_price,
            pickup_address: shipmentData.pickup_address,
            delivery_address: shipmentData.delivery_address,
            status: shipmentData.status,
            driver_name: null,
        },
        shipment: shipmentResult.rows[0],
    };
};

const importOrderWithShipment = async ({ client, userId, orderData, shipmentData }) => {
    return createOrderWithShipment({
        client,
        userId,
        orderData: { ...orderData, payment_type: orderData.payment_type || 'cash' },
        shipmentData: {
            ...shipmentData,
            cargo_name: orderData.cargo_name,
            vehicle_group_id: shipmentData.vehicle_group_id,
            owner_driver_id: shipmentData.owner_driver_id || null,
            vehicle_id: shipmentData.vehicle_id || null,
            status: shipmentData.status || 'available',
        },
    });
};

const updateOrder = async (orderId, payload, normalizeNumber, safeTrim, normalizePhone) => {
    const {
        customer_name,
        customer_phone,
        cargo_name,
        cargo_weight_kg,
        pickup_address,
        delivery_address,
        estimated_price,
        notes,
    } = payload;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const orderResult = await client.query(
            `UPDATE orders
             SET cargo_name = COALESCE(NULLIF($2, ''), cargo_name),
                 cargo_weight_kg = COALESCE($3, cargo_weight_kg),
                 total_estimated_price = COALESCE($4, total_estimated_price),
                 notes = COALESCE(NULLIF($5, ''), notes),
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
                orderId,
                safeTrim(cargo_name),
                normalizeNumber(cargo_weight_kg),
                normalizeNumber(estimated_price),
                safeTrim(notes) || [
                    customer_name ? `Khách hàng: ${safeTrim(customer_name)}` : '',
                    customer_phone ? `SĐT: ${normalizePhone(customer_phone)}` : '',
                ].filter(Boolean).join(' | ') || null,
            ],
        );

        if (!orderResult.rows[0]) {
            await client.query('ROLLBACK');
            return null;
        }

        const shipmentResult = await client.query(
            `SELECT id FROM order_shipments WHERE order_id = $1 ORDER BY shipment_index ASC LIMIT 1`,
            [orderId],
        );
        const shipmentId = shipmentResult.rows[0]?.id;

        if (shipmentId) {
            await client.query(
                `UPDATE order_shipments
                 SET cargo_name = COALESCE(NULLIF($2, ''), cargo_name),
                     cargo_weight_kg = COALESCE($3, cargo_weight_kg),
                     estimated_price = COALESCE($4, estimated_price),
                     notes = COALESCE(NULLIF($5, ''), notes),
                     updated_at = NOW()
                 WHERE id = $1`,
                [shipmentId, safeTrim(cargo_name), normalizeNumber(cargo_weight_kg), normalizeNumber(estimated_price), safeTrim(notes)],
            );

            if (safeTrim(pickup_address)) {
                await client.query(
                    `UPDATE trip_stops SET address = $2 WHERE shipment_id = $1 AND stop_type = 'pickup'`,
                    [shipmentId, safeTrim(pickup_address)],
                );
            }
            if (safeTrim(delivery_address)) {
                await client.query(
                    `UPDATE trip_stops SET address = $2 WHERE shipment_id = $1 AND stop_type = 'delivery'`,
                    [shipmentId, safeTrim(delivery_address)],
                );
            }
        }

        await client.query('COMMIT');
        const updated = await pool.query(`${selectOrderProjection} WHERE o.id = $1`, [orderId]);
        return updated.rows[0] ?? null;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    listOrders,
    getDriverById,
    getDriverByPlate,
    getDefaultVehicleGroupId,
    findOrCreateCustomer,
    createOrderWithShipment,
    importOrderWithShipment,
    updateOrder,
};
