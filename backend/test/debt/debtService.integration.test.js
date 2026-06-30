const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let debtService;

describe('Debt Service Integration Tests (L2)', () => {
    before(async () => {
        container = await new PostgreSqlContainer("postgres:16-alpine").start();
        process.env.DB_HOST = container.getHost();
        process.env.DB_PORT = container.getPort();
        process.env.DB_NAME = container.getDatabase();
        process.env.DB_USER = container.getUsername();
        process.env.DB_PASSWORD = container.getPassword();

        pool = require('../../config/database');
        
        // Load the schema from root dir
        const schemaPath = path.join(__dirname, '../../../../DB script/DB script.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);

        debtService = require('../../services/debtService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        await pool.query('TRUNCATE debt_payments, debts, order_shipments, orders, customers, drivers, profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        // Seed base dependencies
        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'manager'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'manager@test.com', 'hash', 1),
            (2, 'driver@test.com', 'hash', 2) ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Manager', 1),
            (2, 'Driver 1', 2) ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO drivers (profile_id, license_number, hire_date) VALUES (2, 'L123', CURRENT_DATE)`);
        
        await pool.query(`INSERT INTO customers (id, customer_type, phone) VALUES (1, 'individual', '0123')`);
        await pool.query(`INSERT INTO orders (id, customer_id, created_by, total_estimated_price) VALUES (1, 1, 1, 1000)`);
        await pool.query(`INSERT INTO order_shipments (id, order_id, shipment_index, owner_driver_id, status) VALUES (1, 1, 1, 2, 'completed')`);
        
        // Seed debt
        await pool.query(`INSERT INTO debts (id, debt_type, driver_id, shipment_id, total_amount, paid_amount, status) 
            VALUES (1, 'driver', 2, 1, 5000, 0, 'unpaid')`);
    });

    it('L2-DEBT-01: Happy Path - submitRepayment inserts pending payment', async () => {
        const result = await debtService.submitRepayment(2, 1, { amount: 2000, paymentMethod: 'bank_transfer', notes: 'test' }, 'http://receipt');
        assert.ok(result.id, 'Expected payment to be created');
        
        const payments = await debtService.getDebtPayments(2, 1);
        assert.strictEqual(payments.length, 1);
        assert.strictEqual(payments[0].status, 'pending');
        assert.strictEqual(Number(payments[0].amount), 2000);
    });

    it('L2-DEBT-02: Happy Path - confirmRepayment reduces debt', async () => {
        // Create pending payment first
        const payment = await debtService.submitRepayment(2, 1, { amount: 1500, paymentMethod: 'cash' }, 'http://receipt');
        
        // Confirm it via manager (id: 1)
        await debtService.confirmRepayment(payment.id, 1);
        
        // Check debt status
        const summary = await debtService.getMyDebtSummary(2);
        assert.strictEqual(Number(summary.total_debt), 5000);
        assert.strictEqual(Number(summary.total_paid), 1500);
        assert.strictEqual(Number(summary.remaining), 3500);
    });

    it('L2-DEBT-03: Happy Path - getPendingRepayments returns correct list', async () => {
        await debtService.submitRepayment(2, 1, { amount: 1000, paymentMethod: 'bank_transfer' }, 'http://receipt');
        
        const pending = await debtService.getPendingRepayments();
        assert.strictEqual(pending.length, 1);
        assert.strictEqual(pending[0].driver_name, 'Driver 1');
        assert.strictEqual(Number(pending[0].amount), 1000);
    });

    it('L2-DEBT-04: Error Path - submitRepayment fails if receipt missing', async () => {
        await assert.rejects(
            () => debtService.submitRepayment(2, 1, { amount: 1000, paymentMethod: 'cash' }, ''),
            { message: 'Ảnh chứng từ là bắt buộc' }
        );
        // Ensure no payment was created
        const pending = await debtService.getPendingRepayments();
        assert.strictEqual(pending.length, 0);
    });
});
