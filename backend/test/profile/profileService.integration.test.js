const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let container;
let pool;
let profileService;

describe('Profile Service Integration Tests (L2)', () => {
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

        profileService = require('../../services/profileService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {
        if (!pool) return;
        await pool.query('TRUNCATE profiles, accounts, roles RESTART IDENTITY CASCADE');
        
        const hash = await bcrypt.hash('password123', 10);

        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'manager'), (2, 'driver') ON CONFLICT DO NOTHING`);
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES 
            (1, 'manager@test.com', $1, 1),
            (2, 'driver@test.com', $1, 2)`, [hash]);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES 
            (1, 'Manager 1', 1),
            (2, 'Driver 1', 2)`);
    });

    it('L2-PRF-01: Happy Path - getMyProfile returns joined data', async () => {
        if (!pool) return;
        const profile = await profileService.getMyProfile(2);
        assert.strictEqual(profile.id, 2);
        assert.strictEqual(profile.email, 'driver@test.com');
        assert.strictEqual(profile.role, 'driver');
    });

    it('L2-PRF-02: Happy Path - updateMyProfile updates profile in DB', async () => {
        if (!pool) return;
        await profileService.updateMyProfile(2, { full_name: 'Driver 2 Updated', phone: '0987654321' });
        
        const profile = await profileService.getMyProfile(2);
        assert.strictEqual(profile.full_name, 'Driver 2 Updated');
        assert.strictEqual(profile.phone, '0987654321');
    });

    it('L2-PRF-03: Happy Path - updateAvatar updates avatar in DB', async () => {
        if (!pool) return;
        await profileService.updateAvatar(2, 'http://avatar.jpg');
        
        const profile = await profileService.getMyProfile(2);
        assert.strictEqual(profile.avatar_url, 'http://avatar.jpg');
    });

    it('L2-PRF-04: Happy Path - changePassword updates hash', async () => {
        if (!pool) return;
        
        // Change from password123 to newpass123
        await profileService.changePassword(2, { currentPassword: 'password123', newPassword: 'newpass123' });
        
        // Verify new hash
        const res = await pool.query('SELECT password_hash FROM accounts WHERE id = 2');
        const valid = await bcrypt.compare('newpass123', res.rows[0].password_hash);
        assert.ok(valid);
    });
});
