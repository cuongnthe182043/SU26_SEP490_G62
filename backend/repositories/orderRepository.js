const bcrypt = require('bcryptjs');
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
        os.estimated_distance_km,
        os.delivery_at,
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


const parsePositiveInt = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const listOrders = async ({
    page = 1,
    limit = 10,
    search = '',
    status = '',
    dateFrom = '',
    dateTo = '',
    customer = '',
} = {}) => {
    const normalizedPage = parsePositiveInt(page, 1, 1000000);
    const normalizedLimit = parsePositiveInt(limit, 10, 100);
    const offset = (normalizedPage - 1) * normalizedLimit;
    const conditions = [];
    const params = [];

    if (status) {
        const statuses = String(status)
            .split(',')
            .map((item) => item.trim().toLowerCase())
            .filter(Boolean);
        if (statuses.length) {
            params.push(statuses);
            conditions.push(`LOWER(os.status) = ANY($${params.length})`);
        }
    }

    if (dateFrom) {
        params.push(dateFrom);
        conditions.push(`os.delivery_at::date >= $${params.length}::date`);
    }

    if (dateTo) {
        params.push(dateTo);
        conditions.push(`os.delivery_at::date <= $${params.length}::date`);
    }

    if (customer) {
        params.push(`%${String(customer).trim().toLowerCase()}%`);
        conditions.push(`LOWER(COALESCE(c.full_name, '')) LIKE $${params.length}`);
    }

    if (search) {
        params.push(`%${String(search).trim().toLowerCase()}%`);
        conditions.push(`(
            LOWER(COALESCE(o.cargo_name, '')) LIKE $${params.length}
            OR LOWER(COALESCE(pickup.address, '')) LIKE $${params.length}
            OR LOWER(COALESCE(delivery.address, '')) LIKE $${params.length}
            OR LOWER(COALESCE(c.full_name, '')) LIKE $${params.length}
            OR LOWER(COALESCE(d.full_name, '')) LIKE $${params.length}
            OR LOWER(COALESCE(v.plate_number, '')) LIKE $${params.length}
            OR LOWER(COALESCE(os.status, '')) LIKE $${params.length}
        )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM (${selectOrderProjection} ${whereClause}) counted_orders`,
        params,
    );

    const rowsParams = [...params, normalizedLimit, offset];
    const rowsResult = await pool.query(
        `${selectOrderProjection}
         ${whereClause}
         ORDER BY COALESCE(os.delivery_at, o.created_at) DESC, o.id DESC
         LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`,
        rowsParams,
    );

    const total = Number(countResult.rows[0]?.total ?? 0);
    return {
        orders: rowsResult.rows,
        pagination: {
            page: normalizedPage,
            limit: normalizedLimit,
            total,
            totalPages: Math.max(1, Math.ceil(total / normalizedLimit)),
        },
    };
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
            v.vehicle_group_id,
            v.status AS vehicle_status
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
         WHERE d.profile_id = $1
         LIMIT 1`,
        [driverId],
    );
    return result.rows[0] ?? null;
};

//If vehicle group id is not selected, to set default but fe set auto when choose driver
const getDefaultVehicleGroupId = async (client) => {
    const result = await client.query(
        `SELECT id FROM vehicle_groups ORDER BY id ASC LIMIT 1`,
    );
    return result.rows[0]?.id ?? null;
};

//Get driver Infor if have plate 
const getDriverByPlate = async (client, plateNumber) => {
    if (!plateNumber) return null;
    const result = await client.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            p.phone,
            d.vehicle_id,
            v.plate_number,
            v.vehicle_group_id,
            v.status AS vehicle_status
         FROM vehicles v
         LEFT JOIN drivers d ON d.vehicle_id = v.id
         LEFT JOIN profiles p ON p.id = d.profile_id
         WHERE UPPER(v.plate_number) = UPPER($1)
         LIMIT 1`,
        [plateNumber],
    );
    return result.rows[0] ?? null;
};

const getVehicleByPlate = async (client, plateNumber, vehicleGroupId = null) => {
    if (!plateNumber) return null;
    const params = [String(plateNumber).trim().toUpperCase()];
    let groupFilter = '';
    if (vehicleGroupId) {
        params.push(Number(vehicleGroupId));
        groupFilter = ` AND v.vehicle_group_id = $${params.length}`;
    }
    const result = await client.query(
        `SELECT
            v.id,
            v.plate_number,
            v.vehicle_group_id,
            vg.name AS vehicle_group_name,
            vg.price_per_km,
            v.status AS vehicle_status
         FROM vehicles v
         JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
         WHERE UPPER(v.plate_number) = $1${groupFilter}
         LIMIT 1`,
        params,
    );
    return result.rows[0] ?? null;
};

