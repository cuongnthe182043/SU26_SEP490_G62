const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let driverService;

describe('Driver Service Integration Tests (L2)', () => {
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

        driverService = require('../../services/driverService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE maintenance_records, vehicles, vehicle_groups, drivers, profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'manager'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'manager@test.com', 'hash', 1),
            (2, 'driver@test.com', 'hash', 2)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Manager 1', 1),
            (2, 'Driver 1', 2)`);
            
        await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Truck', 10000)`);
        await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id) VALUES 
            (1, '29A', 1, 1)`);
        await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, license_number, hire_date) VALUES 
            (2, 1, 'L1', CURRENT_DATE)`);

        // Insert open maintenance record
        await pool.query(`INSERT INTO maintenance_records (id, vehicle_id, maintenance_type, maintenance_date, performed_by, status, created_by) VALUES 
            (1, 1, 'repair', CURRENT_DATE, 2, 'open', 1)`);
    });

    it('L2-DRV-01: Happy Path - uploadMaintenanceBill updates bill_pics array', async () => {
        if (!pool) return;
        const result = await driverService.uploadMaintenanceBill(2, 1, 'http://bill.png');
        assert.strictEqual(result.maintenanceRecordId, 1);
        assert.deepStrictEqual(result.bill_pics, ['http://bill.png']);

        const list = await driverService.listMaintenanceForDriver(2);
        assert.deepStrictEqual(list[0].bill_pics, ['http://bill.png']);
    });

    it('L2-DRV-02: Happy Path - updateMaintenanceCost saves cost', async () => {
        if (!pool) return;
        const result = await driverService.updateMaintenanceCost(2, 1, 500000);
        assert.strictEqual(result.maintenanceRecordId, 1);
        assert.strictEqual(result.cost, 500000);
    });

    it('L2-DRV-03: Happy Path - completeMaintenance sets status to pending_verification', async () => {
        if (!pool) return;
        // Must upload bill first
        await driverService.uploadMaintenanceBill(2, 1, 'http://bill.png');
        
        await driverService.completeMaintenance(2, 1, { cost: 500000 });
        
        const list = await driverService.listMaintenanceForDriver(2);
        assert.strictEqual(list[0].status, 'pending_verification');
        assert.strictEqual(Number(list[0].cost), 500000);
    });
});
