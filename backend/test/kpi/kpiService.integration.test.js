const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let kpiService;

describe('KPI Service Integration Tests (L2)', () => {
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

        kpiService = require('../../services/kpiService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE kpi_records, vehicle_groups, drivers, profiles, accounts, roles, vehicles RESTART IDENTITY CASCADE');
        
        await pool.query(`INSERT INTO roles (id, name) VALUES (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'd1@test.com', 'hash', 2),
            (2, 'd2@test.com', 'hash', 2)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Driver 1', 2),
            (2, 'Driver 2', 2)`);
            
        await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Truck', 10000)`);
        await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id) VALUES 
            (1, '29A', 1, 1),
            (2, '30A', 1, 2)`);
        await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, license_number, hire_date) VALUES 
            (1, 1, 'L1', CURRENT_DATE),
            (2, 2, 'L2', CURRENT_DATE)`);

        // Insert KPI records for month 10, year 2024
        await pool.query(`INSERT INTO kpi_records (driver_id, vehicle_group_id, month, year, completed_shipments, total_revenue) VALUES 
            (1, 1, 10, 2024, 15, 10000000),
            (2, 1, 10, 2024, 20, 15000000)`);
    });

    it('L2-KPI-01: Happy Path - getMyKPI returns specific driver KPI', async () => {
        if (!pool) return;
        const result = await kpiService.getMyKPI(1, { month: 10, year: 2024 });
        assert.strictEqual(result.completed_shipments, 15);
        assert.strictEqual(Number(result.total_revenue), 10000000);
    });

    it('L2-KPI-02: Happy Path - getLeaderboard ranks drivers correctly', async () => {
        if (!pool) return;
        const result = await kpiService.getLeaderboard(1, { month: 10, year: 2024 });
        
        assert.strictEqual(result.vehicle_group_name, 'Truck');
        assert.strictEqual(result.total_in_group, 2);
        
        // Driver 2 has more revenue, so should be rank 1
        assert.strictEqual(result.leaderboard[0].driver_id, 2);
        assert.strictEqual(result.leaderboard[0].rank_in_group, '1');
        assert.strictEqual(result.leaderboard[1].driver_id, 1);
        assert.strictEqual(result.leaderboard[1].rank_in_group, '2');
    });

    it('L2-KPI-03: Happy Path - getAllDriversKPI returns all KPIs', async () => {
        if (!pool) return;
        const result = await kpiService.getAllDriversKPI({ month: 10, year: 2024 });
        assert.strictEqual(result.length, 2);
    });
});