const getVehicleGroupById = async (client, vehicleGroupId) => {
    if (!vehicleGroupId) return null;
    const result = await client.query(
        `SELECT id, name, price_per_km
         FROM vehicle_groups
         WHERE id = $1
         LIMIT 1`,
        [vehicleGroupId],
    );
    return result.rows[0] ?? null;
};

const listCoordinatorVehicleGroups = async () => {
    const result = await pool.query(
        `SELECT
            vg.id,
            vg.name,
            vg.price_per_km,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', v.id,
                        'plate_number', v.plate_number,
                        'status', v.status
                    ) ORDER BY v.plate_number
                ) FILTER (WHERE v.id IS NOT NULL),
                '[]'::json
            ) AS vehicles
         FROM vehicle_groups vg
         LEFT JOIN vehicles v ON v.vehicle_group_id = vg.id AND v.status = 'active'
         GROUP BY vg.id
         ORDER BY vg.name ASC, vg.id ASC`,
    );
    return result.rows;
};
//Find driver by name
const findDriverByName = async (client, driverName) => {
    if (!driverName) return null;
    const result = await client.query(
        `SELECT
            d.profile_id AS id,
            p.full_name,
            p.phone,
            d.vehicle_id,
            v.plate_number,
            v.vehicle_group_id,
            v.status AS vehicle_status
         FROM drivers d
         JOIN profiles p ON p.id = d.profile_id
         JOIN roles r ON r.id = p.role_id
         LEFT JOIN vehicles v ON v.id = d.vehicle_id
         WHERE r.name = 'driver' AND LOWER(p.full_name) = LOWER($1)
         LIMIT 1`,
        [driverName],
    );
    return result.rows[0] ?? null;
};

