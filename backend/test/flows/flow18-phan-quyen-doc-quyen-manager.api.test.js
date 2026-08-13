/**
 * L3-FLOW-18 — Ma trận phân quyền: các việc độc quyền Manager & thu nợ đối tác của Kế toán
 *
 * Chốt lại ranh giới vai trò sau khi siết quyền:
 *   [manager only]  ghi vào /api/admin/vehicles|vehicle-groups|holidays|maintenance-requests
 *   [manager only]  ghi vào /api/bonus-rules
 *   [manager only]  PATCH /api/kpi/driver/:id/vehicle-group
 *   [accountant]    vẫn ĐỌC được các tài nguyên trên (đối chiếu khi tính lương)
 *   [accountant]    POST /accountant/debts/payment/allocate với personType='partner'
 *   [manager]       KHÔNG còn route ghi nhận đối tác thanh toán
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
let coordToken;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());

    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/', require('../../routes'));

    await pool.query(`
        TRUNCATE debt_payments, debts, partners, vehicle_status_history, vehicle_driver_assignments,
                 maintenance_records, incidents, order_shipments, orders, customers, vehicles,
                 vehicle_groups, bonus_rules, company_holidays, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com',$1,1),(2,'coord@test.com',$1,2),(3,'acc@test.com',$1,3),(4,'driverA@test.com',$1,4)
    `, [TEST_PASSWORD_HASH]);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Manager',1),(2,'Coordinator',2),(3,'Accountant',3),(4,'Driver A',4)
    `);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, license_number, hire_date) VALUES (4, NULL, 'DL-A', CURRENT_DATE)`);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);

    mgrToken   = await loginAs(app, 'manager@test.com');
    accToken   = await loginAs(app, 'acc@test.com');
    coordToken = await loginAs(app, 'coord@test.com');
});

afterAll(async () => {
    await teardown();
});

describe('L3-FLOW-18 — Quản lý xe / nhóm xe / bảo trì là độc quyền Manager', () => {
    it('B1 [accountant] — vẫn ĐỌC được xe, nhóm xe, ngày lễ, yêu cầu bảo dưỡng', async () => {
        for (const path of ['/api/admin/vehicles', '/api/admin/vehicle-groups', '/api/admin/holidays', '/api/admin/maintenance-requests']) {
            const res = await request(app).get(path).set(auth(accToken));
            assert.strictEqual(res.status, 200, `accountant phải đọc được ${path} (nhận ${res.status})`);
        }
    });

    it('B2 [accountant] — mọi thao tác GHI vào xe / nhóm xe đều bị chặn 403', async () => {
        const writes = [
            ['post',   '/api/admin/vehicle-groups',            { name: 'Nhóm lậu', price_per_km: 1000 }],
            ['put',    '/api/admin/vehicle-groups/1',          { name: 'Đổi tên', price_per_km: 1000 }],
            ['delete', '/api/admin/vehicle-groups/1',          null],
            ['post',   '/api/admin/vehicles',                  { plate_number: '51A-99999', vehicle_group_id: 1 }],
            ['post',   '/api/admin/vehicles/1/mark-broken',    { reason: 'x' }],
            ['post',   '/api/admin/vehicles/1/retire',         {}],
            ['patch',  '/api/admin/vehicles/1/driver-assignment', { assigned_driver_id: null }],
            ['post',   '/api/admin/maintenance-requests/1/approve', {}],
        ];
        for (const [method, path, body] of writes) {
            const req = request(app)[method](path).set(auth(accToken));
            const res = await (body ? req.send(body) : req);
            assert.strictEqual(res.status, 403, `accountant KHÔNG được ${method.toUpperCase()} ${path} (nhận ${res.status})`);
        }
    });

    it('B3 [manager] — vẫn tạo được nhóm xe (quyền không bị siết nhầm)', async () => {
        const res = await request(app).post('/api/admin/vehicle-groups')
            .set(auth(mgrToken)).send({ name: 'Xe 9m6', price_per_km: 22000 });
        assert.ok([200, 201].includes(res.status), `manager phải tạo được nhóm xe (nhận ${res.status})`);
    });
});

describe('L3-FLOW-18 — Ngày lễ & quy tắc thưởng là độc quyền Manager', () => {
    it('B4 [accountant] — đọc được quy tắc thưởng nhưng không thêm/sửa/xoá', async () => {
        const read = await request(app).get('/api/bonus-rules').set(auth(accToken));
        assert.strictEqual(read.status, 200, 'accountant phải đọc được quy tắc thưởng');

        const create = await request(app).post('/api/bonus-rules')
            .set(auth(accToken)).send({ title: 'Thưởng lậu', bonus_type: 'custom', reward_amount: 1000 });
        assert.strictEqual(create.status, 403, 'accountant KHÔNG được tạo quy tắc thưởng');

        const del = await request(app).delete('/api/bonus-rules/1').set(auth(accToken));
        assert.strictEqual(del.status, 403, 'accountant KHÔNG được xoá quy tắc thưởng');
    });

    it('B5 [accountant] — không thêm/xoá được ngày lễ', async () => {
        const create = await request(app).post('/api/admin/holidays')
            .set(auth(accToken)).send({ holiday_date: '2026-01-01', name: 'Tết dương' });
        assert.strictEqual(create.status, 403, 'accountant KHÔNG được thêm ngày lễ');

        const del = await request(app).delete('/api/admin/holidays/2026-01-01').set(auth(accToken));
        assert.strictEqual(del.status, 403, 'accountant KHÔNG được xoá ngày lễ');
    });

    it('B6 [manager] — vẫn thêm được ngày lễ và quy tắc thưởng', async () => {
        const holiday = await request(app).post('/api/admin/holidays')
            .set(auth(mgrToken)).send({ holiday_date: '2026-01-01', name: 'Tết dương lịch' });
        assert.ok([200, 201].includes(holiday.status), `manager phải thêm được ngày lễ (nhận ${holiday.status})`);

        const rule = await request(app).post('/api/bonus-rules')
            .set(auth(mgrToken)).send({
                title: 'Thưởng vượt KPI', bonus_type: 'kpi', reward_amount: 500000,
                conditions_json: { min_revenue: 100_000_000 },
            });
        assert.ok([200, 201].includes(rule.status), `manager phải tạo được quy tắc thưởng (nhận ${rule.status})`);
    });

    // Lỗi nhập liệu phải là 4xx. Trước đây controller đoán mã lỗi bằng cách dò chuỗi nên
    // các thông điệp này rơi hết xuống 500 — người dùng thấy "lỗi máy chủ" cho lỗi của mình.
    it('B6b [manager] — cấu hình quy tắc thưởng sai trả 400 kèm thông điệp, không phải 500', async () => {
        const cases = [
            [{ title: 'R', bonus_type: 'zero_incident', reward_amount: 1000 }, /chưa được bộ tính lương hỗ trợ/],
            [{ title: 'R', bonus_type: 'kpi', reward_amount: 1000 }, /ngưỡng doanh thu tối thiểu/],
            [{ title: 'R', bonus_type: 'holiday', reward_amount: 1000 }, /Hệ số thưởng/],
            [{ title: 'R', bonus_type: 'holiday', reward_multiplier: 0.5 }, /từ 1 trở lên/],
            [{ bonus_type: 'kpi', reward_amount: 1000 }, /bắt buộc/],
        ];
        for (const [body, pattern] of cases) {
            const res = await request(app).post('/api/bonus-rules').set(auth(mgrToken)).send(body);
            assert.strictEqual(res.status, 400, `${JSON.stringify(body)} phải trả 400 (nhận ${res.status})`);
            assert.match(res.body.error, pattern, 'thông điệp lỗi phải nói rõ sai ở đâu');
        }

        const missing = await request(app).put('/api/bonus-rules/99999').set(auth(mgrToken)).send({ title: 'X' });
        assert.strictEqual(missing.status, 404, `sửa rule không tồn tại phải trả 404 (nhận ${missing.status})`);
    });

    it('B6c — danh sách quy tắc trả kèm loại thưởng được hỗ trợ để UI khỏi hardcode lệch', async () => {
        const res = await request(app).get('/api/bonus-rules').set(auth(mgrToken));
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body.bonusTypes.implemented, ['kpi', 'top_revenue', 'holiday']);
        assert.ok(res.body.bonusTypes.all.length > res.body.bonusTypes.implemented.length,
            'danh sách đầy đủ vẫn phải có để hiển thị tên loại thưởng của rule cũ');
    });
});

describe('L3-FLOW-18 — Đổi nhóm xe cố định của tài xế là độc quyền Manager', () => {
    it('B7 — coordinator và accountant bị chặn PATCH, nhưng vẫn xem được lịch sử', async () => {
        for (const [role, token] of [['coordinator', coordToken], ['accountant', accToken]]) {
            const patch = await request(app).patch('/api/kpi/driver/4/vehicle-group')
                .set(auth(token)).send({ vehicleGroupId: 1 });
            assert.strictEqual(patch.status, 403, `${role} KHÔNG được đổi nhóm xe cố định (nhận ${patch.status})`);

            const history = await request(app).get('/api/kpi/driver/4/vehicle-group/history').set(auth(token));
            assert.strictEqual(history.status, 200, `${role} vẫn phải xem được lịch sử đổi nhóm (nhận ${history.status})`);
        }
    });

    it('B8 [manager] — đổi được nhóm xe cố định', async () => {
        const res = await request(app).patch('/api/kpi/driver/4/vehicle-group')
            .set(auth(mgrToken)).send({ vehicleGroupId: 1, reason: 'gán lại nhóm' });
        assert.notStrictEqual(res.status, 403, 'manager không được bị chặn khi đổi nhóm xe');
    });
});

describe('L3-FLOW-18 — Ghi nhận đối tác thanh toán đã chuyển sang Kế toán', () => {
    const PARTNER_DEBT = 5_000_000;

    beforeAll(async () => {
        await pool.query(`INSERT INTO partners (id, company_name) VALUES (1, 'Đối tác Vận tải ABC')`);
        await pool.query(
            `INSERT INTO debts (debt_type, partner_id, total_amount, created_at, updated_at)
             VALUES ('partner', 1, $1, NOW(), NOW())`,
            [PARTNER_DEBT],
        );
    });

    it('B9 [manager] — route ghi nhận thanh toán đối tác không còn tồn tại', async () => {
        const res = await request(app).post('/api/manager/partners/1/payments')
            .set(auth(mgrToken)).send({ amount: 1_000_000, payment_method: 'cash' });
        assert.strictEqual(res.status, 404, `route cũ phải biến mất (nhận ${res.status})`);
    });

    it('B10 [manager] — vẫn xem được công nợ đối tác', async () => {
        const res = await request(app).get('/api/manager/partners/1/debts').set(auth(mgrToken));
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.debts.length, 1, 'manager phải thấy khoản nợ của đối tác');
    });

    it('B11 [accountant] — ghi nhận đối tác thanh toán qua allocate (trước đây bị 400)', async () => {
        const res = await request(app).post('/accountant/debts/payment/allocate')
            .set(auth(accToken))
            .send({ personType: 'partner', personId: 1, amount: 2_000_000, paymentMethod: 'bank_transfer', notes: 'tra dot 1' });

        assert.strictEqual(res.status, 200, `accountant phải thu được nợ đối tác (nhận ${res.status}: ${res.body?.error})`);
        assert.strictEqual(Number(res.body.totalAllocated), 2_000_000);
    });

    it('B12 — công nợ đối tác giảm đúng sau khi kế toán thu', async () => {
        const res = await request(app).get('/api/manager/partners/1/debts').set(auth(mgrToken));
        const debt = res.body.debts[0];
        assert.strictEqual(Number(debt.paid_amount), 2_000_000, 'đã thu phải là 2tr');
        assert.strictEqual(Number(debt.remaining), PARTNER_DEBT - 2_000_000, 'còn lại phải là 3tr');
    });

    it('B13 [accountant] — lịch sử thanh toán theo đối tác trả đúng đối tượng (không lẫn sang khách hàng)', async () => {
        const res = await request(app).get('/accountant/debts/payment/history/partner/1').set(auth(accToken));
        assert.strictEqual(res.status, 200, `history partner phải mở được (nhận ${res.status})`);
        assert.strictEqual(res.body.payments.length, 1, 'phải thấy đúng 1 lần thanh toán của đối tác');
        assert.strictEqual(Number(res.body.payments[0].totalAmount), 2_000_000);
    });

    it('B14 [accountant] — lịch sử toàn cục lọc theo partner hiện đúng tên đối tác', async () => {
        const res = await request(app).get('/accountant/debts/payment/history?person_type=partner').set(auth(accToken));
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.rows.length, 1);
        assert.strictEqual(res.body.rows[0].person_name, 'Đối tác Vận tải ABC', 'tên đối tác phải resolve được (trước đây null vì thiếu JOIN partners)');
        assert.strictEqual(Number(res.body.stats.partner_confirmed_total), 2_000_000);
    });

    it('B15 — personType rác vẫn bị từ chối (không nới lỏng quá tay)', async () => {
        const res = await request(app).post('/accountant/debts/payment/allocate')
            .set(auth(accToken)).send({ personType: 'khong_ton_tai', personId: 1, amount: 1000, paymentMethod: 'cash' });
        assert.strictEqual(res.status, 400);
    });
});
