const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let paymentService;

describe('Payment Service Integration Tests (L2)', () => {
    before(async () => {
        try {
            container = await new PostgreSqlContainer("postgres:16-alpine").start();
            process.env.DB_HOST = container.getHost();
            process.env.DB_PORT = container.getPort();
            process.env.DB_NAME = container.getDatabase();
            process.env.DB_USER = container.getUsername();
            process.env.DB_PASSWORD = container.getPassword();
        } catch (e) {
            console.error('Failed to start Testcontainer. Skipping L2 setup.', e);
            return;
        }

        pool = require('../../config/database');
        
        const schemaPath = path.join(__dirname, '../../../../DB script/DB script.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);

        paymentService = require('../../services/paymentService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE debts, payment_receipts, shipment_receipts, order_shipments, orders, customers, vehicles, vehicle_groups, drivers, profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'manager'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (2, 'driver@test.com', 'hash', 2)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (2, 'Driver 1', 2)`);
        await pool.query(`INSERT INTO drivers (profile_id, license_number, hire_date) VALUES (2, 'L123', CURRENT_DATE)`);
        
        await pool.query(`INSERT INTO customers (id, customer_type, phone) VALUES (1, 'individual', '0123')`);
        
        // order_payment_type must not be 'bank_transfer'
        await pool.query(`INSERT INTO orders (id, customer_id, created_by, total_estimated_price, payment_type) VALUES 
            (1, 1, 2, 1000, 'cash')`);
        
        // shipment status must be in ['arrived', 'transit', 'completed']
        await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Truck', 10000)`);
        await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id) VALUES (1, '29A', 1, 2)`);
        
        await pool.query(`INSERT INTO order_shipments (id, order_id, shipment_index, owner_driver_id, vehicle_id, status) VALUES 
            (1, 1, 1, 2, 1, 'completed')`);
    });

    it('L2-PAY-01: Happy Path - recordDriverCashPayment saves receipt and debt', async () => {
        if (!pool) return;
        
        const result = await paymentService.recordDriverCashPayment(2, 1, { amount: 500, notes: 't' }, 'http://receipt.png');
        assert.ok(result.payment.id);

        const payments = await paymentService.getShipmentPayments(1, 2);
        assert.strictEqual(payments.length, 1);
        assert.strictEqual(Number(payments[0].amount), 500);

        // Verify driver debt was created
        const debts = await pool.query(`SELECT * FROM debts WHERE driver_id = 2`);
        assert.strictEqual(debts.rows.length, 1);
        assert.strictEqual(Number(debts.rows[0].total_amount), 500);
    });

    it('L2-PAY-02: Happy Path - updateCashPayment updates amount', async () => {
        if (!pool) return;
        const recorded = await paymentService.recordDriverCashPayment(2, 1, { amount: 500 }, 'url');
        
        await paymentService.updateCashPayment(2, 1, recorded.payment.id, { newAmount: 800 });
        
        const payments = await paymentService.getShipmentPayments(1, 2);
        assert.strictEqual(Number(payments[0].amount), 800);
    });

    it('L2-PAY-03: Error Path - cannot record for unowned shipment', async () => {
        if (!pool) return;
        await assert.rejects(
            () => paymentService.recordDriverCashPayment(99, 1, { amount: 500 }, 'url'),
            { message: 'Bạn không có quyền ghi nhận thanh toán cho chuyến này' }
        );
    });
});