const createImportedDriverAccount = async (client, driverName) => {
    const roleResult = await client.query(
        `SELECT id FROM roles WHERE name = 'driver' LIMIT 1`,
    );
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) throw new Error('Không tìm thấy vai trò tài xế trong hệ thống');

    const baseEmail = String(driverName || 'driver')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'driver';
    const email = `imported.${baseEmail}.${Date.now()}.${Math.floor(Math.random() * 10000)}@local.invalid`;

    const passwordHash = await bcrypt.hash(`Imported@${Date.now()}`, 10);
    const accountResult = await client.query(
        `INSERT INTO accounts (email, password_hash, role_id, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
        [email, passwordHash, roleId],
    );
    const accountId = accountResult.rows[0].id;

    await client.query(
        `INSERT INTO profiles (id, full_name, role_id)
         VALUES ($1, $2, $3)`,
        [accountId, driverName || `Tài xế ${accountId}`, roleId],
    );

    await client.query(
        `INSERT INTO drivers (profile_id, license_number, hire_date)
         VALUES ($1, $2, CURRENT_DATE)`,
        [accountId, `IMPORT-${accountId}`],
    );

    return accountId;
};

const findOrCreateDriverWithVehicle = async (client, { driverName, plateNumber, vehicleGroupId }) => {
    const name = String(driverName || '').trim();
    const plate = String(plateNumber || '').trim().toUpperCase();
    if (!name && !plate) return null;

    let vehicle = null;
    if (plate) {
        const vehicleResult = await client.query(
            `INSERT INTO vehicles (plate_number, vehicle_group_id, status)
             VALUES ($1, $2, 'active')
             ON CONFLICT (plate_number) DO UPDATE
             SET vehicle_group_id = COALESCE(vehicles.vehicle_group_id, EXCLUDED.vehicle_group_id),
                 updated_at = NOW()
             RETURNING id, plate_number, vehicle_group_id, assigned_driver_id, status`,
            [plate, vehicleGroupId],
        );
        vehicle = vehicleResult.rows[0];
    }

    const driverByPlate = plate ? await getDriverByPlate(client, plate) : null;
    if (driverByPlate?.id) return driverByPlate;

    let driver = name ? await findDriverByName(client, name) : null;
    let driverId = driver?.id;
    if (!driverId && name) {
        driverId = await createImportedDriverAccount(client, name);
    }

    if (!driverId) return null;

    if (vehicle?.id) {
        await client.query(
            `UPDATE drivers
             SET vehicle_id = $2
             WHERE profile_id = $1 AND (vehicle_id IS NULL OR vehicle_id = $2)`,
            [driverId, vehicle.id],
        );
        await client.query(
            `UPDATE vehicles
             SET assigned_driver_id = $2, updated_at = NOW()
             WHERE id = $1 AND (assigned_driver_id IS NULL OR assigned_driver_id = $2)`,
            [vehicle.id, driverId],
        );
    }

    return getDriverById(client, driverId);
};

const findOrCreateCustomer = async (client, customerName, customerPhone, normalizePhone, safeTrim) => {
    const normalizedPhone = normalizePhone(customerPhone);
    const normalizedName = safeTrim(customerName);

    if (normalizedPhone) {
        const existingCustomer = await client.query(// Nếu có khách hàng tìm bởi số điện thoại
            `SELECT id, full_name, phone 
             FROM customers
             WHERE phone = $1
             LIMIT 1`,
            [normalizedPhone],//Query tìm khách hàng 
        );
        if (existingCustomer.rows[0]) return existingCustomer.rows[0];//Thì return khách hàng

    }else {
        return null;
    }

    const createdCustomer = await client.query(
        `INSERT INTO customers (customer_type, full_name, phone)
        VALUES('individual', $1, $2)
        RETURNING id, full_name, phone`,
        [normalizedName || normalizedPhone, normalizedPhone],
    );
    return createdCustomer.rows[0];
};


const insertStops = async (client, shipmentId, pickupAddress, deliveryAddress, contactName, contactPhone, notes) => {
    await client.query(
        `INSERT INTO trip_stops(shipment_id, stop_index, stop_type, address, contact_name, contact_phone, notes)
         VALUES
            ($1, 1, 'pickup', $2, $4, $5, $6),
            ($1, 2, 'delivery', $3, $4, $5, $6)`,
        [shipmentId, pickupAddress, deliveryAddress, contactName || null, contactPhone || null, notes || null],
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
            (customer_id, created_by, cargo_name, cargo_weight_kg, payment_type, total_estimated_price, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
         RETURNING *`,
        [
            orderData.customer_id,
            userId,
            orderData.cargo_name,
            orderData.cargo_weight_kg,
            orderData.payment_type || 'cash',
            orderData.estimated_price || 0,
            orderData.notes,
            orderData.created_at || null,
        ],
    );

    const order = orderResult.rows[0];
    const shipmentResult = await client.query(
        `INSERT INTO order_shipments
            (order_id, shipment_index, vehicle_group_id, owner_driver_id, vehicle_id, cargo_name, cargo_weight_kg, estimated_price, estimated_distance_km, delivery_at, status, notes, created_at)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()))
         RETURNING *`,
        [
            order.id,
            shipmentData.vehicle_group_id,
            shipmentData.owner_driver_id,
            shipmentData.vehicle_id || null,
            shipmentData.cargo_name || order.cargo_name,
            shipmentData.cargo_weight_kg,
            shipmentData.estimated_price,
            shipmentData.estimated_distance_km,
            shipmentData.delivery_at || null,
            shipmentData.status,
            shipmentData.notes,
            shipmentData.created_at || null,
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
            estimated_distance_km: shipmentData.estimated_distance_km,
            delivery_at: shipmentData.delivery_at,
            plate_number: shipmentData.plate_number,
            driver_name: null,
        },
        shipment: shipmentResult.rows[0],
    };
};

