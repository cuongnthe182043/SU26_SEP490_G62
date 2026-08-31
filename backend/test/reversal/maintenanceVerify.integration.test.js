/**
 * Nghiệm thu bảo dưỡng nhầm — hiện có đường lùi nào?
 *
 * File này KHÔNG chứng minh một tính năng. Nó đo lại hiện trạng, vì "nghiệm thu bảo
 * dưỡng" là thao tác nặng nhất mà một Manager bấm được: một cú bấm sinh ra khoản chi,
 * ghi thẳng bút toán vào sổ, đóng phiếu bảo dưỡng và trả xe về chạy.
 *
 * Cái cần biết chính xác là: sau cú bấm đó, có gì lùi được và có gì không.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let vehicleManagementService;
let expenseService;

const MANAGER = 1;
const DRIVER = 4;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    vehicleManagementService = require('../../services/vehicleManagementService');
    expenseService = require('../../services/expenseService');

    await pool.query(`
        TRUNCATE reversal_requests, activity_logs, financial_transactions, expense_attachments,
                 expenses, maintenance_records, vehicle_status_history, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'m@t.com','h',1),(4,'d@t.com','h',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES (1,'Quản lý Bình',1),(4,'Tài xế Hùng',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1,'Xe 5m2',15000)`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4,NULL,1,'DL-1',CURRENT_DATE)`);
});

afterAll(async () => { await teardown(); });

let n = 0;
/** Một đợt bảo dưỡng tài xế đã khai xong, đang chờ Manager nghiệm thu. */
const choNghiemThu = async (cost = 5_000_000) => {
    n += 1;
    const vehicleId = 300 + n;
    await pool.query(
        `INSERT INTO vehicles (id, plate_number, vehicle_group_id, status)
         VALUES ($1, $2, 1, 'maintenance')`,
        [vehicleId, `51E-99.${String(n).padStart(2, '0')}`],
    );
    const { rows: [rec] } = await pool.query(
        `INSERT INTO maintenance_records
            (vehicle_id, maintenance_type, description, cost, maintenance_date,
             performed_by, status, bill_pics, completed_at, completed_by, created_by)
         VALUES ($1, 'scheduled', 'Thay dầu + lọc gió', $2, CURRENT_DATE,
                 4, 'pending_verification', $3::jsonb, NOW(), 4, 1)
         RETURNING id`,
        [vehicleId, cost, JSON.stringify(['http://anh/hoadon.jpg'])],
    );
    return { vehicleId, recordId: rec.id };
};

const doc = async (vehicleId, recordId) => {
    const { rows: [xe] } = await pool.query(`SELECT status FROM vehicles WHERE id = $1`, [vehicleId]);
    const { rows: [bd] } = await pool.query(
        `SELECT status, expense_id, verified_by, verified_at FROM maintenance_records WHERE id = $1`, [recordId]);
    const chi = bd.expense_id
        ? (await pool.query(`SELECT status, amount, reimbursement_status FROM expenses WHERE id = $1`, [bd.expense_id])).rows[0]
        : null;
    const { rows: so } = await pool.query(
        `SELECT id, debit_account, credit_account, amount, reversal_of_id
         FROM financial_transactions WHERE ref_type = 'expense' AND ref_id = $1 ORDER BY id`,
        [bd.expense_id ?? -1],
    );
    return { xe, bd, chi, so };
};

const catchErr = async (fn) => {
    try { await fn(); return null; } catch (e) { return e; }
};

