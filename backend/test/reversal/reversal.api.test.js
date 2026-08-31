/**
 * Hoàn tác — kiểm qua HTTP thật, đúng như app và trình duyệt gọi.
 *
 * Tầng service đã được phủ ở hai file cạnh đây. File này chỉ lo phần mà service không
 * thấy: định tuyến, phân quyền, và MÃ TRẠNG THÁI trả về — vì client xử lý khác nhau
 * theo từng mã (409 thì tải lại rồi thử lại, 403 thì ẩn nút hẳn).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'TEST_SECRET';

const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const { setupTestDb } = require('../helpers/testDb');
const { TEST_PASSWORD_HASH, loginAs } = require('../helpers/httpAuth');

let pool;
let teardown;
let app;
let mgrToken;
let accToken;
let driverToken;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());

    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/', require('../../routes'));

    await pool.query(`
        TRUNCATE reversal_requests, activity_logs, expenses, trip_stops,
                 shipment_assignment_history, order_shipments, orders, customers,
                 vehicles, vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com',$1,1),(3,'acc@test.com',$1,3),(4,'driver@test.com',$1,4)
    `, [TEST_PASSWORD_HASH]);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Quản lý Bình',1),(3,'Kế toán Mai',3),(4,'Tài xế Hùng',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1,'Xe 5m2',15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1,'51E-246.80',1,4,'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4,1,1,'DL-1',CURRENT_DATE)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1,'individual','Chị Lan','0912345678')`);

    mgrToken    = await loginAs(app, 'manager@test.com');
    accToken    = await loginAs(app, 'acc@test.com');
    driverToken = await loginAs(app, 'driver@test.com');
});

afterAll(async () => { await teardown(); });

let n = 0;
const approvedExpense = async () => {
    n += 1;
    const id = 7000 + n;
    await pool.query(
        `INSERT INTO expenses (id, vehicle_id, created_by, expense_type, amount,
                               status, reviewed_by, reviewed_at, reimbursement_status)
         VALUES ($1, 1, 4, 'fuel', 500000, 'approved', 3, NOW(), 'pending')`,
        [id],
    );
    return id;
};

describe('API hoàn tác', () => {

    it('kế toán không có route gỡ duyệt chi phí — đó là lý do tầng 2 tồn tại', async () => {
        const expenseId = await approvedExpense();
        const res = await request(app)
            .patch(`/api/coordinator/expenses/${expenseId}/unapprove`)
            .set(auth(accToken))
            .send({ reason: 'Sai số tiền' });

        assert.strictEqual(res.status, 403, 'route này chỉ mở cho điều phối');
    });

    it('kế toán gửi được yêu cầu hoàn tác, quản lý duyệt thì khoản chi quay về chờ', async () => {
        const expenseId = await approvedExpense();

        const gui = await request(app)
            .post('/api/reversal-requests')
            .set(auth(accToken))
            .send({ kind: 'expense.approve', entity_id: expenseId, reason: 'Hoá đơn ghi 50.000, khoản khai 500.000' });
        assert.strictEqual(gui.status, 201);
        assert.strictEqual(gui.body.request.status, 'pending');

        const duyet = await request(app)
            .patch(`/api/reversal-requests/${gui.body.request.id}/approve`)
            .set(auth(mgrToken))
            .send({ note: 'Đã đối chiếu ảnh' });
        assert.strictEqual(duyet.status, 200);
        assert.strictEqual(duyet.body.request.execution_error, null);

        const { rows: [e] } = await pool.query(`SELECT status FROM expenses WHERE id = $1`, [expenseId]);
        assert.strictEqual(e.status, 'pending');
    });

    it('tài xế gửi được yêu cầu nhưng không duyệt được yêu cầu của chính mình', async () => {
        const expenseId = await approvedExpense();

        const gui = await request(app)
            .post('/api/reversal-requests')
            .set(auth(driverToken))
            .send({ kind: 'expense.approve', entity_id: expenseId, reason: 'Tôi khai nhầm' });
        assert.strictEqual(gui.status, 201, 'ai cũng được BÁO — đó là điểm mấu chốt của tầng này');

        const tuDuyet = await request(app)
            .patch(`/api/reversal-requests/${gui.body.request.id}/approve`)
            .set(auth(driverToken))
            .send({});
        assert.strictEqual(tuDuyet.status, 403);

        const xemHangCho = await request(app)
            .get('/api/reversal-requests/pending')
            .set(auth(driverToken));
        assert.strictEqual(xemHangCho.status, 403, 'tài xế không được nhìn hàng chờ của cả công ty');
    });

    it('gửi yêu cầu thiếu lý do trả 422, gửi trùng trả 409', async () => {
        const expenseId = await approvedExpense();

        const thieuLyDo = await request(app)
            .post('/api/reversal-requests')
            .set(auth(accToken))
            .send({ kind: 'expense.approve', entity_id: expenseId, reason: '   ' });
        assert.strictEqual(thieuLyDo.status, 422);
        assert.strictEqual(thieuLyDo.body.code, 'REASON_REQUIRED');

        await request(app).post('/api/reversal-requests').set(auth(accToken))
            .send({ kind: 'expense.approve', entity_id: expenseId, reason: 'Sai tiền' }).expect(201);

        const trung = await request(app)
            .post('/api/reversal-requests')
            .set(auth(accToken))
            .send({ kind: 'expense.approve', entity_id: expenseId, reason: 'Sai tiền' });
        assert.strictEqual(trung.status, 409);
        assert.strictEqual(trung.body.code, 'DUPLICATE');
    });

    it('danh sách loại hoàn tác được lấy từ server, không để giao diện tự bịa', async () => {
        const res = await request(app).get('/api/reversal-requests/kinds').set(auth(accToken));
        assert.strictEqual(res.status, 200);

        const kinds = res.body.kinds.map((k) => k.kind);
        assert.ok(kinds.includes('expense.approve'));
        assert.ok(!kinds.includes('trip.transition'), 'tầng 1 không đi qua đường xin duyệt');
        // Chỉ hiện loại hệ thống LÙI ĐƯỢC THẬT — không mời người dùng gửi vào chỗ trống
        assert.ok(!kinds.includes('vehicle.retire'));
        assert.ok(res.body.kinds.every((k) => k.tier === 2));
    });

    it('hoàn tác chuyến mà thiếu số phiên bản thì trả 400, không đoán bừa', async () => {
        await pool.query(
            `INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
             VALUES (9001, 1, 1, 'Hàng', 'bank_transfer', 100000)`);
        await pool.query(
            `INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id,
                                          estimated_price, estimated_distance_km, status)
             VALUES (9001, 9001, 1, 1, 100000, 10, 'available')`);
        await pool.query(
            `INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address)
             VALUES (9001,1,'pickup','Kho A'), (9001,2,'delivery','Nhà khách')`);

        await request(app).post('/api/trips/9001/claim').set(auth(driverToken)).expect(200);
        await request(app).patch('/api/trips/9001/status').set(auth(driverToken))
            .send({ status: 'picking' }).expect(200);

        const thieu = await request(app).post('/api/trips/9001/undo').set(auth(driverToken)).send({});
        assert.strictEqual(thieu.status, 400);
        assert.strictEqual(thieu.body.code, 'VERSION_REQUIRED');

        const { rows: [s] } = await pool.query(`SELECT version, status FROM order_shipments WHERE id = 9001`);
        assert.strictEqual(s.status, 'picking', 'không được đổi gì khi yêu cầu thiếu tham số');

        // Gửi version sai → 409 để app biết là phải tải lại, không phải "yêu cầu sai"
        const lech = await request(app).post('/api/trips/9001/undo').set(auth(driverToken))
            .send({ version: Number(s.version) + 5 });
        assert.strictEqual(lech.status, 409);
        assert.strictEqual(lech.body.code, 'STALE_VERSION');

        // Đúng version → lùi được
        const dung = await request(app).post('/api/trips/9001/undo').set(auth(driverToken))
            .send({ version: Number(s.version) });
        assert.strictEqual(dung.status, 200);
        assert.strictEqual(dung.body.trip.status, 'claimed');
    });

    it('trạng thái chuyến trả về cho app đã kèm hạn hoàn tác', async () => {
        const res = await request(app).get('/api/trips/active').set(auth(driverToken));
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.trip, 'tài xế đang giữ chuyến 9001');
        assert.strictEqual(typeof res.body.trip.can_undo, 'boolean');
        assert.strictEqual(typeof res.body.trip.version, 'number');
    });
});
