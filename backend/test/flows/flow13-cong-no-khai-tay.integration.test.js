/**
 * L2-FLOW-09 — Luồng: Kế toán khai công nợ có từ TRƯỚC khi dùng phần mềm
 *
 * Test THEO LUỒNG: khai nợ cũ (khách / tài xế / đối tác) → ghi số dư đầu kỳ vào sổ →
 * sửa/xoá khi chưa thu → thu tiền thì khoá lại → nợ tài xế được khấu trừ dần vào lương
 * theo trần, không lấy sạch một tháng lương.
 *
 * Vì sao có file này: toàn bộ công nợ trước đây chỉ sinh ra từ chuyến, nên nợ cũ không
 * khai được và màn Công nợ chỉ phản ánh phần phát sinh sau khi dùng phần mềm.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let debtRepo;

const ACCOUNTANT_ID = 3;
const DRIVER_ID = 4;
const CUSTOMER_ID = 500;
const PARTNER_ID = 600;

const baseDebt = (overrides = {}) => ({
    debtType: 'customer',
    ownerId: CUSTOMER_ID,
    totalAmount: 5000000,
    incurredOn: '2026-03-15',
    dueDate: '2026-04-15',
    notes: 'Nợ tồn từ sổ tay',
    createdBy: ACCOUNTANT_ID,
    ...overrides,
});

const remainingOf = async (debtId) => {
    const { rows } = await pool.query(
        `SELECT d.total_amount - COALESCE((
             SELECT SUM(dp.amount) FROM debt_payments dp
             WHERE dp.debt_id = d.id AND dp.status = 'confirmed'), 0) AS remaining
         FROM debts d WHERE d.id = $1`, [debtId],
    );
    return Number(rows[0].remaining);
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    debtRepo = require('../../repositories/accountantDebtRepository');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, partners, customers,
                 order_shipments, orders, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (3,'ketoan@test.com','hash',3),(4,'tai@test.com','hash',4)`);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (3,'Ke Toan',3),(4,'Tai Xe A',4)`);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1,'Xe 5m2',15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, status) VALUES (1,'51E-100.01',1,'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date)
                      VALUES (4, 1, 1, 'DL-A', '2024-01-01')`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone, address)
                      VALUES (${CUSTOMER_ID}, 'individual', 'Khach Cu', '0900000001', '')`);
    await pool.query(`INSERT INTO partners (id, company_name, phone) VALUES (${PARTNER_ID}, 'Doi Tac Cu', '0900000002')`);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-09 — Khai công nợ có sẵn từ trước khi dùng phần mềm', () => {
    it('A1 — khai nợ khách: ghi bảng debts kèm bút toán số dư đầu kỳ 131/3388', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt());

        const { rows: [row] } = await pool.query(
            'SELECT debt_type, source, total_amount, incurred_on, created_by FROM debts WHERE id = $1', [debt.id],
        );
        assert.strictEqual(row.source, 'manual');
        assert.strictEqual(Number(row.total_amount), 5000000);
        assert.strictEqual(row.created_by, ACCOUNTANT_ID);

        const { rows: [ft] } = await pool.query(
            `SELECT event_type, debit_account, credit_account, amount, occurred_at::date::text AS d
             FROM financial_transactions WHERE ref_type = 'debt' AND ref_id = $1`, [debt.id],
        );
        assert.strictEqual(ft.event_type, 'opening_balance');
        assert.strictEqual(ft.debit_account, '131');
        assert.strictEqual(ft.credit_account, '3388');
        assert.strictEqual(Number(ft.amount), 5000000);
        // Ghi sổ theo NGÀY PHÁT SINH, không dồn hết vào kỳ hiện tại
        assert.strictEqual(ft.d, '2026-03-15');
    });

    it('A2 — nợ tài xế ghi vào tài khoản phải thu khác (1388), không phải 131', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({
            debtType: 'driver', ownerId: DRIVER_ID, totalAmount: 2000000,
        }));
        const { rows: [ft] } = await pool.query(
            `SELECT debit_account FROM financial_transactions WHERE ref_type='debt' AND ref_id=$1`, [debt.id],
        );
        assert.strictEqual(ft.debit_account, '1388');
    });

    it('A3 — khai được nợ đối tác (loại debts trước đây màn hình không hiển thị)', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({
            debtType: 'partner', ownerId: PARTNER_ID, totalAmount: 3000000,
        }));
        const { rows: [row] } = await pool.query('SELECT debt_type, partner_id FROM debts WHERE id=$1', [debt.id]);
        assert.strictEqual(row.debt_type, 'partner');
        assert.strictEqual(row.partner_id, PARTNER_ID);
    });

    it('A4 — đối tượng không tồn tại thì từ chối, kèm mã để kế toán tra lại', async () => {
        await assert.rejects(
            () => debtRepo.createManualDebt(baseDebt({ ownerId: 999999 })),
            (err) => err.status === 400 && /Khách hàng không tồn tại.*999999/.test(err.message),
        );
    });

    it('A5 — gán nợ TÀI XẾ cho một profile không phải tài xế thì bị chặn', async () => {
        // ACCOUNTANT_ID có trong profiles nên khoá ngoại vẫn qua — phải tra bảng drivers
        await assert.rejects(
            () => debtRepo.createManualDebt(baseDebt({ debtType: 'driver', ownerId: ACCOUNTANT_ID })),
            (err) => err.status === 400 && /Tài xế không tồn tại/.test(err.message),
        );
    });

    it('B1 — sửa được khi chưa thu đồng nào, sổ đảo bút toán cũ rồi ghi số mới', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({ totalAmount: 1000000 }));
        await debtRepo.updateManualDebt(debt.id, {
            totalAmount: 1500000, incurredOn: '2026-03-15', dueDate: null, notes: 'Sửa lại',
        }, ACCOUNTANT_ID);

        const { rows: [row] } = await pool.query('SELECT total_amount FROM debts WHERE id=$1', [debt.id]);
        assert.strictEqual(Number(row.total_amount), 1500000);

        // Sổ append-only: 3 bút toán (ghi 1tr → đảo 1tr → ghi 1.5tr), tổng dư đúng 1.5tr
        const { rows: fts } = await pool.query(
            `SELECT debit_account, credit_account, amount FROM financial_transactions
             WHERE ref_type='debt' AND ref_id=$1 ORDER BY id`, [debt.id],
        );
        assert.strictEqual(fts.length, 3);
        const balance131 = fts.reduce((s, f) => s + (f.debit_account === '131' ? Number(f.amount) : -Number(f.amount)), 0);
        assert.strictEqual(balance131, 1500000, 'số dư tài khoản 131 phải đúng bằng số sau khi sửa');
    });

    it('B2 — xoá được khi chưa thu, và sổ có bút toán đảo lại', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({ totalAmount: 800000 }));
        await debtRepo.deleteManualDebt(debt.id, ACCOUNTANT_ID);

        const { rows } = await pool.query('SELECT id FROM debts WHERE id=$1', [debt.id]);
        assert.strictEqual(rows.length, 0);

        const { rows: fts } = await pool.query(
            `SELECT debit_account, amount FROM financial_transactions WHERE ref_type='debt' AND ref_id=$1`, [debt.id],
        );
        const balance131 = fts.reduce((s, f) => s + (f.debit_account === '131' ? Number(f.amount) : -Number(f.amount)), 0);
        assert.strictEqual(balance131, 0, 'xoá xong thì số dư phải về 0, không để lại bút toán mồ côi');
    });

    it('B3 — đã phát sinh thanh toán thì KHÔNG cho sửa/xoá nữa', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({ totalAmount: 2000000 }));
        await pool.query(
            `INSERT INTO debt_payments (debt_id, amount, payment_method, status, created_by)
             VALUES ($1, 500000, 'cash', 'confirmed', $2)`, [debt.id, ACCOUNTANT_ID],
        );

        await assert.rejects(
            () => debtRepo.updateManualDebt(debt.id, {
                totalAmount: 9, incurredOn: '2026-03-15', dueDate: null, notes: 'x',
            }, ACCOUNTANT_ID),
            (err) => err.status === 400 && /đã có phát sinh thanh toán/.test(err.message),
        );
        await assert.rejects(
            () => debtRepo.deleteManualDebt(debt.id, ACCOUNTANT_ID),
            (err) => err.status === 400,
        );
    });

    it('B4 — nợ sinh từ CHUYẾN không được sửa qua đường khai tay', async () => {
        const { rows: [d] } = await pool.query(
            `INSERT INTO debts (debt_type, customer_id, total_amount, notes, source)
             VALUES ('customer', $1, 1000000, 'Nợ từ chuyến', 'shipment') RETURNING id`, [CUSTOMER_ID],
        );
        await assert.rejects(
            () => debtRepo.deleteManualDebt(d.id, ACCOUNTANT_ID),
            (err) => err.status === 400 && /sinh từ chuyến/.test(err.message),
        );
    });

    it('C0 — nợ tài xế lớn chỉ bị trừ theo TRẦN mỗi kỳ, tài xế vẫn còn lương', async () => {
        const payrollRepo = require('../../repositories/accountantPayrollRepository');

        await pool.query(`DELETE FROM debts WHERE driver_id = $1`, [DRIVER_ID]);
        await debtRepo.createManualDebt(baseDebt({
            debtType: 'driver', ownerId: DRIVER_ID, totalAmount: 50000000, notes: 'Nợ cũ rất lớn',
        }));

        const now = new Date();
        await payrollRepo.calculateAndUpsertPayrolls(now.getMonth() + 1, now.getFullYear());

        const { rows: [p] } = await pool.query(
            `SELECT gross_salary, absence_penalty, insurance_employee, driver_debt_deduction, net_salary
             FROM payrolls WHERE driver_id = $1`, [DRIVER_ID],
        );
        // Trần 30% được tính trên "netBeforeDebt" nội bộ của repository, dùng pro_rated_base
        // (base_salary đã cộng/trừ theo ngày công thực tế), KHÔNG phải cột gross_salary lưu
        // trong DB (cột đó luôn dùng base_salary thô, không phản ánh ngày dư/thiếu công).
        // gross_salary(DB) - absence_penalty = pro_rated_base + các khoản thưởng khác.
        const netBeforeDebt = Number(p.gross_salary) - Number(p.absence_penalty) - Number(p.insurance_employee);
        const debtDeducted = Number(p.driver_debt_deduction);

        // Trần mặc định 30%: không được lấy sạch, và không được vượt trần
        assert.ok(debtDeducted > 0, 'vẫn phải trừ một phần nợ');
        assert.ok(debtDeducted <= Math.round(netBeforeDebt * 0.30) + 1, `trừ ${debtDeducted} vượt trần 30% của ${netBeforeDebt}`);
        assert.ok(Number(p.net_salary) > 0, 'tài xế phải còn lương để sống, không được về 0');
    });

    it('C1 — nợ tài xế khai tay được thu tiền bằng luồng sẵn có, số dư giảm đúng', async () => {
        const debt = await debtRepo.createManualDebt(baseDebt({
            debtType: 'driver', ownerId: DRIVER_ID, totalAmount: 3000000,
        }));
        assert.strictEqual(await remainingOf(debt.id), 3000000);

        await pool.query(
            `INSERT INTO debt_payments (debt_id, amount, payment_method, status, created_by)
             VALUES ($1, 1200000, 'cash', 'confirmed', $2)`, [debt.id, ACCOUNTANT_ID],
        );
        assert.strictEqual(await remainingOf(debt.id), 1800000);
    });
});