const importOrderWithShipment = async ({ client, userId, orderData, shipmentData }) => {
    return createOrderWithShipment({
        client,
        userId,
        orderData: { ...orderData, payment_type: orderData.payment_type || 'cash', created_at: orderData.created_at || null },
        shipmentData: {
            ...shipmentData,
            cargo_name: orderData.cargo_name,
            vehicle_group_id: shipmentData.vehicle_group_id,
            owner_driver_id: shipmentData.owner_driver_id || null,
            vehicle_id: shipmentData.vehicle_id || null,
            estimated_distance_km: shipmentData.estimated_distance_km ?? null,
            delivery_at: shipmentData.delivery_at || null,
            plate_number: shipmentData.plate_number || null,
            status: shipmentData.status || 'available',
            created_at: shipmentData.created_at || null,
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
        plate,
        driver_id,
        vehicle_id,
        vehicle_group_id,
        distance,
        delivery_at,
        date,
    } = payload;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const customer = (customer_name || customer_phone)
            ? await findOrCreateCustomer(client, customer_name, customer_phone, normalizePhone, safeTrim)
            : null;
        const finalVehicleGroupId = vehicle_group_id ? Number(vehicle_group_id) : null;
        const vehicleGroup = finalVehicleGroupId ? await getVehicleGroupById(client, finalVehicleGroupId) : null;
        const vehicle = plate ? await getVehicleByPlate(client, plate, finalVehicleGroupId) : null;

        if (plate && !vehicle) {
            throw new Error('BKS không tồn tại trong nhóm xe đã chọn');
        }
        if (vehicle?.vehicle_status && vehicle.vehicle_status !== 'active') {
            throw new Error(`Xe ${vehicle.plate_number} hiện không sẵn sàng cho điều phối (trạng thái: ${vehicle.vehicle_status})`);
        }

        const normalizedDistance = normalizeNumber(distance);
        if (normalizedDistance === null || normalizedDistance <= 0) {
            throw new Error('Quãng đường là bắt buộc để tính cước');
        }
        if (!vehicleGroup) {
            throw new Error('Nhóm xe là bắt buộc để tính cước');
        }
        const calculatedPrice = normalizedDistance * Number(vehicleGroup.price_per_km || 0);
        const deliveryAt = safeTrim(delivery_at || date) || null;
        const orderNotes = [
            vehicle?.plate_number ? `BKS: ${vehicle.plate_number}` : '',
            notes !== undefined ? safeTrim(notes) : '',
        ].filter(Boolean).join(' | ');

        const orderResult = await client.query(
            `UPDATE orders
             SET customer_id = COALESCE($6, customer_id),
                 cargo_name = COALESCE(NULLIF($2, ''), cargo_name),
                 cargo_weight_kg = COALESCE($3, cargo_weight_kg),
                 total_estimated_price = COALESCE($4, total_estimated_price),
                 notes = $5,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
                orderId,
                safeTrim(cargo_name),
                normalizeNumber(cargo_weight_kg),
                calculatedPrice,
                orderNotes,
                customer?.id ?? null,
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
                     owner_driver_id = $6,
                     vehicle_id = COALESCE($7, vehicle_id),
                     vehicle_group_id = COALESCE($8, vehicle_group_id),
                     estimated_distance_km = COALESCE($9, estimated_distance_km),
                     delivery_at = COALESCE($10, delivery_at),
                     updated_at = NOW()
                 WHERE id = $1`,
                [
                    shipmentId,
                    safeTrim(cargo_name),
                    normalizeNumber(cargo_weight_kg),
                    calculatedPrice,
                    orderNotes,
                    null,
                    vehicle?.id ?? null,
                    finalVehicleGroupId,
                    normalizedDistance,
                    deliveryAt,
                ],
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

const cancelOrder = async (orderId, reason = 'Coordinator cancelled order') => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const shipmentResult = await client.query(
            `SELECT id, status
             FROM order_shipments
             WHERE order_id = $1
             ORDER BY shipment_index ASC
             LIMIT 1
             FOR UPDATE`,
            [orderId],
        );
        const shipment = shipmentResult.rows[0];
        if (!shipment) {
            await client.query('ROLLBACK');
            return null;
        }

        if (['completed', 'cancelled'].includes(String(shipment.status).toLowerCase())) {
            throw new Error('Không thể hủy đơn đã hoàn tất hoặc đã hủy');
        }

        await client.query(
            `UPDATE order_shipments
             SET status = 'cancelled', cancel_reason = $2, cancelled_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [shipment.id, reason],
        );
        await client.query(
            `UPDATE orders
             SET derived_status = 'cancelled', updated_at = NOW()
             WHERE id = $1`,
            [orderId],
        );

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
    getVehicleByPlate,
    getVehicleGroupById,
    listCoordinatorVehicleGroups,
    findOrCreateDriverWithVehicle,
    getDefaultVehicleGroupId,
    findOrCreateCustomer,
    createOrderWithShipment,
    importOrderWithShipment,
    updateOrder,
    cancelOrder,
};
