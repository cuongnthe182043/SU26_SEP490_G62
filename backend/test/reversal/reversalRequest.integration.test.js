/**
 * Hoàn tác tầng 2 — xin lùi, có người duyệt.
 *
 * Dựng lại tình huống thật: kế toán duyệt nhầm một khoản chi phí, người phát hiện ra
 * lại là tài xế (người không có quyền sửa). Cái cần chứng minh là con đường đi từ "tôi
 * thấy sai" tới "đã sửa xong và có vết", cùng những chỗ dễ vỡ trên đường đó — bấm
 * trùng, hai người cùng duyệt, duyệt xong mới biết không lùi được.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let reversalRequestService;
let expenseService;

const MANAGER = 1;
const ACCOUNTANT = 3;
const DRIVER = 4;
const MANAGER2 = 6;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    reversalRequestService = require('../../services/reversalRequestService');
    expenseService = require('../../services/expenseService');

    await pool.query(`
        TRUNCATE reversal_requests, activity_logs, financial_transactions, expenses,
                 order_shipments, orders, customers, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'m@t.com','h',1),(3,'a@t.com','h',3),(4,'d@t.com','h',4),(6,'m2@t.com','h',1)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Quản lý Bình',1),(3,'Kế toán Mai',3),(4,'Tài xế Hùng',4),(6,'Quản lý Sơn',1)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1,'Xe 5m2',15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1,'51E-246.80',1,4,'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4,1,1,'DL-1',CURRENT_DATE)`);
});

afterAll(async () => { await teardown(); });

let expSeq = 0;
/** Một khoản chi phí ĐÃ DUYỆT, chờ hoàn ứng — đúng trạng thái gỡ duyệt được. */
const approvedExpense = async (amount = 500000) => {
    expSeq += 1;
    const id = 5000 + expSeq;
    await pool.query(
        `INSERT INTO expenses (id, vehicle_id, created_by, expense_type, amount, description,
                               status, reviewed_by, reviewed_at, reimbursement_status)
         VALUES ($1, 1, $2, 'fuel', $3, 'Đổ dầu', 'approved', $4, NOW(), 'pending')`,
        [id, DRIVER, amount, ACCOUNTANT],
    );
    return id;
};

const readExpense = async (id) => {
    const { rows: [r] } = await pool.query(
        `SELECT status, reimbursement_status FROM expenses WHERE id = $1`, [id]);
    return r;
};

const catchErr = async (fn) => {
    try { await fn(); return null; } catch (e) { return e; }
};

