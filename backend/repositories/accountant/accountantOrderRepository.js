const pool = require('../../config/database');

const orderProjection = `
    SELECT
        o.*,
        CASE WHEN o.payment_type = 'client_credit' THEN 'debt' ELSE o.payment_type END AS payment_type,
        o.cargo_weight_kg AS cargo_weight,
        o.total_estimated_price AS estimated_price,
        os.id AS shipment_id,
        os.status,
        os.vehicle_group_id,
        pickup.address AS pickup_address,
        delivery.address AS delivery_address,
        c.full_name AS customer_name,
        c.company_name AS customer_company,
        c.phone AS customer_phone,
        d.id AS debt_id,
        d.status AS debt_status,
        d.total_amount AS debt_total,
        d.paid_amount AS debt_paid
`;

const baseJoin = `
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN debts d ON o.id = d.order_id
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
`;

const buildWhere = (filters, params) => {
    const conditions = [];

    if (filters.status && filters.status !== 'all') {
        params.push(filters.status);
        conditions.push(`os.status = $${params.length}`);
    }

    if (filters.search) {
        params.push(`%${filters.search}%`);
        conditions.push(`(
            o.cargo_name ILIKE $${params.length}
            OR pickup.address ILIKE $${params.length}
            OR delivery.address ILIKE $${params.length}
            OR CAST(o.id AS TEXT) LIKE $${params.length}
            OR c.full_name ILIKE $${params.length}
            OR c.phone ILIKE $${params.length}
        )`);
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
};

const getAllOrders = async (filters = {}, page = null, limit = null) => {
    const params = [];
    const whereClause = buildWhere(filters, params);

    const countQuery = `SELECT COUNT(DISTINCT o.id) ${baseJoin} ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    let query = `${orderProjection} ${baseJoin} ${whereClause} ORDER BY o.created_at DESC`;

    if (page !== null && limit !== null) {
        const offset = (page - 1) * limit;
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        params.push(offset);
        query += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);
    const totalPages = limit ? Math.ceil(totalItems / limit) : 1;

    return {
        orders: result.rows,
        totalItems,
        totalPages,
        currentPage: page || 1,
        limit: limit || totalItems,
    };
};

const getDefaultVehicleGroupId = async (client) => {
    const result = await client.query('SELECT id FROM vehicle_groups ORDER BY id ASC LIMIT 1');
    const vehicleGroupId = result.rows[0]?.id;
    if (!vehicleGroupId) throw new Error('Chưa có nhóm xe trong hệ thống');
    return vehicleGroupId;
};

const findOrCreateCustomer = async (client, { phone, name, company_name, customer_type = 'individual' }) => {
    const lookup = await client.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    if (lookup.rows.length > 0) {
        return lookup.rows[0].id;
    }

    const insert = await client.query(
        `INSERT INTO customers (customer_type, full_name, company_name, phone, address, current_debt)
         VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
        [customer_type, name, company_name || null, phone, '']
    );
    return insert.rows[0].id;
};

const createTripStops = async (client, shipmentId, orderData) => {
    await client.query(
        `INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone)
         VALUES
            ($1, 1, 'pickup', $2, $4, $5),
            ($1, 2, 'delivery', $3, $4, $5)`,
        [shipmentId, orderData.pickup_address, orderData.delivery_address, orderData.customer_name, orderData.customer_phone]
    );
};

