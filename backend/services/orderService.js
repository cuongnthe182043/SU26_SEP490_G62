const pool = require('../config/database');
const XLSX = require('xlsx');

const normalizeNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numericValue = Number(String(value).replace(/,/g, '').trim());
    if (Number.isNaN(numericValue)) throw new Error('Số tiền hoặc khối lượng không hợp lệ');
    return numericValue;
};

const safeTrim = (value) => String(value ?? '').trim();
const normalizePhone = (value) => safeTrim(value).replace(/[^\d+]/g, '');

const parseExcelDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    const text = String(value).trim();
    const isoLike = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoLike) return text;

    const slashLike = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashLike) {
        const [, day, month, year] = slashLike;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
};

const findOrCreateCustomer = async (client, customerName, customerPhone) => {
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

const listOrders = async () => {
    const result = await pool.query(
        `SELECT
            o.id,
            o.customer_id,
            o.cargo_name,
            o.cargo_weight_kg,
            o.pickup_address,
            o.delivery_address,
            o.estimated_price,
            o.status,
            o.notes,
            o.created_at,
            o.updated_at,
            s.completed_at,
            c.full_name AS customer_name,
            c.phone AS customer_phone,
            d.full_name AS driver_name
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
         LEFT JOIN LATERAL (
            SELECT s1.completed_at
            FROM order_shipments s1
            WHERE s1.order_id = o.id
            ORDER BY s1.shipment_index DESC
            LIMIT 1
         ) s ON TRUE
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
        customer_name,
        customer_phone,
        cargo_name,
        cargo_weight_kg,
        pickup_address,
        delivery_address,
        estimated_price,
        notes,
    } = payload;

    if (!pickup_address || !delivery_address || !estimated_price) {
        throw new Error('Thiếu thông tin bắt buộc');
    }

    const normalizedWeight = normalizeNumber(cargo_weight_kg);
    const normalizedPrice = normalizeNumber(estimated_price);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const customer = await findOrCreateCustomer(client, customer_name, customer_phone);

        const orderResult = await client.query(
            `INSERT INTO orders
                (customer_id, created_by, cargo_name, cargo_weight_kg, pickup_address, delivery_address, estimated_price, status, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
             RETURNING *`,
            [
                customer?.id ?? null,
                userId,
                safeTrim(cargo_name) || `${safeTrim(pickup_address)} - ${safeTrim(delivery_address)}`,
                normalizedWeight,
                safeTrim(pickup_address),
                safeTrim(delivery_address),
                normalizedPrice,
                [
                    customer_name ? `Khách hàng: ${safeTrim(customer_name)}` : '',
                    customer_phone ? `SĐT: ${normalizePhone(customer_phone)}` : '',
                    notes ? safeTrim(notes) : '',
                ].filter(Boolean).join(' | ') || null,
            ],
        );

        const order = orderResult.rows[0];
        const shipmentResult = await client.query(
            `INSERT INTO order_shipments
                (order_id, shipment_index, vehicle_group_id, owner_driver_id, pickup_address, delivery_address, cargo_weight_kg, estimated_price, status, notes, completed_at)
             VALUES ($1, 1, 1, NULL, $2, $3, $4, $5, 'available', $6, NULL)
             RETURNING *`,
            [
                order.id,
                order.pickup_address,
                order.delivery_address,
                order.cargo_weight_kg,
                order.estimated_price,
                order.notes,
            ],
        );

        await client.query('COMMIT');
        return { order, shipment: shipmentResult.rows[0] };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const importOrdersFromExcel = async (userId, fileBuffer) => {
    if (!fileBuffer) throw new Error('Thiếu file Excel');

    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('File Excel không có sheet nào');

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) return [];

    const client = await pool.connect();
    const createdOrders = [];

    try {
        await client.query('BEGIN');

        for (const row of rows) {
            const date = parseExcelDate(row['Ngày'] ?? row.date);
            const checkIn = safeTrim(row['Chấm công'] ?? row.checkIn);
            const plate = safeTrim(row['BKS'] ?? row.plate);
            const customerName = safeTrim(row['Khách hàng'] ?? row.customer_name);
            const customerPhone = normalizePhone(row['SĐT'] ?? row.phone);
            const pickupAddress = safeTrim(row['Điểm lấy hàng'] ?? row.pickup_address);
            const deliveryAddress = safeTrim(row['Điểm giao hàng'] ?? row.delivery_address);
            const route = safeTrim(row['Hành trình'] ?? row.route);
            const estimatedPrice = normalizeNumber(row['Cước xe'] ?? row.fare);

            const missing = [];
            if (!date) missing.push('Ngày');
            if (!checkIn) missing.push('Chấm công');
            if (!plate) missing.push('BKS');
            if (!pickupAddress) missing.push('Điểm lấy hàng');
            if (!deliveryAddress) missing.push('Điểm giao hàng');
            if (estimatedPrice === null) missing.push('Cước xe');
            if (missing.length > 0) {
                throw new Error(`Thiếu thông tin bắt buộc trong file Excel: ${missing.join(', ')}`);
            }

            const customer = await findOrCreateCustomer(client, customerName, customerPhone);
            const notes = [
                `Ngày: ${date}`,
                `Chấm công: ${checkIn}`,
                `BKS: ${plate}`,
                customerName ? `Khách hàng: ${customerName}` : '',
                customerPhone ? `SĐT: ${customerPhone}` : '',
                route ? `Hành trình: ${route}` : `Hành trình: ${pickupAddress} - ${deliveryAddress}`,
                row['Doanh thu'] ? `Doanh thu: ${safeTrim(row['Doanh thu'])}` : '',
            ].filter(Boolean).join(' | ');

            const orderResult = await client.query(
                `INSERT INTO orders
                    (customer_id, created_by, cargo_name, cargo_weight_kg, pickup_address, delivery_address, estimated_price, status, notes)
                 VALUES ($1, $2, $3, NULL, $4, $5, $6, 'pending', $7)
                 RETURNING *`,
                [
                    customer?.id ?? null,
                    userId,
                    route || `${pickupAddress} - ${deliveryAddress}`,
                    pickupAddress,
                    deliveryAddress,
                    estimatedPrice,
                    notes,
                ],
            );

            const order = orderResult.rows[0];
            const shipmentResult = await client.query(
                `INSERT INTO order_shipments
                    (order_id, shipment_index, vehicle_group_id, owner_driver_id, pickup_address, delivery_address, cargo_weight_kg, estimated_price, status, notes, completed_at)
                 VALUES ($1, 1, 1, NULL, $2, $3, NULL, $4, 'available', $5, NULL)
                 RETURNING *`,
                [order.id, pickupAddress, deliveryAddress, estimatedPrice, notes],
            );

            createdOrders.push({ order, shipment: shipmentResult.rows[0] });
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

const updateOrder = async (orderId, payload) => {
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

    const result = await pool.query(
        `UPDATE orders
         SET cargo_name = COALESCE(NULLIF($2, ''), cargo_name),
             cargo_weight_kg = COALESCE($3, cargo_weight_kg),
             pickup_address = COALESCE(NULLIF($4, ''), pickup_address),
             delivery_address = COALESCE(NULLIF($5, ''), delivery_address),
             estimated_price = COALESCE($6, estimated_price),
             notes = COALESCE(NULLIF($7, ''), notes),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
            orderId,
            safeTrim(cargo_name),
            normalizeNumber(cargo_weight_kg),
            safeTrim(pickup_address),
            safeTrim(delivery_address),
            normalizeNumber(estimated_price),
            safeTrim(notes) || [
                customer_name ? `Khách hàng: ${safeTrim(customer_name)}` : '',
                customer_phone ? `SĐT: ${normalizePhone(customer_phone)}` : '',
            ].filter(Boolean).join(' | ') || null,
        ],
    );

    return result.rows[0] ?? null;
};

module.exports = { listOrders, createOrder, importOrdersFromExcel, updateOrder };