describe('Hoàn tác tầng 2 — xin lùi có người duyệt', () => {

    it('KB1 — kế toán duyệt nhầm 500k, tài xế xin lùi, quản lý duyệt: khoản về chờ khai lại', async () => {
        const expenseId = await approvedExpense(500000);

        // Tài xế không có quyền gỡ duyệt, nhưng được quyền BÁO
        const req = await reversalRequestService.request({
            kind: 'expense.approve',
            entityId: expenseId,
            reason: 'Tôi khai nhầm 500.000, thực tế chỉ 50.000',
            requestedBy: DRIVER,
        });
        assert.strictEqual(req.status, 'pending');
        assert.strictEqual(Number(req.requested_by), DRIVER);
        assert.strictEqual(req.requested_by_name, 'Tài xế Hùng');

        // Quản lý duyệt
        const done = await reversalRequestService.approve(req.id, {
            decidedBy: MANAGER, actorRole: 'manager', note: 'Đúng, đã xem lại ảnh hóa đơn',
        });
        assert.strictEqual(done.status, 'approved');
        assert.strictEqual(done.execution_error, null, 'phải lùi được thật, không chỉ đổi trạng thái yêu cầu');
        assert.ok(done.executed_at);

        const expense = await readExpense(expenseId);
        assert.strictEqual(expense.status, 'pending', 'khoản chi phải quay về chờ duyệt');

        // Phải để lại vết, kèm lý do — trước đây gỡ duyệt không ghi gì
        await new Promise((r) => setTimeout(r, 250));
        const { rows } = await pool.query(
            `SELECT user_id, old_data, new_data FROM activity_logs
             WHERE action = 'expense_unapprove' AND entity_id = $1`, [expenseId]);
        assert.strictEqual(rows.length, 1);
        assert.strictEqual(rows[0].new_data.reversal_tier, 2);
        assert.match(rows[0].new_data.reason, /khai nhầm/);
        assert.strictEqual(Number(rows[0].old_data.amount), 500000, 'giữ lại số tiền TRƯỚC khi lùi');
    });

    it('KB2 — tài xế sốt ruột bấm gửi hai lần: yêu cầu thứ hai bị chặn, không sinh hàng đôi', async () => {
        const expenseId = await approvedExpense();
        const gui = () => reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Sai số tiền', requestedBy: DRIVER,
        });

        await gui();
        const err = await catchErr(gui);
        assert.ok(err);
        assert.match(err.message, /^DUPLICATE:/);

        const { rows } = await pool.query(
            `SELECT count(*)::int AS n FROM reversal_requests WHERE entity_id = $1`, [expenseId]);
        assert.strictEqual(rows[0].n, 1, 'chỉ được có đúng một yêu cầu');
    });

    it('KB3 — từ chối mà không nói lý do thì không cho: người gửi cần biết để xử lý cách khác', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Nghi sai', requestedBy: DRIVER,
        });

        const err = await catchErr(() => reversalRequestService.reject(req.id, {
            decidedBy: MANAGER, actorRole: 'manager', note: '   ',
        }));
        assert.ok(err);
        assert.match(err.message, /^REASON_REQUIRED:/);

        const { rows: [r] } = await pool.query(
            `SELECT status FROM reversal_requests WHERE id = $1`, [req.id]);
        assert.strictEqual(r.status, 'pending', 'yêu cầu vẫn phải đang chờ');
    });

    it('KB4 — hai quản lý cùng mở màn duyệt và cùng bấm: chỉ một quyết định được ghi', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Sai số tiền', requestedBy: DRIVER,
        });

        const ketQua = await Promise.allSettled([
            reversalRequestService.approve(req.id, { decidedBy: MANAGER, actorRole: 'manager' }),
            reversalRequestService.approve(req.id, { decidedBy: MANAGER2, actorRole: 'manager' }),
        ]);
        const ok = ketQua.filter((r) => r.status === 'fulfilled');
        assert.strictEqual(ok.length, 1, 'đúng một người được ăn');

        const { rows: [r] } = await pool.query(
            `SELECT status, decided_by FROM reversal_requests WHERE id = $1`, [req.id]);
        assert.strictEqual(r.status, 'approved');
        assert.ok([MANAGER, MANAGER2].includes(Number(r.decided_by)));
    });

    it('KB5 — duyệt xong mới biết khoản đã hoàn tiền: quyết định vẫn được giữ, ghi rõ vì sao không lùi được', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Khai nhầm', requestedBy: DRIVER,
        });

        // Trong lúc chờ duyệt, kế toán đã chi tiền hoàn ứng cho tài xế
        await pool.query(
            `UPDATE expenses SET reimbursement_status = 'settled', reimbursed_at = NOW() WHERE id = $1`,
            [expenseId],
        );

        const done = await reversalRequestService.approve(req.id, {
            decidedBy: MANAGER, actorRole: 'manager',
        });

        // Hai sự thật khác nhau: quản lý ĐÃ đồng ý, hệ thống KHÔNG lùi được.
        // Gộp lại thì màn hình hiện như chưa ai duyệt và người gửi sẽ gửi lại lần nữa.
        assert.strictEqual(done.status, 'approved', 'quyết định của quản lý phải được giữ');
        assert.ok(done.execution_error, 'phải ghi rõ vì sao không lùi được');
        assert.match(done.execution_error, /Không gỡ duyệt được/);
        assert.strictEqual((await readExpense(expenseId)).status, 'approved', 'khoản chi không đổi');
    });

    it('KB6 — người gửi tự rút lại khi chưa ai duyệt, và rút rồi thì hết rút', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Nhầm', requestedBy: DRIVER,
        });

        const cancelled = await reversalRequestService.cancelOwn(req.id, DRIVER);
        assert.strictEqual(cancelled.status, 'cancelled');

        const err = await catchErr(() => reversalRequestService.cancelOwn(req.id, DRIVER));
        assert.match(err.message, /^CONFLICT:/);

        // Rút rồi thì gửi lại được — chỉ số chặn trùng chỉ tính yêu cầu đang chờ
        const lai = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Gửi lại cho đúng', requestedBy: DRIVER,
        });
        assert.strictEqual(lai.status, 'pending');
    });

    it('KB7 — người khác không rút được yêu cầu của tài xế', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Nhầm', requestedBy: DRIVER,
        });

        const err = await catchErr(() => reversalRequestService.cancelOwn(req.id, ACCOUNTANT));
        assert.match(err.message, /^CONFLICT:/);
        const { rows: [r] } = await pool.query(`SELECT status FROM reversal_requests WHERE id = $1`, [req.id]);
        assert.strictEqual(r.status, 'pending');
    });

    it('KB8 — xin lùi loại hệ thống chưa làm được thì báo ngay, không để quản lý bấm duyệt vào chỗ trống', async () => {
        const err = await catchErr(() => reversalRequestService.request({
            kind: 'vehicle.retire', entityId: 1,
            reason: 'Khôi phục xe', requestedBy: DRIVER,
        }));
        assert.ok(err);
        assert.match(err.message, /^NOT_SUPPORTED:/);
    });

    it('KB9 — gỡ duyệt trực tiếp mà không ghi lý do thì bị chặn (không lách qua đường tầng 2)', async () => {
        const expenseId = await approvedExpense();
        const err = await catchErr(() =>
            expenseService.unapproveExpense(expenseId, ACCOUNTANT, '  ', 'accountant'));
        assert.ok(err);
        assert.match(err.message, /^REASON_REQUIRED:/);
        assert.strictEqual((await readExpense(expenseId)).status, 'approved');
    });

    it('KB10 — tài xế không được tự duyệt yêu cầu của chính mình', async () => {
        const expenseId = await approvedExpense();
        const req = await reversalRequestService.request({
            kind: 'expense.approve', entityId: expenseId,
            reason: 'Nhầm', requestedBy: DRIVER,
        });

        const err = await catchErr(() => reversalRequestService.approve(req.id, {
            decidedBy: DRIVER, actorRole: 'driver',
        }));
        assert.ok(err);
        assert.match(err.message, /^FORBIDDEN:/);
        assert.strictEqual((await readExpense(expenseId)).status, 'approved');
    });

    it('KB11 — danh sách chờ duyệt chỉ hiện yêu cầu còn treo, xếp cũ nhất trước', async () => {
        await pool.query(`TRUNCATE reversal_requests RESTART IDENTITY`);
        const e1 = await approvedExpense();
        const e2 = await approvedExpense();

        const r1 = await reversalRequestService.request({
            kind: 'expense.approve', entityId: e1, reason: 'Cái cũ', requestedBy: DRIVER,
        });
        const r2 = await reversalRequestService.request({
            kind: 'expense.approve', entityId: e2, reason: 'Cái mới', requestedBy: DRIVER,
        });
        await reversalRequestService.cancelOwn(r2.id, DRIVER);

        const pending = await reversalRequestService.listPending();
        assert.strictEqual(pending.length, 1);
        assert.strictEqual(pending[0].id, r1.id);
    });
});
