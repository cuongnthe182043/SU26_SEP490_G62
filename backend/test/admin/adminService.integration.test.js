const { describe, it, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const { PostgreSqlContainer } = require('@testcontainers/postgresql');

let container;
let pool;
let adminService;
let emailService;

describe('Admin Service Integration Tests (L2)', () => {
    before(async () => {

        container = await new PostgreSqlContainer("postgres:16-alpine").start();

        process.env.DB_HOST = container.getHost();
        process.env.DB_PORT = container.getPort();
        process.env.DB_NAME = container.getDatabase();
        process.env.DB_USER = container.getUsername();
        process.env.DB_PASSWORD = container.getPassword();

        pool = require('../../config/database');

        await pool.query(`
            CREATE TABLE roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL
            );

            CREATE TABLE accounts (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role_id INT REFERENCES roles(id),
                is_active BOOLEAN DEFAULT true,
                last_login_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE profiles (
                id INT PRIMARY KEY REFERENCES accounts(id),
                full_name VARCHAR(255),
                phone VARCHAR(20) UNIQUE,
                role_id INT REFERENCES roles(id),
                avatar_url VARCHAR(255),
                dob DATE,
                gender VARCHAR(20),
                address VARCHAR(255),
                city VARCHAR(100),
                country VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        adminService = require('../../services/adminService');
        emailService = require('../../services/emailService');
    });

    after(async () => {
        if (pool) await pool.end();
        if (container) await container.stop();
    });

    beforeEach(async () => {

        await pool.query('TRUNCATE profiles, accounts, roles RESTART IDENTITY CASCADE');

        await pool.query(`INSERT INTO roles (id, name) VALUES (1, 'admin'), (2, 'manager'), (3, 'user')`);

        await pool.query(`
            INSERT INTO accounts (id, email, password_hash, role_id, is_active) VALUES 
            (1, 'admin1@test.com', 'hash', 1, true),
            (2, 'manager1@test.com', 'hash', 2, true),
            (3, 'user1@test.com', 'hash', 3, true),
            (4, 'user2@test.com', 'hash', 3, false)
        `);

        await pool.query(`
            INSERT INTO profiles (id, full_name, phone, role_id) VALUES 
            (1, 'Admin One', '000', 1),
            (2, 'Manager One', '111', 2),
            (3, 'User One', '222', 3),
            (4, 'User Two', '333', 3)
        `);

        await pool.query(`SELECT setval('accounts_id_seq', 4, true)`);

        mock.method(emailService, 'sendWelcomeEmail', async () => {});
    });

    afterEach(() => {
        mock.restoreAll();
    });

    it('L2-AS-01 [Happy Path] (FE-06 / UC-03): getAllUsers - should return 4 seeded users', async () => {
        const users = await adminService.getAllUsers();
        assert.strictEqual(users.length, 4);
        assert.strictEqual(users[0].email, 'admin1@test.com');
    });

    it('L2-AS-02 [Error Path] (FE-06 / UC-03): getAllUsers - DB Connection failed', async () => {
        const originalQuery = pool.query;
        pool.query = () => Promise.reject(new Error('DB Connection failed'));

        await assert.rejects(() => adminService.getAllUsers(), /DB Connection failed/);

        pool.query = originalQuery;
    });

    it('L2-AS-03 [Happy Path] (FE-06 / UC-03): createUser - success flow', async () => {
        const newId = await adminService.createUser('new@test.com', 'New Name', '012', 'admin');

        const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [newId]);
        assert.strictEqual(account.rows.length, 1);
        assert.strictEqual(account.rows[0].email, 'new@test.com');

        const profile = await pool.query('SELECT * FROM profiles WHERE id = $1', [newId]);
        assert.strictEqual(profile.rows.length, 1);
        assert.strictEqual(profile.rows[0].phone, '012');

        assert.strictEqual(emailService.sendWelcomeEmail.mock.calls.length, 1);
    });

    it('L2-AS-04 [Error Path] (FE-06 / UC-03): createUser - duplicate email', async () => {
        const beforeCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;

        await assert.rejects(
            () => adminService.createUser('admin1@test.com', 'Dup', '999', 'admin'),
            (err) => err.status === 409 && err.message === 'Email đã tồn tại.'
        );

        const afterCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;
        assert.strictEqual(beforeCount, afterCount);
    });

    it('L2-AS-05 [Transaction Boundary] (FE-06 / UC-03): createUser - rollback on partial insert failure', async () => {
        const beforeCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;

        await assert.rejects(
            () => adminService.createUser('unique@test.com', 'Fail Profile', '000', 'admin'),
            /Số điện thoại hoặc Email đã tồn tại/
        );

        const afterCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;
        assert.strictEqual(beforeCount, afterCount);

        assert.strictEqual(emailService.sendWelcomeEmail.mock.calls.length, 0);
    });

    it('L2-AS-06 [Concurrency] (FE-06 / UC-03): createUser - concurrent identical requests', async () => {
        const beforeCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;

        const results = await Promise.allSettled([
            adminService.createUser('concurrent@test.com', 'Concurrent', '12345', 'admin'),
            adminService.createUser('concurrent@test.com', 'Concurrent', '12345', 'admin')
        ]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        assert.strictEqual(fulfilled.length, 1);
        assert.strictEqual(rejected.length, 1);

        const afterCount = (await pool.query('SELECT count(*) FROM accounts')).rows[0].count;
        assert.strictEqual(Number(afterCount), Number(beforeCount) + 1);
    });

    it('L2-AS-07 [Happy Path] (FE-06 / UC-04): updateUser - success update', async () => {
        await adminService.updateUser(1, 'Updated Name', '999', 'manager');

        const profile = await pool.query('SELECT full_name, phone, role_id FROM profiles WHERE id = 1');
        assert.strictEqual(profile.rows[0].full_name, 'Updated Name');
        assert.strictEqual(profile.rows[0].phone, '999');
        assert.strictEqual(profile.rows[0].role_id, 2);
    });

    it('L2-AS-08 [Error Path] (FE-06 / UC-04): updateUser - duplicate phone number', async () => {
        await assert.rejects(
            () => adminService.updateUser(1, 'Updated Name', '111', 'manager'),
            (err) => err.status === 409 && err.message === 'Số điện thoại đã tồn tại.'
        );

        const profile = await pool.query('SELECT phone FROM profiles WHERE id = 1');
        assert.strictEqual(profile.rows[0].phone, '000');
    });

    it('L2-AS-09 [Happy Path] (FE-06 / UC-05): toggleUserStatus - success deactivate', async () => {
        await adminService.toggleUserStatus(2, false, 1);

        const account = await pool.query('SELECT is_active FROM accounts WHERE id = 2');
        assert.strictEqual(account.rows[0].is_active, false);
    });

    it('L2-AS-10 [Error Path] (FE-06 / UC-05): toggleUserStatus - cannot lock self', async () => {
        await assert.rejects(
            () => adminService.toggleUserStatus(1, false, 1),
            (err) => err.status === 400 && err.message === 'Không thể tự khoá tài khoản của chính mình.'
        );

        const account = await pool.query('SELECT is_active FROM accounts WHERE id = 1');
        assert.strictEqual(account.rows[0].is_active, true);
    });
});
