const pool = require('../../config/database');

const getAllOrders = async (filters = {}, page = null, limit = null) => {
    let baseQuery = `
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN debts d ON o.id = d.order_id
    `;
    const params = [];
    const conditions = [];

    if (filters.status && filters.status !== 'all') {
        params.push(filters.status);
        conditions.push(`o.status = $${params.length}`);
    }

    if (filters.search) {
        params.push(`%${filters.search}%`);
        conditions.push(`(o.cargo_name ILIKE $${params.length} OR o.pickup_address ILIKE $${params.length} OR o.delivery_address ILIKE $${params.length} OR CAST(o.id AS TEXT) LIKE $${params.length} OR c.full_name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
        baseQuery += ' WHERE ' + conditions.join(' AND ');
    }

    const countQuery = `SELECT COUNT(o.id) ${baseQuery}`;
    const countResult = await pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);

    let query = `
        SELECT o.*, 
               CASE WHEN o.payment_type = 'client_credit' THEN 'debt' ELSE o.payment_type END as payment_type,
               o.cargo_weight_kg as cargo_weight,
               c.full_name as customer_name, 
               c.company_name as customer_company, 
               c.phone as customer_phone,
               d.id as debt_id,
               d.status as debt_status,
               d.total_amount as debt_total,
               d.paid_amount as debt_paid
        ${baseQuery}
        ORDER BY o.created_at DESC
    `;

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

        const orderQuery = `
            INSERT INTO orders (
                customer_id, created_by, cargo_name, cargo_weight_kg, 
                pickup_address, delivery_address, estimated_price, 
                payment_type, status, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *, cargo_weight_kg as cargo_weight
        `;
        const orderParams = [
            customerId,
            orderData.created_by,
            orderData.cargo_name,
            orderData.cargo_weight || 0,
            orderData.pickup_address,
            orderData.delivery_address,
            orderData.estimated_price || 0,
            dbPaymentType || 'cash',
            orderData.status || 'pending',
            orderData.notes || '',
        ];

        const orderResult = await client.query(orderQuery, orderParams);
        const newOrder = orderResult.rows[0];

        const shipmentQuery = `
            INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, pickup_address, delivery_address, cargo_weight_kg, status)
            VALUES ($1, 1, 1, $2, $3, $4, 'available')
        `;
        await client.query(shipmentQuery, [newOrder.id, newOrder.pickup_address, newOrder.delivery_address, newOrder.cargo_weight_kg]);

        const debtQuery = `
            INSERT INTO debts (debt_type, customer_id, order_id, total_amount, paid_amount, due_date, status, notes, updated_by)
            VALUES ('customer', $1, $2, $3, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $4, $5)
        `;
        const debtParams = [
            customerId,
            newOrder.id,
            newOrder.estimated_price || 0,
            `Khởi tạo công nợ tự động cho đơn hàng #${newOrder.id + 8800}`,
            orderData.created_by,
        ];
        await client.query(debtQuery, debtParams);

        await client.query('COMMIT');
        return newOrder;
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

        for (const order of ordersArray) {
            const customerId = await findOrCreateCustomer(client, {
                phone: order.customer_phone || '0000000000',
                name: order.customer_name || 'Khách hàng Excel',
                company_name: order.customer_company || null,
            });

            const dbPaymentType = order.payment_type === 'debt' ? 'client_credit' : order.payment_type;

            const orderQuery = `
                INSERT INTO orders (
                    customer_id, created_by, cargo_name, cargo_weight_kg, 
                    pickup_address, delivery_address, estimated_price, 
                    payment_type, status, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
                RETURNING *, cargo_weight_kg as cargo_weight
            `;
            const orderParams = [
                customerId,
                createdByUserId,
                order.cargo_name || 'Hàng hóa tổng hợp',
                order.cargo_weight || 0,
                order.pickup_address || 'Địa điểm mặc định',
                order.delivery_address || 'Địa điểm mặc định',
                order.estimated_price || 0,
                dbPaymentType || 'cash',
                order.notes || 'Imported via Excel',
            ];

            const orderResult = await client.query(orderQuery, orderParams);
            const newOrder = orderResult.rows[0];

            const shipmentQuery = `
                INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, pickup_address, delivery_address, cargo_weight_kg, status)
                VALUES ($1, 1, 1, $2, $3, $4, 'available')
            `;
            await client.query(shipmentQuery, [newOrder.id, newOrder.pickup_address, newOrder.delivery_address, newOrder.cargo_weight_kg]);

            const debtQuery = `
                INSERT INTO debts (debt_type, customer_id, order_id, total_amount, paid_amount, due_date, status, notes, updated_by)
                VALUES ('customer', $1, $2, $3, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $4, $5)
            `;
            const debtParams = [
                customerId,
                newOrder.id,
                newOrder.estimated_price || 0,
                `Khởi tạo công nợ tự động từ Excel cho đơn hàng #${newOrder.id + 8800}`,
                createdByUserId,
            ];
            await client.query(debtQuery, debtParams);

            createdOrders.push(newOrder);
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
