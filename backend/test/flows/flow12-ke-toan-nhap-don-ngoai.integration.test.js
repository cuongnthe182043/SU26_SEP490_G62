/**
 * L2-FLOW-08 — Luồng: Kế toán nhập đơn ngoài (nhập tay + import Excel)
 *
 * Test THEO LUỒNG: kế toán nhập đơn đã chạy xong → hệ thống tìm xe theo biển số và
 * tài xế theo tên → ghi chuyến, công nợ, sổ tài chính.
 *
 * Vì sao có file này: toàn bộ đường đi createOrderWithShipments trước đây KHÔNG có
 * test nào. Một lỗi suy kiểu SQL (CASE ... THEN $2 ELSE NULL khiến $2 bị suy ra text
 * trong khi created_by là integer) làm HỎNG HOÀN TOÀN cả nhập tay lẫn import Excel
 * mà không bộ test nào phát hiện. B1 dưới đây là chốt chặn cho đúng lỗi đó.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let repo;

const KE_TOAN = 3;
const TAI_A = 4;

const donCoBan = (overrides = {}) => ({
    customer_name: 'Khach Le',
    customer_phone: '0909000111',
    created_by: KE_TOAN,
    prepaid_amount: 0,
    completed_at: '2026-08-10',
    shipments: [{
        vehicle_plate: '51E-100.01',
        driver_name: 'Pham Van Tien',
        pickup_addresses: ['Kho A'],
        delivery_addresses: ['Kho B'],
        cargo_fee: 1000000,
        expenses: [],
        payment_type: 'bank_transfer',
        driver_payment_state: 'company_received',
    }],
    ...overrides,
});

const donVoi = (shipmentOverrides) => donCoBan({
    shipments: [{ ...donCoBan().shipments[0], ...shipmentOverrides }],
});

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    repo = require('../../repositories/accountantOrderRepository');

    await pool.query(`
        TRUNCATE financial_transactions, debts, trip_stops, shipment_assignment_history,
                 order_shipments, orders, customers, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (3,'ketoan@test.com','hash',3),(4,'taiA@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES (3,'Ke Toan',3),(4,'Pham Van Tien',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`
        INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status)
        VALUES (1, '51E-100.01', 1, 4, 'active')
    `);
    await pool.query(`
        INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date)
        VALUES (4, 1, 1, 'DL-A', CURRENT_DATE)
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-08 — Kế toán nhập đơn ngoài: khớp xe/tài xế và ghi sổ', () => {
    it('B1 — tạo được đơn ngoài (chốt chặn lỗi suy kiểu tham số $2 làm hỏng toàn bộ luồng)', async () => {
        const order = await repo.createOrderWithShipments(donCoBan());

        assert.ok(order?.id, 'phải tạo được đơn');
        const { rows: chuyen } = await pool.query(
            'SELECT id, status, estimated_price FROM order_shipments WHERE order_id = $1',
            [order.id],
        );
        assert.strictEqual(chuyen.length, 1);
        assert.strictEqual(chuyen[0].status, 'completed', 'đơn ngoài là đơn đã chạy xong');
        assert.strictEqual(Number(chuyen[0].estimated_price), 1000000);
    });

    it('B1b — nhánh có tiền ứng trước cũng chạy (CASE WHEN prepaid > 0 gán người xác nhận)', async () => {
        const order = await repo.createOrderWithShipments(donCoBan({ prepaid_amount: 400000 }));

        const { rows: [don] } = await pool.query(
            'SELECT prepaid_amount, prepaid_status, prepaid_confirmed_by FROM orders WHERE id = $1',
            [order.id],
        );
        assert.strictEqual(Number(don.prepaid_amount), 400000);
        assert.strictEqual(don.prepaid_status, 'confirmed', 'kế toán tự thu nên xác nhận ngay');
        assert.strictEqual(don.prepaid_confirmed_by, KE_TOAN);
    });

    it('B2 — biển số viết khác hoa/thường và khác dấu phân cách vẫn khớp đúng xe', async () => {
        for (const bienSo of ['51e-100.01', '51E 100 01', '51E10001', '  51E-100.01  ']) {
            const order = await repo.createOrderWithShipments(donVoi({ vehicle_plate: bienSo }));
            const { rows: [ch] } = await pool.query(
                `SELECT sc.vehicle_id FROM order_shipments os
                 JOIN v_shipment_current sc ON sc.shipment_id = os.id
                 WHERE os.order_id = $1`,
                [order.id],
            );
            assert.strictEqual(ch.vehicle_id, 1, `biển số "${bienSo}" phải khớp xe id=1`);
        }
    });

    it('B3 — tên tài xế thừa khoảng trắng / khác hoa thường vẫn khớp đúng người', async () => {
        for (const ten of ['pham van tien', 'PHAM VAN TIEN', 'Pham  Van   Tien', ' Pham Van Tien ']) {
            const order = await repo.createOrderWithShipments(donVoi({ driver_name: ten }));
            const { rows: [ch] } = await pool.query(
                `SELECT sc.owner_driver_id FROM order_shipments os
                 JOIN v_shipment_current sc ON sc.shipment_id = os.id
                 WHERE os.order_id = $1`,
                [order.id],
            );
            assert.strictEqual(ch.owner_driver_id, TAI_A, `tên "${ten}" phải khớp tài xế id=${TAI_A}`);
        }
    });

    it('B4 — xe chưa có trong hệ thống thì từ chối kèm biển số, không âm thầm tạo xe mới', async () => {
        await assert.rejects(
            () => repo.createOrderWithShipments(donVoi({ vehicle_plate: '99Z-999.99' })),
            /99Z-999\.99.*chưa có trong hệ thống/s,
        );
        const { rows } = await pool.query(`SELECT id FROM vehicles WHERE plate_number ILIKE '%99Z%'`);
        assert.strictEqual(rows.length, 0, 'không được tự tạo xe mới');
    });

    it('B5 — tài xế chưa có tài khoản thì từ chối kèm tên, không âm thầm tạo hồ sơ', async () => {
        await assert.rejects(
            () => repo.createOrderWithShipments(donVoi({ driver_name: 'Nguyen Van Khong Co' })),
            /Nguyen Van Khong Co.*chưa có tài khoản/s,
        );
        const { rows } = await pool.query(`SELECT id FROM profiles WHERE full_name = 'Nguyen Van Khong Co'`);
        assert.strictEqual(rows.length, 0, 'không được tự tạo hồ sơ tài xế mới');
    });

    it('B6 — hai tài xế trùng tên thì báo lỗi thay vì gán bừa cho người đầu tiên', async () => {
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES (6,'taiTrung@test.com','hash',4)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (6,'Pham Van Tien',4)`);
        await pool.query(`
            INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date)
            VALUES (6, NULL, 1, 'DL-TRUNG', CURRENT_DATE)
        `);

        await assert.rejects(
            () => repo.createOrderWithShipments(donVoi({ driver_name: 'Pham Van Tien' })),
            /nhiều tài xế cùng tên/,
        );

        await pool.query('DELETE FROM drivers WHERE profile_id = 6');
        await pool.query('DELETE FROM profiles WHERE id = 6');
        await pool.query('DELETE FROM accounts WHERE id = 6');
    });
});
