const pool = require('../config/database');
const financialLedgerRepository = require('./financialLedgerRepository');
const incidentRepository = require('./incidentRepository');

const VOUCHER_TYPES    = ['office', 'rent', 'utilities', 'equipment', 'entertainment', 'compensation', 'other'];
const VOUCHER_STATUSES = ['pending', 'approved', 'rejected', 'paid', 'cancelled'];
const PAYMENT_METHODS  = ['cash', 'bank_transfer'];

const BASE = `
    SELECT
        pv.id, pv.voucher_type, pv.amount::text, pv.payee, pv.reason,
        pv.payment_method, pv.proof_url, pv.status, pv.rejection_reason,
        pv.incident_id,
        pv.created_by, pv.approved_by, pv.paid_by, pv.cancelled_by,
        pv.approved_at, pv.paid_at, pv.cancelled_at, pv.cancellation_reason,
        pv.created_at, pv.updated_at,
        cre.full_name AS created_by_name,
        apr.full_name AS approved_by_name,
        pai.full_name AS paid_by_name,
        can.full_name AS cancelled_by_name
    FROM payment_vouchers pv
    JOIN profiles cre      ON cre.id = pv.created_by
    LEFT JOIN profiles apr ON apr.id = pv.approved_by
    LEFT JOIN profiles pai ON pai.id = pv.paid_by
    LEFT JOIN profiles can ON can.id = pv.cancelled_by
`;

// sort resolved via allowlist, never interpolated directly from user input
const VOUCHER_SORTS = {
    oldest:        'pv.created_at ASC',
    'amount-desc': 'pv.amount DESC',
    'amount-asc':  'pv.amount ASC',
    status:        'pv.status ASC, pv.created_at DESC',
};

const list = async ({ status, voucherType, month, year, search, sort, page, limit } = {}) => {
    const conds  = [];
    const params = [];
    let   i      = 1;

    if (status)      { conds.push(`pv.status = $${i++}`);       params.push(status); }
    if (voucherType) { conds.push(`pv.voucher_type = $${i++}`); params.push(voucherType); }
    if (month)       { conds.push(`EXTRACT(MONTH FROM pv.created_at) = $${i++}`); params.push(Number(month)); }
    if (year)        { conds.push(`EXTRACT(YEAR  FROM pv.created_at) = $${i++}`); params.push(Number(year)); }
    if (search) {
        conds.push(`(pv.payee ILIKE $${i} OR pv.reason ILIKE $${i} OR cre.full_name ILIKE $${i})`);
        params.push(`%${search}%`);
        i++;
    }

    const where       = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const orderClause = VOUCHER_SORTS[sort] ?? 'pv.created_at DESC';
    const safeLimit   = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage    = Math.max(1, Number(page) || 1);
    const offset      = (safePage - 1) * safeLimit;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(`${BASE} ${where} ORDER BY ${orderClause} LIMIT $${i} OFFSET $${i + 1}`, [...params, safeLimit, offset]),
        pool.query(`SELECT COUNT(*)::int AS total FROM payment_vouchers pv JOIN profiles cre ON cre.id = pv.created_by ${where}`, params),
    ]);

    return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil((countRows[0]?.total ?? 0) / safeLimit)),
    };
};

const getById = async (id, client = null) => {
    const { rows } = await (client ?? pool).query(`${BASE} WHERE pv.id = $1`, [id]);
    return rows[0] ?? null;
};

// `client` tùy chọn: cho phép tạo phiếu chi trong cùng transaction với nghiệp vụ sinh ra nó
// (VD: resolve sự cố kèm đền bù) để không có trường hợp sự cố đã commit mà phiếu chi thất bại.
const create = async ({ voucher_type, amount, payee, reason, payment_method, proof_url, incident_id }, createdBy, client = null) => {
    const executor = client ?? pool;
    const { rows: [row] } = await executor.query(
        `INSERT INTO payment_vouchers
            (voucher_type, amount, payee, reason, payment_method, proof_url, incident_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
         RETURNING id`,
        [voucher_type, Number(amount), payee, reason, payment_method ?? 'cash', proof_url ?? null, incident_id ?? null, createdBy],
    );
    return getById(row.id, client);
};

