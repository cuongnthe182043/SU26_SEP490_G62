const pool = require('../config/database');

/**
 * Get all orders with customer details
 */
const getAllOrders = async (filters = {}) => {
    let query = `
        SELECT o.*, 
               c.full_name as customer_name, 
               c.company_name as customer_company, 
               c.phone as customer_phone,
               d.id as debt_id,
               d.status as debt_status,
               d.total_amount as debt_total,
               d.paid_amount as debt_paid
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
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY o.created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Find or create a customer by phone number
 */
const findOrCreateCustomer = async (client, { phone, name, company_name, customer_type = 'individual' }) => {
    // Look up by phone
    const lookup = await client.query('SELECT id FROM customers WHERE phone = $1', [phone]);
    if (lookup.rows.length > 0) {
        return lookup.rows[0].id;
    }

    // Create new customer
    const insert = await client.query(
        `INSERT INTO customers (customer_type, full_name, company_name, phone, address, current_debt)
         VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
        [customer_type, name, company_name || null, phone, '']
    );
    return insert.rows[0].id;
};

/**
 * Create a single order
 */
const createOrder = async (orderData) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Resolve customer
        const customerId = await findOrCreateCustomer(client, {
            phone: orderData.customer_phone,
            name: orderData.customer_name,
            company_name: orderData.customer_company,
        });

        // Insert order
        const orderQuery = `
            INSERT INTO orders (
                customer_id, created_by, cargo_name, cargo_weight, 
                pickup_address, delivery_address, estimated_price, 
                payment_type, status, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        const orderParams = [
            customerId,
            orderData.created_by,
            orderData.cargo_name,
            orderData.cargo_weight || 0,
            orderData.pickup_address,
            orderData.delivery_address,
            orderData.estimated_price || 0,
            orderData.payment_type || 'cash',
            orderData.status || 'pending',
            orderData.notes || ''
        ];

        const orderResult = await client.query(orderQuery, orderParams);
        
        // Create an automatic shipment for this order (1-to-1 default)
        const newOrder = orderResult.rows[0];
        const shipmentQuery = `
            INSERT INTO order_shipments (order_id, shipment_index, pickup_address, delivery_address, cargo_weight, status)
            VALUES ($1, 1, $2, $3, $4, 'pending')
        `;
        await client.query(shipmentQuery, [newOrder.id, newOrder.pickup_address, newOrder.delivery_address, newOrder.cargo_weight]);

        // Create an automatic debt tracking entry for this order
        const debtQuery = `
            INSERT INTO debts (debt_type, customer_id, order_id, total_amount, paid_amount, due_date, status, notes, updated_by)
            VALUES ('customer', $1, $2, $3, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $4, $5)
        `;
        const debtParams = [
            customerId,
            newOrder.id,
            newOrder.estimated_price || 0,
            `Khởi tạo công nợ tự động cho đơn hàng #${newOrder.id + 8800}`,
            orderData.created_by
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

/**
 * Bulk create orders from Excel upload
 */
const bulkCreateOrders = async (ordersArray, createdByUserId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const createdOrders = [];

        for (const order of ordersArray) {
            // Resolve customer
            const customerId = await findOrCreateCustomer(client, {
                phone: order.customer_phone || '0000000000',
                name: order.customer_name || 'Khách hàng Excel',
                company_name: order.customer_company || null,
            });

            // Insert order
            const orderQuery = `
                INSERT INTO orders (
                    customer_id, created_by, cargo_name, cargo_weight, 
                    pickup_address, delivery_address, estimated_price, 
                    payment_type, status, notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
                RETURNING *
            `;
            const orderParams = [
                customerId,
                createdByUserId,
                order.cargo_name || 'Hàng hóa tổng hợp',
                order.cargo_weight || 0,
                order.pickup_address || 'Địa điểm mặc định',
                order.delivery_address || 'Địa điểm mặc định',
                order.estimated_price || 0,
                order.payment_type || 'cash',
                order.notes || 'Imported via Excel'
            ];

            const orderResult = await client.query(orderQuery, orderParams);
            const newOrder = orderResult.rows[0];
            
            // Create corresponding shipment
            const shipmentQuery = `
                INSERT INTO order_shipments (order_id, shipment_index, pickup_address, delivery_address, cargo_weight, status)
                VALUES ($1, 1, $2, $3, $4, 'pending')
            `;
            await client.query(shipmentQuery, [newOrder.id, newOrder.pickup_address, newOrder.delivery_address, newOrder.cargo_weight]);
            
            // Create automatic debt entry
            const debtQuery = `
                INSERT INTO debts (debt_type, customer_id, order_id, total_amount, paid_amount, due_date, status, notes, updated_by)
                VALUES ('customer', $1, $2, $3, 0, CURRENT_DATE + INTERVAL '30 days', 'unpaid', $4, $5)
            `;
            const debtParams = [
                customerId,
                newOrder.id,
                newOrder.estimated_price || 0,
                `Khởi tạo công nợ tự động từ Excel cho đơn hàng #${newOrder.id + 8800}`,
                createdByUserId
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
