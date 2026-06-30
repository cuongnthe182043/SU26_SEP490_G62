const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');

let container;
let pool;
let notificationService;

describe('Notification Service Integration Tests (L2)', () => {
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

        notificationService = require('../../services/notificationService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE notifications, profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'manager'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'manager@test.com', 'hash', 1),
            (2, 'driver@test.com', 'hash', 2)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Manager 1', 1),
            (2, 'Driver 1', 2)`);
    });

    it('L2-NOTI-01: Happy Path - createForUser saves notification to DB', async () => {
        if (!pool) return;
        const noti = await notificationService.createForUser(2, { 
            title: 'Test Alert', 
            message: 'You have a message', 
            type: 'INFO' 
        });
        assert.ok(noti.id);
        assert.strictEqual(noti.title, 'Test Alert');

        const { notifications, unreadCount } = await notificationService.listForUser(2);
        assert.strictEqual(notifications.length, 1);
        assert.strictEqual(Number(unreadCount), 1);
    });

    it('L2-NOTI-02: Happy Path - markAsRead updates DB status', async () => {
        if (!pool) return;
        const noti = await notificationService.createForUser(2, { title: 'To read' });
        
        await notificationService.markAsRead(2, noti.id);
        
        const { unreadCount } = await notificationService.listForUser(2);
        assert.strictEqual(Number(unreadCount), 0);
    });

    it('L2-NOTI-03: Happy Path - getUserIdsByRole fetches correct users', async () => {
        if (!pool) return;
        const driverIds = await notificationService.getUserIdsByRole('driver');
        assert.strictEqual(driverIds.length, 1);
        assert.strictEqual(driverIds[0], 2);
    });
});
