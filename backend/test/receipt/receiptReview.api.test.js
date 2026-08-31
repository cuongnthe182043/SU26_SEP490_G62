/**
 * API duyệt hóa đơn — qua HTTP thật.
 *
 * Hai tầng dưới (luật và SQL) đã có test riêng. Tầng này kiểm đúng thứ chúng không
 * chạm tới và cũng là thứ hỏng âm thầm nhất: đường dẫn route có gõ đúng không, và ai
 * được phép làm gì. Một ký tự sai trong path hay một middleware đặt nhầm chỗ sẽ lọt
 * qua toàn bộ test service mà vẫn 404/403 trên thực tế.
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
let extractionId;

const RAW = {
    is_document: true,
    doc_type: 'invoice',
    vendor: { name: 'Garage Thành Công', tax_code: '0101234567' },
    invoice_no: 'HD-00123',
    issued_date: '2026-08-20',
    vehicle_plate: '51C-12345',
    line_items: [
        { raw_name: 'Nhớt Castrol GTX 4L', quantity: 1, unit_price: 450_000, line_total: 450_000, category: 'engine_oil' },
        { raw_name: 'Bộ ZX-9981 chuyên dụng', quantity: 1, unit_price: 300_000, line_total: 300_000, category: null },
    ],
    subtotal: 750_000, discount: 0, vat_rate: null, vat_amount: null, total: 750_000,
    unreadable_fields: [],
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());

    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/', require('../../routes'));

    await pool.query(`
        TRUNCATE receipt_extractions, maintenance_item_keywords, maintenance_records,
                 drivers, profiles, roles, accounts RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com',$1,1),(3,'acc@test.com',$1,3),(4,'driver@test.com',$1,4)
    `, [TEST_PASSWORD_HASH]);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Manager',1),(3,'Ke toan',3),(4,'Driver A',4)
    `);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, license_number, hire_date) VALUES (4, NULL, 'DL-A', CURRENT_DATE)`);

    const inserted = await pool.query(
        `INSERT INTO receipt_extractions
            (entity_type, entity_id, image_url, image_sha256, provider, model, prompt_version,
             raw_extraction, checks, verdict, claimed_amount, receipt_total, latency_ms,
             vendor_key, invoice_no_key)
         VALUES ('maintenance_record', 21, 'https://x/bill.jpg', 'hash-1', 'google', 'gemini-flash-latest', 'v1',
                 $1::jsonb, $2::jsonb, 'needs_review', 750000, 750000, 900, 'tax:0101234567', 'HD00123')
         RETURNING id`,
        [
            JSON.stringify(RAW),
            JSON.stringify([{ code: 'UNCLASSIFIED_ITEMS', severity: 'warning', message: 'Chưa phân loại được 1 dòng' }]),
        ],
    );
    extractionId = inserted.rows[0].id;
});

afterAll(async () => {
    if (teardown) await teardown();
});

describe('API duyệt hóa đơn — đăng nhập', () => {
    it('mỗi vai trò lấy token thật qua POST /auth/login', async () => {
        mgrToken = await loginAs(app, 'manager@test.com');
        accToken = await loginAs(app, 'acc@test.com');
        driverToken = await loginAs(app, 'driver@test.com');

        assert.ok(mgrToken && accToken && driverToken);
    });
});

describe('GET /api/admin/maintenance/:recordId/receipts', () => {
    it('manager đọc được kết quả máy đã đọc, kèm dòng hàng đã phân loại', async () => {
        const res = await request(app)
            .get('/api/admin/maintenance/21/receipts')
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.strictEqual(res.body.receipts.length, 1);
        assert.strictEqual(res.body.receipts[0].items.length, 2);
        assert.strictEqual(res.body.receipts[0].items[0].category, 'engine_oil');
        assert.strictEqual(res.body.summary.needs_review, 1);
    });

    it('kế toán cũng ĐỌC được để đối chiếu khi ghi sổ chi phí bảo dưỡng', async () => {
        await request(app)
            .get('/api/admin/maintenance/21/receipts')
            .set('Authorization', `Bearer ${accToken}`)
            .expect(200);
    });

    it('tài xế KHÔNG được xem', async () => {
        await request(app)
            .get('/api/admin/maintenance/21/receipts')
            .set('Authorization', `Bearer ${driverToken}`)
            .expect(403);
    });

    it('không có token thì bị chặn kèm mã để client biết cần refresh', async () => {
        // Codebase cố ý trả 403 + code NO_TOKEN (không phải 401) để apiClient phân biệt
        // "cookie hết hạn, thử refresh" với "tài khoản bị khoá" — xem authMiddleware.
        const res = await request(app).get('/api/admin/maintenance/21/receipts').expect(403);
        assert.strictEqual(res.body.code, 'NO_TOKEN');
    });

    it('mã đợt bảo dưỡng không hợp lệ thì báo 400', async () => {
        await request(app)
            .get('/api/admin/maintenance/abc/receipts')
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(400);
    });
});

describe('POST /api/admin/receipt-extractions/:id/review', () => {
    it('kế toán KHÔNG được chốt phán quyết dù đọc được', async () => {
        await request(app)
            .post(`/api/admin/receipt-extractions/${extractionId}/review`)
            .set('Authorization', `Bearer ${accToken}`)
            .send({ action: 'agree' })
            .expect(403);
    });

    it('manager ghi được phán quyết và nó hiện ra ở lần đọc sau', async () => {
        await request(app)
            .post(`/api/admin/receipt-extractions/${extractionId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ action: 'override_accept', note: 'Đã gọi garage xác nhận' })
            .expect(200);

        const res = await request(app)
            .get('/api/admin/maintenance/21/receipts')
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.strictEqual(res.body.receipts[0].review.action, 'override_accept');
        assert.match(res.body.receipts[0].review.note, /gọi garage/);
        assert.strictEqual(res.body.receipts[0].review.by, 'Manager');
    });

    it('dạy từ điển qua HTTP làm đổi phân loại của chính bản ghi đã lưu', async () => {
        await request(app)
            .post(`/api/admin/receipt-extractions/${extractionId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ learn_keywords: [{ keyword: 'ZX-9981', category: 'filter', item_group: 'maintenance' }] })
            .expect(200);

        const res = await request(app)
            .get('/api/admin/maintenance/21/receipts')
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.strictEqual(res.body.receipts[0].items[1].category, 'filter');
        assert.strictEqual(res.body.receipts[0].items[1].matched_by, 'dictionary');
    });

    it('hành động không hợp lệ bị chặn 400', async () => {
        await request(app)
            .post(`/api/admin/receipt-extractions/${extractionId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ action: 'xoa_het' })
            .expect(400);
    });

    it('bản ghi không tồn tại thì 404', async () => {
        await request(app)
            .post('/api/admin/receipt-extractions/999999/review')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ action: 'agree' })
            .expect(404);
    });
});

describe('Cảnh báo chi phí bất thường ở mức cả đợt', () => {
    const seedHistory = async (vehicleId, costs, type = 'scheduled') => {
        for (const [i, cost] of costs.entries()) {
            await pool.query(
                `INSERT INTO maintenance_records
                    (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
                 VALUES ($1, $2, $3, CURRENT_DATE - $4::int, 4, 'completed')`,
                [vehicleId, type, cost, i + 10],
            );
        }
    };

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO vehicle_groups (id, name, max_load_weight_kg, price_per_km)
            VALUES (900, 'Nhóm test', 5000, 10000) ON CONFLICT DO NOTHING
        `);
        await pool.query(`
            INSERT INTO vehicles (id, plate_number, vehicle_group_id, status)
            VALUES (900, '51C-90000', 900, 'maintenance') ON CONFLICT DO NOTHING
        `);
    });

    it('không cảnh báo khi chi phí nằm trong khoảng quen thuộc của xe', async () => {
        await pool.query('DELETE FROM maintenance_records WHERE vehicle_id = 900');
        await seedHistory(900, [1_200_000, 1_350_000, 1_500_000, 1_250_000, 1_400_000]);
        const cur = await pool.query(
            `INSERT INTO maintenance_records
                (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
             VALUES (900, 'scheduled', 1400000, CURRENT_DATE, 4, 'pending_verification') RETURNING id`,
        );

        const res = await request(app)
            .get(`/api/admin/maintenance/${cur.rows[0].id}/receipts`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.deepStrictEqual(res.body.record_checks, []);
        assert.strictEqual(res.body.record.plate_number, '51C-90000');
    });

    it('cảnh báo khi chi phí cao gấp nhiều lần lịch sử của chính xe đó', async () => {
        // Hóa đơn có thể hoàn toàn thật, số học đúng, hạng mục đúng — mọi lớp trên đều
        // cho qua. Chỉ lớp đối chiếu bối cảnh này mới thấy bất thường.
        await pool.query('DELETE FROM maintenance_records WHERE vehicle_id = 900');
        await seedHistory(900, [1_200_000, 1_350_000, 1_500_000, 1_250_000, 1_400_000]);
        const cur = await pool.query(
            `INSERT INTO maintenance_records
                (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
             VALUES (900, 'scheduled', 4800000, CURRENT_DATE, 4, 'pending_verification') RETURNING id`,
        );

        const res = await request(app)
            .get(`/api/admin/maintenance/${cur.rows[0].id}/receipts`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.strictEqual(res.body.record_checks.length, 1);
        assert.strictEqual(res.body.record_checks[0].code, 'COST_OUTLIER');
        assert.match(res.body.record_checks[0].message, /4\.800\.000đ/);
        assert.match(res.body.record_checks[0].message, /định kỳ/);
    });

    it('đợt CHƯA xác minh không được tính vào lịch sử làm chuẩn', async () => {
        // Nếu tính cả đợt chưa duyệt thì một khoản khai khống chưa ai xác nhận sẽ tự
        // nâng mức "bình thường" lên và che cho khoản khống tiếp theo.
        await pool.query('DELETE FROM maintenance_records WHERE vehicle_id = 900');
        await seedHistory(900, [1_200_000, 1_350_000, 1_500_000, 1_250_000, 1_400_000]);
        await pool.query(
            `INSERT INTO maintenance_records
                (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
             VALUES (900, 'scheduled', 9000000, CURRENT_DATE - 1, 4, 'pending_verification')`,
        );
        const cur = await pool.query(
            `INSERT INTO maintenance_records
                (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
             VALUES (900, 'scheduled', 4800000, CURRENT_DATE, 4, 'pending_verification') RETURNING id`,
        );

        const res = await request(app)
            .get(`/api/admin/maintenance/${cur.rows[0].id}/receipts`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.strictEqual(res.body.record_checks.length, 1);
    });

    it('xe chưa có lịch sử thì im lặng thay vì đoán bừa', async () => {
        await pool.query('DELETE FROM maintenance_records WHERE vehicle_id = 900');
        const cur = await pool.query(
            `INSERT INTO maintenance_records
                (vehicle_id, maintenance_type, cost, maintenance_date, performed_by, status)
             VALUES (900, 'scheduled', 9000000, CURRENT_DATE, 4, 'pending_verification') RETURNING id`,
        );

        const res = await request(app)
            .get(`/api/admin/maintenance/${cur.rows[0].id}/receipts`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .expect(200);

        assert.deepStrictEqual(res.body.record_checks, []);
    });
});
