/**
 * Tầng 3 — bút toán đảo.
 *
 * Ở tầng này không có "hoàn tác": tiền đã đi thật. Cơ chế duy nhất là ghi một dòng
 * ngược chiều, giữ nguyên dòng gốc. Điều cần chứng minh là các chốt chặn quanh nó —
 * đặc biệt là chốt mới: đã xuất ra sổ kế toán thì không được đảo nữa, vì bản giấy
 * ngoài hệ thống đã mang con số đó.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let ledger;

const ACTOR = 3;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    ledger = require('../../repositories/financialLedgerRepository');

    await pool.query(`TRUNCATE financial_transactions, profiles, roles, accounts RESTART IDENTITY CASCADE`);
    await pool.query(`INSERT INTO roles (id, name) VALUES (3,'accountant')`);
    await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES (3,'a@t.com','h',3)`);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (3,'Kế toán Mai',3)`);
});

afterAll(async () => { await teardown(); });

let n = 0;
const newEntry = async ({ exported = false } = {}) => {
    n += 1;
    const { rows: [row] } = await pool.query(
        `INSERT INTO financial_transactions
            (event_type, debit_account, credit_account, amount, description,
             ref_type, ref_id, actor_id, exported_at, export_batch_id)
         VALUES ('cash_receipt', '1111', '131', 1000000, 'Thu tiền khách',
                 'debt', $1, $2, $3, $4)
         RETURNING id`,
        [n, ACTOR, exported ? new Date() : null, exported ? 'KY-2026-08' : null],
    );
    return Number(row.id);
};

const catchErr = async (fn) => {
    try { await fn(); return null; } catch (e) { return e; }
};

describe('Tầng 3 — bút toán đảo', () => {

    it('đảo một dòng chưa xuất: sinh dòng ngược chiều, dòng gốc giữ nguyên', async () => {
        const id = await newEntry();
        const { reversalId } = await ledger.reverseTransaction(id, { reason: 'Ghi nhầm khách', actorId: ACTOR });

        const { rows: [goc] } = await pool.query(
            `SELECT debit_account, credit_account, amount FROM financial_transactions WHERE id = $1`, [id]);
        const { rows: [dao] } = await pool.query(
            `SELECT debit_account, credit_account, amount, reversal_of_id, reversal_reason
             FROM financial_transactions WHERE id = $1`, [reversalId]);

        assert.strictEqual(goc.debit_account, '1111', 'dòng gốc không được sửa');
        assert.strictEqual(dao.debit_account, goc.credit_account, 'nợ/có phải đảo chiều');
        assert.strictEqual(dao.credit_account, goc.debit_account);
        assert.strictEqual(Number(dao.amount), Number(goc.amount));
        assert.strictEqual(Number(dao.reversal_of_id), id);
        assert.match(dao.reversal_reason, /Ghi nhầm khách/);
    });

    it('KHÔNG đảo được dòng đã xuất ra sổ kế toán — sai của kỳ đã chốt phải điều chỉnh ở kỳ sau', async () => {
        const id = await newEntry({ exported: true });

        const err = await catchErr(() =>
            ledger.reverseTransaction(id, { reason: 'Muốn sửa lại', actorId: ACTOR }));

        assert.ok(err, 'phải từ chối');
        assert.match(err.message, /đã xuất ra sổ kế toán/);
        assert.match(err.message, /KY-2026-08/, 'phải nói rõ kỳ nào để kế toán biết đường tra');
        assert.match(err.message, /kỳ sau/, 'phải chỉ đường xử lý đúng');

        const { rows } = await pool.query(
            `SELECT count(*)::int AS n FROM financial_transactions WHERE reversal_of_id = $1`, [id]);
        assert.strictEqual(rows[0].n, 0, 'không được sinh dòng đảo nào');
    });

    it('không đảo hai lần, và không đảo chính dòng đảo', async () => {
        const id = await newEntry();
        const { reversalId } = await ledger.reverseTransaction(id, { reason: 'Lần đầu', actorId: ACTOR });

        const lanHai = await catchErr(() =>
            ledger.reverseTransaction(id, { reason: 'Lần hai', actorId: ACTOR }));
        assert.match(lanHai.message, /đã được đảo trước đó/);

        const daoTiep = await catchErr(() =>
            ledger.reverseTransaction(reversalId, { reason: 'Đảo cái đảo', actorId: ACTOR }));
        assert.match(daoTiep.message, /không đảo tiếp được/);
    });

    it('số dư triệt tiêu sau khi đảo — đó mới là điều người dùng thấy', async () => {
        await pool.query(`TRUNCATE financial_transactions RESTART IDENTITY`);
        const id = await newEntry();
        await ledger.reverseTransaction(id, { reason: 'Thu nhầm', actorId: ACTOR });

        const { rows: [r] } = await pool.query(`
            SELECT SUM(CASE WHEN debit_account = '1111' THEN amount ELSE 0 END)
                 - SUM(CASE WHEN credit_account = '1111' THEN amount ELSE 0 END) AS du_tien_mat
            FROM financial_transactions
        `);
        assert.strictEqual(Number(r.du_tien_mat), 0, 'thu rồi đảo thì quỹ tiền mặt phải về 0');
    });
});