// Duyệt/từ chối phiếu chi. Phiếu gắn sự cố → đồng bộ cờ đền bù của sự cố trong cùng
// transaction, để không bao giờ có tình trạng phiếu đã rejected mà sự cố vẫn báo "đang chờ".
const decide = async (id, actorBy, { status, rejectionReason = null }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [row] } = await client.query(
            `UPDATE payment_vouchers
             SET status = $4, approved_by = $2, rejection_reason = $3,
                 approved_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id, incident_id`,
            [id, actorBy, rejectionReason, status],
        );
        if (!row) throw new Error('Không tìm thấy phiếu chi hoặc phiếu đã được xử lý');

        if (row.incident_id) {
            if (status === 'approved') {
                await incidentRepository.resolveAfterCompensationApproved(client, row.incident_id);
            } else {
                await incidentRepository.setCompensationStatus(client, row.incident_id, status);
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getById(id);
};

// Kế toán huỷ phiếu ĐÃ DUYỆT NHƯNG CHƯA CHI. Ràng buộc status = 'approved' là điểm mấu chốt:
// phiếu 'paid' đã sinh bút toán nên không huỷ được, chỉ sửa được bằng cách đảo bút toán.
const cancel = async (id, cancelledBy, reason) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [row] } = await client.query(
            `UPDATE payment_vouchers
             SET status = 'cancelled', cancelled_by = $2, cancellation_reason = $3,
                 cancelled_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status = 'approved'
             RETURNING id, incident_id`,
            [id, cancelledBy, reason],
        );
        if (!row) throw new Error('Chỉ huỷ được phiếu chi đã duyệt và chưa chi tiền');

        if (row.incident_id) {
            await incidentRepository.revertAfterCompensationCancelled(client, row.incident_id);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getById(id);
};

const approve = (id, approvedBy) => decide(id, approvedBy, { status: 'approved' });

const reject = (id, rejectedBy, reason) => decide(id, rejectedBy, { status: 'rejected', rejectionReason: reason });

// Accountant xác nhận đã chi tiền — ghi sổ nhật ký tài chính trong cùng transaction.
// Tiền mặt → có 1111; chuyển khoản → có 1121. Nợ 642 (chi phí QLDN).
const markPaid = async (id, paidBy) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [row] } = await client.query(
            `UPDATE payment_vouchers
             SET status = 'paid', paid_by = $2, paid_at = NOW(), updated_at = NOW()
             WHERE id = $1 AND status = 'approved'
             RETURNING id, voucher_type, amount, payee, payment_method, incident_id`,
            [id, paidBy],
        );
        if (!row) throw new Error('Không tìm thấy phiếu chi hoặc phiếu chưa được duyệt (cần approved)');

        await financialLedgerRepository.insertTransaction(client, {
            eventType: 'expense_recorded',
            debitAccount: '642',
            creditAccount: row.payment_method === 'bank_transfer' ? '1121' : '1111',
            amount: Number(row.amount),
            description: `Chi ${row.voucher_type} — phiếu chi #${row.id}, chi cho: ${row.payee}`,
            refType: 'voucher', refId: row.id, actorId: paidBy,
        });

        if (row.incident_id) {
            await incidentRepository.setCompensationStatus(client, row.incident_id, 'paid');
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return getById(id);
};

const getStats = async ({ month, year } = {}) => {
    const conds  = [];
    const params = [];
    let   i      = 1;
    if (month) { conds.push(`EXTRACT(MONTH FROM created_at) = $${i++}`); params.push(Number(month)); }
    if (year)  { conds.push(`EXTRACT(YEAR  FROM created_at) = $${i++}`); params.push(Number(year)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows: [row] } = await pool.query(
        `SELECT
             COUNT(*)::int                                                  AS total_count,
             COUNT(*) FILTER (WHERE status = 'pending')::int                AS pending_count,
             COUNT(*) FILTER (WHERE status = 'approved')::int               AS approved_count,
             COUNT(*) FILTER (WHERE status = 'paid')::int                   AS paid_count,
             COUNT(*) FILTER (WHERE status = 'rejected')::int               AS rejected_count,
             COUNT(*) FILTER (WHERE status = 'cancelled')::int              AS cancelled_count,
             COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::text  AS paid_total,
             COALESCE(SUM(amount) FILTER (WHERE status IN ('pending','approved')), 0)::text AS awaiting_total
         FROM payment_vouchers ${where}`,
        params,
    );
    return row;
};

module.exports = {
    VOUCHER_TYPES,
    VOUCHER_STATUSES,
    PAYMENT_METHODS,
    list,
    getById,
    create,
    approve,
    reject,
    cancel,
    markPaid,
    getStats,
};
