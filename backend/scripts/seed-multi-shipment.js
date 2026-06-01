const { Pool } = require('pg');

const pool = new Pool({
    host: 'db', port: 5432,
    database: 'SEP490', user: 'postgres', password: '12345',
});

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const coord    = await client.query('SELECT id FROM profiles WHERE role_id = 2 LIMIT 1');
        const vg       = await client.query('SELECT id FROM vehicle_groups LIMIT 1');
        const customer = await client.query('SELECT id FROM customers LIMIT 1');

        const coordinatorId = coord.rows[0].id;
        const vgId          = vg.rows[0].id;
        const customerId    = customer.rows[0].id;

        const orderResult = await client.query(`
            INSERT INTO orders
                (customer_id, created_by, cargo_name, cargo_weight_kg,
                 pickup_address, delivery_address, estimated_price, payment_type, status)
            VALUES ($1, $2, 'Hàng test multi-trip', 3000,
                    'Kho Tổng - 100 Quoc Lo 13, Binh Duong',
                    'Điểm cuối - 500 Nguyen Hue, Q1, HCM',
                    450000, 'cash', 'assigned')
            RETURNING id
        `, [customerId, coordinatorId]);
        const orderId = orderResult.rows[0].id;

        const shipments = [
            { index: 1, pickup: 'Kho Tổng - 100 Quoc Lo 13, BD',          delivery: 'Trung chuyển A - 200 CMT8, Q3, HCM',    weight: 1000, price: 150000 },
            { index: 2, pickup: 'Trung chuyển A - 200 CMT8, Q3, HCM',     delivery: 'Trung chuyển B - 300 Le Loi, Q1, HCM',  weight: 1000, price: 150000 },
            { index: 3, pickup: 'Trung chuyển B - 300 Le Loi, Q1, HCM',   delivery: 'Điểm cuối - 500 Nguyen Hue, Q1, HCM',   weight: 1000, price: 150000 },
        ];

        for (const s of shipments) {
            await client.query(`
                INSERT INTO order_shipments
                    (order_id, shipment_index, vehicle_group_id,
                     pickup_address, delivery_address, cargo_weight_kg, estimated_price, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'available')
            `, [orderId, s.index, vgId, s.pickup, s.delivery, s.weight, s.price]);
            console.log(`  Leg ${s.index}/3: ${s.pickup} → ${s.delivery} ${s.index === 3 ? '← FINAL (cần ảnh proof)' : ''}`);
        }

        await client.query('COMMIT');
        console.log(`\nOrder #${orderId} — 3 shipments available`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('ERROR:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
