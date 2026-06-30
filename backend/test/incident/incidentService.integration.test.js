const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let incidentService;

describe('Incident Service Integration Tests (L2)', () => {
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

        incidentService = require('../../services/incidentService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE incident_evidences, incidents, order_shipments, orders, customers, vehicles, vehicle_groups, drivers, profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'coordinator'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'coord@test.com', 'hash', 1),
            (2, 'driver@test.com', 'hash', 2)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Coordinator', 1),
            (2, 'Driver 1', 2)`);
        await pool.query(`INSERT INTO drivers (profile_id, license_number, hire_date) VALUES (2, 'L1', CURRENT_DATE)`);
        
        await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Truck', 1000)`);
        await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id) VALUES (1, '29A', 1, 2)`);

        await pool.query(`INSERT INTO customers (id, customer_type, phone) VALUES (1, 'individual', '012')`);
        await pool.query(`INSERT INTO orders (id, customer_id, created_by, total_estimated_price) VALUES (1, 1, 1, 1000)`);
        await pool.query(`INSERT INTO order_shipments (id, order_id, shipment_index, owner_driver_id, vehicle_id, status) VALUES 
            (1, 1, 1, 2, 1, 'transit')`);
    });

    it('L2-INC-01: Happy Path - createIncident inserts to DB and creates evidence', async () => {
        if (!pool) return;
        
        const incident = await incidentService.createIncident(2, { 
            shipmentId: 1, 
            incidentType: 'other', 
            description: 'This is a valid length description' 
        }, ['http://img1.png']);
        
        assert.ok(incident.id);
        assert.strictEqual(incident.incident_type, 'other');

        // Check DB for evidence
        const res = await pool.query('SELECT * FROM incident_evidences WHERE incident_id = $1', [incident.id]);
        assert.strictEqual(res.rows.length, 1);
        assert.strictEqual(res.rows[0].file_url, 'http://img1.png');
    });

    it('L2-INC-02: Happy Path - updateMyIncident modifies description', async () => {
        if (!pool) return;
        const incident = await incidentService.createIncident(2, { shipmentId: 1, incidentType: 'other', description: 'Original description' }, []);
        
        const updated = await incidentService.updateMyIncident(incident.id, 2, { description: 'Updated description' });
        assert.strictEqual(updated.description, 'Updated description');
    });

    it('L2-INC-03: Happy Path - updateIncidentStatus sets status and resolved_at', async () => {
        if (!pool) return;
        const incident = await incidentService.createIncident(2, { shipmentId: 1, incidentType: 'other', description: 'desc desc desc' }, []);
        
        const updated = await incidentService.updateIncidentStatus(incident.id, 1, { status: 'resolved', resolution: 'Fixed' });
        assert.strictEqual(updated.status, 'resolved');
        assert.ok(updated.resolved_at); // Should not be null
    });

    it('L2-INC-04: Error Path - Duplicate incident type on same shipment', async () => {
        if (!pool) return;
        await incidentService.createIncident(2, { shipmentId: 1, incidentType: 'other', description: 'desc desc desc' }, []);
        
        await assert.rejects(
            () => incidentService.createIncident(2, { shipmentId: 1, incidentType: 'other', description: 'desc desc desc' }, []),
            /DUPLICATE_TYPE/
        );
    });
});