describe('Nghiệm thu bảo dưỡng — hiện trạng đường lùi', () => {

    it('TRƯỚC khi nghiệm thu: có đường lùi đầy đủ (rejectMaintenance mode=redo)', async () => {
        const { vehicleId, recordId } = await choNghiemThu();

        await vehicleManagementService.rejectMaintenance(vehicleId, MANAGER, {
            mode: 'redo', reason: 'Ảnh hoá đơn mờ, số tiền không đọc được',
        });

        const sau = await doc(vehicleId, recordId);
        assert.notStrictEqual(sau.bd.status, 'completed');
        assert.strictEqual(sau.chi, null, 'chưa sinh khoản chi nào');
        assert.strictEqual(sau.so.length, 0, 'chưa ghi bút toán nào');
    });

    it('SAU khi nghiệm thu: một cú bấm sinh ra khoản chi + bút toán + đóng phiếu + trả xe về chạy', async () => {
        const { vehicleId, recordId } = await choNghiemThu(5_000_000);

        await vehicleManagementService.verifyMaintenance(vehicleId, MANAGER, {
            maintenance_record_id: recordId, verification_note: 'Đã xem hoá đơn',
        });

        const sau = await doc(vehicleId, recordId);
        assert.strictEqual(sau.bd.status, 'completed');
        assert.strictEqual(Number(sau.bd.verified_by), MANAGER);
        assert.strictEqual(sau.xe.status, 'active', 'xe đã quay lại chạy');
        assert.ok(sau.bd.expense_id, 'đã sinh khoản chi');
        assert.strictEqual(sau.chi.status, 'approved');
        assert.strictEqual(sau.chi.reimbursement_status, 'pending', 'đang chờ hoàn tiền cho tài xế');
        assert.strictEqual(sau.so.length, 1, 'đã ghi bút toán vào sổ');
        assert.strictEqual(Number(sau.so[0].amount), 5_000_000);
    });

    it('KHÔNG có đường lùi: rejectMaintenance từ chối bản ghi đã nghiệm thu', async () => {
        const { vehicleId, recordId } = await choNghiemThu();
        await vehicleManagementService.verifyMaintenance(vehicleId, MANAGER, { maintenance_record_id: recordId });

        for (const mode of ['redo', 'cancel']) {
            const err = await catchErr(() =>
                vehicleManagementService.rejectMaintenance(vehicleId, MANAGER, { mode, reason: 'Bấm nhầm' }));
            assert.ok(err, `mode=${mode} phải từ chối`);
        }

        const sau = await doc(vehicleId, recordId);
        assert.strictEqual(sau.bd.status, 'completed', 'phiếu vẫn đóng');
        assert.strictEqual(sau.so.length, 1, 'bút toán vẫn nằm trong sổ');
    });

    it('Gỡ duyệt khoản chi CHẠY ĐƯỢC, nhưng chỉ lùi được nửa việc — phiếu bảo dưỡng nằm lại', async () => {
        const { vehicleId, recordId } = await choNghiemThu(5_000_000);
        await vehicleManagementService.verifyMaintenance(vehicleId, MANAGER, { maintenance_record_id: recordId });

        const truoc = await doc(vehicleId, recordId);
        const expenseId = truoc.bd.expense_id;

        // Khoản chi sinh ra ở đây thoả mọi điều kiện của unapproveExpense
        // (approved + reimbursement_status='pending' + chưa có phiếu chi hoàn ứng),
        // nên đường tầng 2 vừa dựng CÓ THỂ tác động vào nó.
        await expenseService.unapproveExpense(expenseId, MANAGER, 'Manager bấm nghiệm thu nhầm xe', 'manager');

        const sau = await doc(vehicleId, recordId);

        // Phần sổ sách thì lùi sạch — bút toán đảo triệt tiêu số dư
        assert.strictEqual(sau.chi.status, 'pending', 'khoản chi về chờ duyệt lại');
        assert.strictEqual(sau.so.length, 2, 'có thêm một bút toán đảo');
        const duNo642 = sau.so.reduce(
            (t, d) => t + (d.debit_account === '642' ? Number(d.amount) : 0) - (d.credit_account === '642' ? Number(d.amount) : 0), 0);
        assert.strictEqual(duNo642, 0, 'chi phí đã triệt tiêu khỏi sổ');

        // NHƯNG phần vận hành thì không ai dọn — đây chính là chỗ hở
        assert.strictEqual(sau.bd.status, 'completed',
            'phiếu bảo dưỡng VẪN đóng dù khoản chi đã bị gỡ duyệt');
        assert.strictEqual(Number(sau.bd.expense_id), Number(expenseId),
            'phiếu vẫn trỏ vào khoản chi nay đã về trạng thái chờ');
        assert.ok(sau.bd.verified_at, 'dấu nghiệm thu vẫn còn nguyên');
        assert.strictEqual(sau.xe.status, 'active', 'xe không quay lại trạng thái bảo dưỡng');
    });

    it('Nghiệm thu nhầm rồi không nghiệm thu lại được: xe đã rời trạng thái bảo dưỡng', async () => {
        const { vehicleId, recordId } = await choNghiemThu();
        await vehicleManagementService.verifyMaintenance(vehicleId, MANAGER, { maintenance_record_id: recordId });

        const err = await catchErr(() =>
            vehicleManagementService.verifyMaintenance(vehicleId, MANAGER, { maintenance_record_id: recordId }));
        assert.ok(err, 'không nghiệm thu lại được — xe đã ở trạng thái active');
    });
});
