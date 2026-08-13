/**
 * L2-FLOW-19 — Hoàn ứng cho tài xế NGAY, không đợi kỳ lương.
 *
 * Trước đây khoản tài ứng tiền túi chỉ có 2 đường tất toán: cấn trừ vào nợ thu hộ (đòi hỏi
 * cùng đơn có tiền mặt tài đang giữ) hoặc chờ hoàn qua kỳ lương. Riêng chi phí BẢO DƯỠNG
 * có shipment_id = NULL nên không cấn trừ được — tài buộc phải chờ hết tháng.
 *
 * Đường thứ ba đi qua đúng luồng phiếu chi 2 cấp: kế toán lập → manager duyệt → kế toán chi.
 *
 * Điểm sống còn là KHÔNG ĐƯỢC CHI TRÙNG: phiếu chờ duyệt vẫn để khoản ở trạng thái
 * 'pending', nếu bảng lương không loại nó ra thì tài nhận tiền hai lần cho cùng hoá đơn.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let spendingService;
let payrollRepository;

const MGR_ID = 1;
const ACCT_ID = 3;
const DRIVER_ID = 4;
const MAINTENANCE_COST = 800000;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    spendingService = require('../../services/spendingService');
    payrollRepository = require('../../repositories/payrollRepository');

    await pool.query(`
        TRUNCATE financial_transactions, payment_vouchers, debt_payments, debts,
                 expense_attachments, expenses, maintenance_records, order_shipments, orders,
                 customers, vehicles, vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com','hash',1),(3,'acct@test.com','hash',3),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, phone, role_id) VALUES
        (1,'Manager','0900000001',1),(3,'Accountant','0900000003',3),(4,'Tran Van Tai','0900000004',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1, '51E-123.45', 1, 4, 'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4, 1, 1, 'DL-1', CURRENT_DATE - INTERVAL '14 months')`);

    // Chi phí BẢO DƯỠNG: shipment_id NULL, created_by là MANAGER (người xác minh) — tài xế
    // thụ hưởng chỉ suy ra được qua maintenance_records.performed_by.
    await pool.query(`
        INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, updated_by, expense_type,
                              amount, description, expense_date, status, reimbursement_status)
        VALUES (1, NULL, 1, 1, 1, 'maintenance', ${MAINTENANCE_COST}, 'Thay dau + loc gio',
                CURRENT_DATE, 'approved', 'pending')
    `);
    await pool.query(`
        INSERT INTO maintenance_records (id, vehicle_id, maintenance_type, maintenance_date, status,
                                         cost, performed_by, expense_id, created_by)
        VALUES (1, 1, 'scheduled', CURRENT_DATE, 'completed', ${MAINTENANCE_COST}, 4, 1, 4)
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-19 — Kế toán hoàn ứng ngay cho tài xế', () => {
    let voucherId;

    it('A — Khoản bảo dưỡng hiện trong danh sách chờ hoàn, quy đúng cho TÀI XẾ (không phải manager tạo phiếu)', async () => {
        const items = await spendingService.listPendingReimbursements();
        const item = items.find((row) => Number(row.expense_id) === 1);

        assert.ok(item, 'khoản bảo dưỡng phải nằm trong danh sách chờ hoàn');
        assert.strictEqual(Number(item.driver_id), DRIVER_ID,
            'phải quy cho tài thực hiện bảo dưỡng, không quy cho manager là created_by của expense');
        assert.strictEqual(item.driver_name, 'Tran Van Tai');
        assert.strictEqual(Number(item.amount), MAINTENANCE_COST);
    });

    it('B — Kế toán lập phiếu hoàn ứng: số tiền lấy từ DB, trạng thái chờ Manager duyệt', async () => {
        const voucher = await spendingService.createReimbursementVoucher(
            { expense_id: 1, payment_method: 'cash' }, ACCT_ID,
        );
        voucherId = voucher.id;

        assert.strictEqual(voucher.voucher_type, 'driver_reimbursement');
        assert.strictEqual(Number(voucher.amount), MAINTENANCE_COST);
        assert.strictEqual(voucher.status, 'pending', 'phải chờ Manager duyệt, không chi thẳng');
        assert.strictEqual(Number(voucher.expense_id), 1, 'phiếu phải gắn với đúng khoản chi phí');
        assert.strictEqual(voucher.payee, 'Tran Van Tai');
    });

    it('C — Lập phiếu lần hai cho cùng khoản thì bị chặn', async () => {
        await assert.rejects(
            () => spendingService.createReimbursementVoucher({ expense_id: 1 }, ACCT_ID),
            (err) => /không còn chờ hoàn/.test(err.message),
        );
    });

    it('D — Đang chờ duyệt thì bảng lương KHÔNG được hoàn khoản này nữa (chống chi trùng)', async () => {
        const now = new Date();
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, {
            month: now.getMonth() + 1, year: now.getFullYear(),
        });

        assert.strictEqual(
            Number(estimate.expense_reimbursement), 0,
            'khoản đã có phiếu hoàn ứng đang sống phải bị loại khỏi "Hoàn chi phí đã ứng" của bảng lương',
        );
    });

    it('E — Manager duyệt → Kế toán chi: khoản chuyển "settled" và ghi sổ Nợ 642 / Có 1111', async () => {
        await spendingService.approveVoucher(voucherId, MGR_ID);
        const paid = await spendingService.payVoucher(voucherId, ACCT_ID, { paymentMethod: 'cash' });
        assert.strictEqual(paid.status, 'paid');

        const { rows: [exp] } = await pool.query('SELECT reimbursement_status, reimbursed_at FROM expenses WHERE id = 1');
        assert.strictEqual(exp.reimbursement_status, 'settled', 'khoản phải được khoá lại, không hoàn thêm lần nữa');
        assert.notStrictEqual(exp.reimbursed_at, null);

        // Bảo dưỡng là chi phí DOANH NGHIỆP chịu → Nợ 642, không phải 3388 (chi hộ khách).
        // Ghi 3388 cho khoản không đòi được ai thì số dư treo vĩnh viễn trên sổ.
        const { rows: [ft] } = await pool.query(
            `SELECT event_type, debit_account, credit_account, amount::numeric AS amount, ref_type, ref_id
             FROM financial_transactions WHERE ref_type = 'expense' AND ref_id = 1`,
        );
        assert.ok(ft, 'phải ghi một bút toán cho khoản chi phí này');
        assert.strictEqual(ft.event_type, 'expense_recorded');
        assert.strictEqual(ft.debit_account, '642');
        assert.strictEqual(ft.credit_account, '1111', 'chi tiền mặt → Có 1111');
        assert.strictEqual(Number(ft.amount), MAINTENANCE_COST);
    });

    it('F — Đã chi rồi thì khoản biến khỏi danh sách chờ hoàn và khỏi bảng lương', async () => {
        const items = await spendingService.listPendingReimbursements();
        assert.strictEqual(items.length, 0, 'không còn khoản nào chờ hoàn');

        const now = new Date();
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, {
            month: now.getMonth() + 1, year: now.getFullYear(),
        });
        assert.strictEqual(Number(estimate.expense_reimbursement), 0, 'bảng lương không hoàn lại lần nữa');
    });

    it('G — Chi hộ khách thì ghi Nợ 3388 (còn đòi lại khách), không phải 642', async () => {
        await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1,'individual','Khach A','0911111111')`);
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price, derived_status)
            VALUES (1, 1, 3, 'Hang test', 'cash', 500000, 'completed')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, actual_price, status)
            VALUES (1, 1, 1, 1, 500000, 500000, 'completed')
        `);
        await pool.query(`
            INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, updated_by, expense_type,
                                  amount, description, expense_date, status, reimbursement_status)
            VALUES (2, 1, 1, 4, 4, 'toll', 60000, 'Phi cau duong', CURRENT_DATE, 'approved', 'pending')
        `);

        const voucher = await spendingService.createReimbursementVoucher(
            { expense_id: 2, payment_method: 'bank_transfer' }, ACCT_ID,
        );
        await spendingService.approveVoucher(voucher.id, MGR_ID);
        await spendingService.payVoucher(voucher.id, ACCT_ID, { paymentMethod: 'bank_transfer' });

        const { rows: [ft] } = await pool.query(
            `SELECT event_type, debit_account, credit_account FROM financial_transactions
             WHERE ref_type = 'expense' AND ref_id = 2`,
        );
        assert.strictEqual(ft.event_type, 'pass_through_cost');
        assert.strictEqual(ft.debit_account, '3388', 'chi hộ khách phải treo 3388 để còn đòi lại khách');
        assert.strictEqual(ft.credit_account, '1121', 'chi chuyển khoản → Có 1121');
    });
});