const createOrder = async (orderData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const customerId = await findOrCreateCustomer(client, {
            phone: orderData.customer_phone,
            name: orderData.customer_name,
            company_name: orderData.customer_company,
        });

        const dbPaymentType = orderData.payment_type === 'debt' ? 'client_credit' : orderData.payment_type;
        const estimatedPrice = orderData.estimated_price || 0;
        const vehicleGroupId = await getDefaultVehicleGroupId(client);

        const orderQuery = `
            INSERT INTO orders (
                customer_id, created_by, cargo_name, cargo_weight_kg,
                total_estimated_price, payment_type, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *, cargo_weight_kg AS cargo_weight, total_estimated_price AS estimated_price
        `;
        const orderParams = [
            customerId,
            orderData.created_by,
            orderData.cargo_name,
            orderData.cargo_weight || 0,
            estimatedPrice,
            dbPaymentType || 'cash',
            orderData.notes || '',
        ];

        const orderResult = await client.query(orderQuery, orderParams);
        const newOrder = orderResult.rows[0];

        const shipmentQuery = `
            INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, cargo_name, cargo_weight_kg, estimated_price, status)
            VALUES ($1, 1, $2, $3, $4, $5, 'available')
            RETURNING id
        `;
        const shipmentResult = await client.query(shipmentQuery, [newOrder.id, vehicleGroupId, newOrder.cargo_name, newOrder.cargo_weight_kg, estimatedPrice]);
        await createTripStops(client, shipmentResult.rows[0].id, orderData);

        const debtQuery = `
            INSERT INTO debts (debt_type, customer_id, order_id, shipment_id, total_amount, paid_amount, due_date, status, notes, updated_by)
            VALUES ('customer', $1, $2, $3, $4, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $5, $6)
        `;
        const debtParams = [
            customerId,
            newOrder.id,
            shipmentResult.rows[0].id,
            estimatedPrice,
            `Khởi tạo công nợ tự động cho đơn hàng #${newOrder.id + 8800}`,
            orderData.created_by,
        ];
        await client.query(debtQuery, debtParams);

        await client.query('COMMIT');
        return {
            ...newOrder,
            status: 'available',
            pickup_address: orderData.pickup_address,
            delivery_address: orderData.delivery_address,
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const bulkCreateOrders = async (ordersArray, createdByUserId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const createdOrders = [];
        const vehicleGroupId = await getDefaultVehicleGroupId(client);

        for (const order of ordersArray) {
            const normalizedOrder = {
                customer_phone: order.customer_phone || '0000000000',
                customer_name: order.customer_name || 'Khách hàng Excel',
                customer_company: order.customer_company || null,
                cargo_name: order.cargo_name || 'Hàng hóa tổng hợp',
                cargo_weight: order.cargo_weight || 0,
                pickup_address: order.pickup_address || 'Địa điểm mặc định',
                delivery_address: order.delivery_address || 'Địa điểm mặc định',
                estimated_price: order.estimated_price || 0,
                payment_type: order.payment_type,
                notes: order.notes || 'Imported via Excel',
            };
            const customerId = await findOrCreateCustomer(client, {
                phone: normalizedOrder.customer_phone,
                name: normalizedOrder.customer_name,
                company_name: normalizedOrder.customer_company,
            });

            const dbPaymentType = normalizedOrder.payment_type === 'debt' ? 'client_credit' : normalizedOrder.payment_type;

            const orderQuery = `
                INSERT INTO orders (
                    customer_id, created_by, cargo_name, cargo_weight_kg,
                    total_estimated_price, payment_type, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *, cargo_weight_kg AS cargo_weight, total_estimated_price AS estimated_price
            `;
            const orderParams = [
                customerId,
                createdByUserId,
                normalizedOrder.cargo_name,
                normalizedOrder.cargo_weight,
                normalizedOrder.estimated_price,
                dbPaymentType || 'cash',
                normalizedOrder.notes,
            ];

            const orderResult = await client.query(orderQuery, orderParams);
            const newOrder = orderResult.rows[0];

            const shipmentQuery = `
                INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, cargo_name, cargo_weight_kg, estimated_price, status)
                VALUES ($1, 1, $2, $3, $4, $5, 'available')
                RETURNING id
            `;
            const shipmentResult = await client.query(shipmentQuery, [newOrder.id, vehicleGroupId, newOrder.cargo_name, newOrder.cargo_weight_kg, normalizedOrder.estimated_price]);
            await createTripStops(client, shipmentResult.rows[0].id, normalizedOrder);

            const debtQuery = `
                INSERT INTO debts (debt_type, customer_id, order_id, shipment_id, total_amount, paid_amount, due_date, status, notes, updated_by)
                VALUES ('customer', $1, $2, $3, $4, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $5, $6)
            `;
            const debtParams = [
                customerId,
                newOrder.id,
                shipmentResult.rows[0].id,
                normalizedOrder.estimated_price,
                `Khởi tạo công nợ tự động từ Excel cho đơn hàng #${newOrder.id + 8800}`,
                createdByUserId,
            ];
            await client.query(debtQuery, debtParams);

            createdOrders.push({
                ...newOrder,
                status: 'available',
                pickup_address: normalizedOrder.pickup_address,
                delivery_address: normalizedOrder.delivery_address,
            });
        }

        await client.query('COMMIT');
        return createdOrders;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

module.exports = {
    getAllOrders,
    createOrder,
    bulkCreateOrders,
};
