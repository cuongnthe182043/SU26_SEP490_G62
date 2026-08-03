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
const { buildImportFingerprint } = require('../../utils/importFingerprint');

let pool;
let teardown;
let repo;

const ACCOUNTANT_ID = 3;
const DRIVER_A = 4;

const baseOrder = (overrides = {}) => ({
    customer_name: 'Khach Le',
    customer_phone: '0909000111',
    created_by: ACCOUNTANT_ID,
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

const orderWithShipment = (shipmentOverrides) => baseOrder({
    shipments: [{ ...baseOrder().shipments[0], ...shipmentOverrides }],
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
        const order = await repo.createOrderWithShipments(baseOrder());

        assert.ok(order?.id, 'phải tạo được đơn');
        const { rows: shipments } = await pool.query(
            'SELECT id, status, estimated_price FROM order_shipments WHERE order_id = $1',
            [order.id],
        );
        assert.strictEqual(shipments.length, 1);
        assert.strictEqual(shipments[0].status, 'completed', 'đơn ngoài là đơn đã chạy xong');
        assert.strictEqual(Number(shipments[0].estimated_price), 1000000);
    });

    it('B1b — nhánh có tiền ứng trước cũng chạy (CASE WHEN prepaid > 0 gán người xác nhận)', async () => {
        const order = await repo.createOrderWithShipments(baseOrder({ prepaid_amount: 400000 }));

        const { rows: [savedOrder] } = await pool.query(
            'SELECT prepaid_amount, prepaid_status, prepaid_confirmed_by FROM orders WHERE id = $1',
            [order.id],
        );
        assert.strictEqual(Number(savedOrder.prepaid_amount), 400000);
        assert.strictEqual(savedOrder.prepaid_status, 'confirmed', 'kế toán tự thu nên xác nhận ngay');
        assert.strictEqual(savedOrder.prepaid_confirmed_by, ACCOUNTANT_ID);
    });

    it('B2 — biển số viết khác hoa/thường và khác dấu phân cách vẫn khớp đúng xe', async () => {
        for (const plate of ['51e-100.01', '51E 100 01', '51E10001', '  51E-100.01  ']) {
            const order = await repo.createOrderWithShipments(orderWithShipment({ vehicle_plate: plate }));
            const { rows: [ch] } = await pool.query(
                `SELECT sc.vehicle_id FROM order_shipments os
                 JOIN v_shipment_current sc ON sc.shipment_id = os.id
                 WHERE os.order_id = $1`,
                [order.id],
            );
            assert.strictEqual(ch.vehicle_id, 1, `biển số "${plate}" phải khớp xe id=1`);
        }
    });

    it('B3 — tên tài xế thừa khoảng trắng / khác hoa thường vẫn khớp đúng người', async () => {
        for (const name of ['pham van tien', 'PHAM VAN TIEN', 'Pham  Van   Tien', ' Pham Van Tien ']) {
            const order = await repo.createOrderWithShipments(orderWithShipment({ driver_name: name }));
            const { rows: [ch] } = await pool.query(
                `SELECT sc.owner_driver_id FROM order_shipments os
                 JOIN v_shipment_current sc ON sc.shipment_id = os.id
                 WHERE os.order_id = $1`,
                [order.id],
            );
            assert.strictEqual(ch.owner_driver_id, DRIVER_A, `tên "${name}" phải khớp tài xế id=${DRIVER_A}`);
        }
    });

    it('B4 — xe chưa có trong hệ thống thì từ chối kèm biển số, không âm thầm tạo xe mới', async () => {
        await assert.rejects(
            () => repo.createOrderWithShipments(orderWithShipment({ vehicle_plate: '99Z-999.99' })),
            /99Z-999\.99.*chưa có trong hệ thống/s,
        );
        const { rows } = await pool.query(`SELECT id FROM vehicles WHERE plate_number ILIKE '%99Z%'`);
        assert.strictEqual(rows.length, 0, 'không được tự tạo xe mới');
    });

    it('B5 — tài xế chưa có tài khoản thì từ chối kèm tên, không âm thầm tạo hồ sơ', async () => {
        await assert.rejects(
            () => repo.createOrderWithShipments(orderWithShipment({ driver_name: 'Nguyen Van Khong Co' })),
            /Nguyen Van Khong Co.*chưa có tài khoản/s,
        );
        const { rows } = await pool.query(`SELECT id FROM profiles WHERE full_name = 'Nguyen Van Khong Co'`);
        assert.strictEqual(rows.length, 0, 'không được tự tạo hồ sơ tài xế mới');
    });

    it('B7 — import lại cùng một dòng bị chặn, không nhân đôi doanh thu', async () => {
        const order = baseOrder({ customer_phone: '0909000222', completed_at: '2026-09-01' });
        const first = await repo.createOrderWithShipments({ ...order, import_fingerprint: buildImportFingerprint(order) });
        assert.ok(first?.id);

        await assert.rejects(
            () => repo.createOrderWithShipments({ ...order, import_fingerprint: buildImportFingerprint(order) }),
            (err) => err.isDuplicateImport === true,
            'lần import thứ hai phải bị nhận ra là trùng',
        );

        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM orders WHERE customer_id =
                (SELECT id FROM customers WHERE phone = '0909000222')`,
        );
        assert.strictEqual(rows[0].n, 1, 'chỉ được tồn tại đúng 1 đơn');
    });

    it('B8 — vân tay bỏ qua khác biệt định dạng: cùng dòng gõ khác kiểu vẫn là trùng', async () => {
        const original = baseOrder({ customer_phone: '0909000333', completed_at: '2026-09-02' });
        const retyped = baseOrder({
            customer_phone: '0909000333',
            completed_at: '2026-09-02',
            shipments: [{ ...original.shipments[0], vehicle_plate: '51e 100 01', driver_name: 'pham  van   tien' }],
        });

        assert.strictEqual(
            buildImportFingerprint(original), buildImportFingerprint(retyped),
            'biển số/tên khác định dạng phải cho cùng vân tay',
        );

        await repo.createOrderWithShipments({ ...original, import_fingerprint: buildImportFingerprint(original) });
        await assert.rejects(
            () => repo.createOrderWithShipments({ ...retyped, import_fingerprint: buildImportFingerprint(retyped) }),
            (err) => err.isDuplicateImport === true,
        );
    });

    it('B9 — sửa số liệu thật (đổi cước) thì KHÔNG bị coi là trùng', async () => {
        const order = baseOrder({ customer_phone: '0909000444', completed_at: '2026-09-03' });
        const changedOrder = baseOrder({
            customer_phone: '0909000444',
            completed_at: '2026-09-03',
            shipments: [{ ...order.shipments[0], cargo_fee: 1500000 }],
        });

        await repo.createOrderWithShipments({ ...order, import_fingerprint: buildImportFingerprint(order) });
        const created = await repo.createOrderWithShipments({ ...changedOrder, import_fingerprint: buildImportFingerprint(changedOrder) });
        assert.ok(created?.id, 'chuyến khác giá là chuyến khác, phải vào được');
    });

    it('B10 — kế toán chủ động cho phép trùng (fingerprint NULL) thì không bị chặn', async () => {
        const order = baseOrder({ customer_phone: '0909000555', completed_at: '2026-09-04' });
        await repo.createOrderWithShipments({ ...order, import_fingerprint: null });
        const second = await repo.createOrderWithShipments({ ...order, import_fingerprint: null });
        assert.ok(second?.id, 'fingerprint NULL không bị UNIQUE ràng buộc');
    });

    it('B11 — đơn nhập tay (không có fingerprint) không bị cơ chế này đụng tới', async () => {
        const order = baseOrder({ customer_phone: '0909000666', completed_at: '2026-09-05' });
        await repo.createOrderWithShipments(order);
        const second = await repo.createOrderWithShipments(order);
        assert.ok(second?.id, 'nhập tay hai đơn giống nhau vẫn phải được phép');
    });

    // ─── Định danh khách: chỉ cần TÊN hoặc SĐT ────────────────────────────────
    // Trước đây khách chỉ được tra theo SĐT. Dòng không có SĐT khớp vào "khách đầu tiên
    // có SĐT rỗng", nên MỌI dòng không SĐT đều dồn vào CÙNG một hồ sơ và tên gõ trong
    // Excel bị vứt đi — công nợ, doanh thu theo khách đều sai.

    const orderForCustomer = (khach) => baseOrder({ ...khach, completed_at: '2026-10-01' });

    it('C1 — chỉ có TÊN vẫn khớp đúng khách đã có, không đẻ hồ sơ mới', async () => {
        await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone, address)
                          VALUES (900, 'individual', 'Cong ty Hung Dung', '0912000900', '')`);
        const before = await pool.query('SELECT COUNT(*)::int AS n FROM customers');

        const order = await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: 'Cong ty Hung Dung', customer_phone: '' }),
        );

        const { rows: [savedOrder] } = await pool.query('SELECT customer_id FROM orders WHERE id = $1', [order.id]);
        assert.strictEqual(savedOrder.customer_id, 900);
        const after = await pool.query('SELECT COUNT(*)::int AS n FROM customers');
        assert.strictEqual(after.rows[0].n, before.rows[0].n, 'không được tạo thêm khách');
    });

    it('C2 — tên khác hoa/thường và thừa khoảng trắng vẫn là cùng một khách', async () => {
        const order = await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: '  cong ty   HUNG dung ', customer_phone: '' }),
        );
        const { rows: [savedOrder] } = await pool.query('SELECT customer_id FROM orders WHERE id = $1', [order.id]);
        assert.strictEqual(savedOrder.customer_id, 900);
    });

    it('C3 — chỉ có SĐT vẫn khớp đúng khách (SĐT là khoá mạnh nhất)', async () => {
        const order = await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: '', customer_phone: '0912000900' }),
        );
        const { rows: [savedOrder] } = await pool.query('SELECT customer_id FROM orders WHERE id = $1', [order.id]);
        assert.strictEqual(savedOrder.customer_id, 900);
    });

    it('C4 — tên chưa từng có thì tạo khách mới, KHÔNG dồn vào hồ sơ khách lẻ', async () => {
        const order = await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: 'Khach Hoan Toan Moi', customer_phone: '' }),
        );
        const { rows: [savedOrder] } = await pool.query(
            `SELECT c.id, c.full_name FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
            [order.id],
        );
        assert.strictEqual(savedOrder.full_name, 'Khach Hoan Toan Moi');
        assert.notStrictEqual(savedOrder.id, 900);
    });

    it('C5 — trùng tên thì từ chối kèm SĐT các ứng viên, không đoán bừa', async () => {
        await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone, address) VALUES
            (901, 'individual', 'Nguyen Van A', '0912000901', ''),
            (902, 'individual', 'Nguyen Van A', '0912000902', '')`);

        await assert.rejects(
            () => repo.createOrderWithShipments(orderForCustomer({ customer_name: 'Nguyen Van A', customer_phone: '' })),
            /2 khách cùng tên "Nguyen Van A".*0912000901.*0912000902.*điền SĐT/s,
        );
    });

    it('C6 — trùng tên nhưng có SĐT thì chọn đúng người', async () => {
        const order = await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: 'Nguyen Van A', customer_phone: '0912000902' }),
        );
        const { rows: [savedOrder] } = await pool.query('SELECT customer_id FROM orders WHERE id = $1', [order.id]);
        assert.strictEqual(savedOrder.customer_id, 902);
    });

    it('C7 — không tên không SĐT thì gom chung vào một hồ sơ "Khách lẻ"', async () => {
        const a = await repo.createOrderWithShipments(orderForCustomer({ customer_name: 'Khách lẻ', customer_phone: '' }));
        const b = await repo.createOrderWithShipments(orderForCustomer({ customer_name: 'Khách lẻ', customer_phone: '', prepaid_amount: 1 }));
        const { rows } = await pool.query('SELECT customer_id FROM orders WHERE id = ANY($1::int[])', [[a.id, b.id]]);
        assert.strictEqual(rows[0].customer_id, rows[1].customer_id, 'khách vãng lai dùng chung 1 hồ sơ');
    });

    it('C8 — khớp theo SĐT mà hồ sơ chưa có tên thì điền tên vừa nhập vào', async () => {
        await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone, address)
                          VALUES (903, 'individual', NULL, '0912000903', '')`);
        await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: 'Ten Bo Sung', customer_phone: '0912000903' }),
        );
        const { rows: [c] } = await pool.query('SELECT full_name FROM customers WHERE id = 903');
        assert.strictEqual(c.full_name, 'Ten Bo Sung');
    });

    it('C9 — KHÔNG ghi đè tên đã có sẵn của khách', async () => {
        await repo.createOrderWithShipments(
            orderForCustomer({ customer_name: 'Ten Khac Hoan Toan', customer_phone: '0912000900' }),
        );
        const { rows: [c] } = await pool.query('SELECT full_name FROM customers WHERE id = 900');
        assert.strictEqual(c.full_name, 'Cong ty Hung Dung', 'tên cũ phải giữ nguyên');
    });

    // ─── Xem trước: dòng nào đã có, dòng nào mới ─────────────────────────────
    // Luồng thật của DN: giữ MỘT file tổng, tháng nào cũng thêm dòng vào cuối rồi import
    // lại cả file. Dòng cũ phải bị bỏ qua LẶNG LẼ và kế toán phải thấy trước khi bấm.

    it('D1 — xem trước chỉ ra đúng dòng nào đã có, dòng nào mới', async () => {
        const daCo = baseOrder({ customer_phone: '0909000777', completed_at: '2026-11-01' });
        await repo.createOrderWithShipments({ ...daCo, import_fingerprint: buildImportFingerprint(daCo) });

        const moi = baseOrder({ customer_phone: '0909000778', completed_at: '2026-11-02' });

        const results = await repo.previewImport([
            { row_index: 2, phone: daCo.customer_phone, name: daCo.customer_name, fingerprint: buildImportFingerprint(daCo) },
            { row_index: 3, phone: moi.customer_phone,  name: moi.customer_name,  fingerprint: buildImportFingerprint(moi) },
        ]);

        assert.strictEqual(results[0].already_imported, true,  'dòng đã import phải bị đánh dấu');
        assert.strictEqual(results[1].already_imported, false, 'dòng mới phải được nhập');
        assert.ok(results[0].customer, 'vẫn kèm kết quả đối chiếu khách');
    });

    it('D2 — hai dòng giống hệt nhau trong CÙNG file: dòng sau là bản sao', async () => {
        const don = baseOrder({ customer_phone: '0909000779', completed_at: '2026-11-03' });
        const fp = buildImportFingerprint(don);

        const results = await repo.previewImport([
            { row_index: 2, phone: don.customer_phone, name: don.customer_name, fingerprint: fp },
            { row_index: 3, phone: don.customer_phone, name: don.customer_name, fingerprint: fp },
        ]);

        assert.strictEqual(results[0].already_imported, false, 'dòng đầu vẫn là dòng mới');
        assert.strictEqual(results[1].already_imported, true,  'dòng sau là bản sao của dòng đầu');
    });

    it('D3 — vân tay xem trước TRÙNG KHÍT vân tay lúc import (nếu lệch là xem trước nói dối)', async () => {
        const don = baseOrder({ customer_phone: '0909000780', completed_at: '2026-11-04' });
        const fp = buildImportFingerprint(don);

        await repo.createOrderWithShipments({ ...don, import_fingerprint: fp });
        const { rows } = await pool.query(
            'SELECT import_fingerprint FROM orders WHERE import_fingerprint = $1', [fp],
        );
        assert.strictEqual(rows.length, 1);

        const results = await repo.previewImport([
            { row_index: 2, phone: don.customer_phone, name: don.customer_name, fingerprint: fp },
        ]);
        assert.strictEqual(results[0].already_imported, true);
    });

    // ─── Giá báo vs giá chốt ─────────────────────────────────────────────────
    // Giống luồng trong app: đơn tạo với giá báo, coordinator duyệt phiếu thu thì chốt
    // lại giá thật (estimated_price → actual_price). Import phải giữ được CẢ HAI.

    it('E1 — không điền giá chốt thì hai giá bằng nhau (giữ nguyên hành vi cũ)', async () => {
        const order = await repo.createOrderWithShipments(
            baseOrder({ customer_phone: '0909000801', completed_at: '2026-12-01' }),
        );
        const { rows: [ship] } = await pool.query(
            'SELECT estimated_price, actual_price FROM order_shipments WHERE order_id = $1', [order.id],
        );
        assert.strictEqual(Number(ship.estimated_price), 1000000);
        assert.strictEqual(Number(ship.actual_price), 1000000);
    });

    it('E2 — chốt CAO hơn: giá báo giữ nguyên, doanh thu và sổ ghi theo giá chốt', async () => {
        const order = await repo.createOrderWithShipments(orderWithShipment({
            cargo_fee: 1000000, settled_fee: 1200000,
        }));
        const { rows: [ship] } = await pool.query(
            'SELECT id, estimated_price, actual_price FROM order_shipments WHERE order_id = $1', [order.id],
        );
        assert.strictEqual(Number(ship.estimated_price), 1000000, 'giá báo phải giữ lại để đối chiếu');
        assert.strictEqual(Number(ship.actual_price), 1200000, 'giá chốt vào actual_price');

        const { rows: [ft] } = await pool.query(
            `SELECT amount FROM financial_transactions
             WHERE event_type = 'shipment_revenue' AND ref_type = 'shipment' AND ref_id = $1`,
            [ship.id],
        );
        assert.strictEqual(Number(ft.amount), 1200000, 'sổ tài chính ghi theo giá chốt');
    });

    it('E3 — chốt THẤP hơn cũng được (giảm giá khách quen)', async () => {
        const order = await repo.createOrderWithShipments(orderWithShipment({
            cargo_fee: 1000000, settled_fee: 800000,
        }));
        const { rows: [ship] } = await pool.query(
            'SELECT estimated_price, actual_price FROM order_shipments WHERE order_id = $1', [order.id],
        );
        assert.strictEqual(Number(ship.estimated_price), 1000000);
        assert.strictEqual(Number(ship.actual_price), 800000);
    });

    it('E4 — công nợ tài xế tính theo giá chốt, không phải giá báo', async () => {
        const order = await repo.createOrderWithShipments(orderWithShipment({
            cargo_fee: 1000000, settled_fee: 1200000,
            payment_type: 'cash', driver_payment_state: 'driver_holding',
        }));
        const { rows: [debt] } = await pool.query(
            `SELECT total_amount FROM debts WHERE order_id = $1 AND debt_type = 'driver'`, [order.id],
        );
        assert.strictEqual(Number(debt.total_amount), 1200000);
    });

    it('E5 — đổi giá chốt là dòng khác, không bị coi là trùng', async () => {
        const a = baseOrder({ customer_phone: '0909000805', completed_at: '2026-12-05' });
        const b = baseOrder({
            customer_phone: '0909000805', completed_at: '2026-12-05',
            shipments: [{ ...a.shipments[0], settled_fee: 1200000 }],
        });
        assert.notStrictEqual(buildImportFingerprint(a), buildImportFingerprint(b));
    });

    it('B6 — hai tài xế trùng tên thì báo lỗi thay vì gán bừa cho người đầu tiên', async () => {
        await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES (6,'taiTrung@test.com','hash',4)`);
        await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (6,'Pham Van Tien',4)`);
        await pool.query(`
            INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date)
            VALUES (6, NULL, 1, 'DL-TRUNG', CURRENT_DATE)
        `);

        await assert.rejects(
            () => repo.createOrderWithShipments(orderWithShipment({ driver_name: 'Pham Van Tien' })),
            /nhiều tài xế cùng tên/,
        );

        await pool.query('DELETE FROM drivers WHERE profile_id = 6');
        await pool.query('DELETE FROM profiles WHERE id = 6');
        await pool.query('DELETE FROM accounts WHERE id = 6');
    });
});
