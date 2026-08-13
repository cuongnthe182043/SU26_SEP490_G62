const pool = require('../config/database');
const financialLedgerRepository = require('./financialLedgerRepository');
const incidentRepository = require('./incidentRepository');
const {
    isCustomerBillableExpense,
    NO_LIVE_REIMBURSEMENT_VOUCHER_SQL,
} = require('../constants/expenseConstants');

// Danh sách loại phiếu kế toán được tự chọn khi lập phiếu chi tay. KHÔNG có
// 'prepaid_refund' và 'driver_reimbursement': hai loại này luôn phải gắn với một bản ghi
// cụ thể (đơn hàng / khoản chi phí) nên chỉ được tạo từ đúng luồng của nó, chọn tay là
// mất liên kết và sinh phiếu mồ côi.
const VOUCHER_TYPES    = ['office', 'rent', 'utilities', 'equipment', 'entertainment', 'compensation', 'other'];
const VOUCHER_STATUSES = ['pending', 'approved', 'rejected', 'paid', 'cancelled'];
const PAYMENT_METHODS  = ['cash', 'bank_transfer'];

const BASE = `
    SELECT
        pv.id, pv.voucher_type, pv.amount::text, pv.payee, pv.reason,
        pv.payment_method, pv.proof_url, pv.status, pv.rejection_reason,
        pv.incident_id, pv.order_id, pv.expense_id,
        pv.created_by, pv.approved_by, pv.paid_by, pv.cancelled_by,
        pv.approved_at, pv.paid_at, pv.cancelled_at, pv.cancellation_reason,
        pv.created_at, pv.updated_at,
        cre.full_name AS created_by_name,
        apr.full_name AS approved_by_name,
        pai.full_name AS paid_by_name,
        can.full_name AS cancelled_by_name,
        ex.expense_type AS expense_type,
        ex.expense_date AS expense_date,
        -- Tài xế thụ hưởng của phiếu hoàn ứng — quy chủ giống bảng lương để còn báo cho
        -- đúng người khi tiền được chi.
        COALESCE(exsc.owner_driver_id, exmr.performed_by, ex.created_by) AS expense_driver_id
    FROM payment_vouchers pv
    JOIN profiles cre      ON cre.id = pv.created_by
    LEFT JOIN profiles apr ON apr.id = pv.approved_by
    LEFT JOIN profiles pai ON pai.id = pv.paid_by
    LEFT JOIN profiles can ON can.id = pv.cancelled_by
    LEFT JOIN expenses ex  ON ex.id  = pv.expense_id
    LEFT JOIN v_shipment_current exsc  ON exsc.shipment_id = ex.shipment_id
    LEFT JOIN maintenance_records exmr ON exmr.expense_id  = ex.id
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
const create = async ({ voucher_type, amount, payee, reason, payment_method, proof_url, incident_id, order_id, expense_id, status }, createdBy, client = null) => {
    const executor = client ?? pool;
    const { rows: [row] } = await executor.query(
        `INSERT INTO payment_vouchers
            (voucher_type, amount, payee, reason, payment_method, proof_url, incident_id, order_id, expense_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [voucher_type, Number(amount), payee, reason, payment_method ?? 'cash', proof_url ?? null, incident_id ?? null, order_id ?? null, expense_id ?? null, status ?? 'pending', createdBy],
    );
    return getById(row.id, client);
};

// Các khoản tài xế đã ứng tiền túi, đã duyệt, còn chờ hoàn — và CHƯA có phiếu hoàn ứng nào
// đang sống. Đây là nguồn dữ liệu cho màn "Hoàn ứng tài xế" bên kế toán.
//
// Quy chủ khoản chi giống hệt bảng lương: ưu tiên tài đang giữ chuyến, rồi người thực hiện
// bảo dưỡng, cuối cùng mới là người tạo — bảo dưỡng có shipment_id NULL và created_by là
// manager duyệt nên nếu chỉ nhìn created_by sẽ quy nhầm cho manager.
//
// JOIN drivers là CHỐT AN TOÀN, không phải cho vui: nhánh cuối COALESCE rơi về created_by,
// mà đơn nhập tay/import (accountantOrderRepository) ghi created_by = KẾ TOÁN và không gán
// tài xế. Không chặn thì chính kế toán hiện lên màn này dưới danh nghĩa người thụ hưởng, tự
// lập phiếu chi cho mình rồi khoản bị đánh 'settled' — tài xế thật không bao giờ nhận được.
// Bảng lương không dính vì nó luôn lọc theo đúng một driver_id.
const REIMBURSEMENT_BENEFICIARY = `COALESCE(sc.owner_driver_id, mr.performed_by, e.created_by)`;

const REIMBURSEMENT_FROM = `
        FROM expenses e
        LEFT JOIN order_shipments os     ON os.id = e.shipment_id
        LEFT JOIN v_shipment_current sc  ON sc.shipment_id = e.shipment_id
        LEFT JOIN maintenance_records mr ON mr.expense_id = e.id
        LEFT JOIN vehicles v             ON v.id = e.vehicle_id
        JOIN drivers drv_chk             ON drv_chk.profile_id = ${REIMBURSEMENT_BENEFICIARY}
        JOIN profiles drv                ON drv.id = ${REIMBURSEMENT_BENEFICIARY}
        WHERE e.status = 'approved'
          AND e.reimbursement_status = 'pending'
          AND ${NO_LIVE_REIMBURSEMENT_VOUCHER_SQL('e')}`;

const REIMBURSEMENT_COLS = `
            e.id                AS expense_id,
            e.expense_type,
            e.amount::text      AS amount,
            e.description,
            e.expense_date,
            e.shipment_id,
            os.order_id,
            os.status           AS shipment_status,
            v.plate_number,
            ${REIMBURSEMENT_BENEFICIARY} AS driver_id,
            drv.full_name       AS driver_name,
            drv.phone           AS driver_phone,
            (SELECT COALESCE(json_agg(ea.file_url ORDER BY ea.id), '[]'::json)
             FROM expense_attachments ea WHERE ea.expense_id = e.id) AS receipt_urls`;

// Tra đúng MỘT khoản, dùng chung điều kiện với danh sách. Trước đây lúc lập phiếu phải chạy
// lại toàn bộ query danh sách rồi Array.find — vừa phí, vừa dễ lệch nếu hai bên sửa rời nhau.
const getPendingReimbursement = async (expenseId, client = null) => {
    const { rows } = await (client ?? pool).query(
        `SELECT ${REIMBURSEMENT_COLS} ${REIMBURSEMENT_FROM} AND e.id = $1`,
        [expenseId],
    );
    return rows[0] ?? null;
};

const listPendingReimbursements = async () => {
    const { rows } = await pool.query(`
        SELECT ${REIMBURSEMENT_COLS}
        ${REIMBURSEMENT_FROM}
        ORDER BY e.expense_date ASC, e.id ASC
    `);
    return rows;
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

// Chi hoàn ứng cho tài xế: ghi sổ theo ĐÚNG bên chịu chi phí rồi khoá khoản chi phí lại.
//
//   Chi hộ khách (toll/parking/etc trên chuyến còn đòi được khách) → Nợ 3388 (phải thu lại
//     của khách), event 'pass_through_cost' — giống hệt lúc hoàn bằng cấn trừ nợ thu hộ.
//   Còn lại (xăng, sửa xe, bảo dưỡng, hoặc chuyến đã huỷ/thất bại) → Nợ 642, doanh nghiệp chịu.
//
// Ghi 3388 cho khoản DN chịu thì số dư treo vĩnh viễn vì không bao giờ đòi được ai.
const settleDriverReimbursement = async (client, { voucher, creditAccount, paidBy }) => {
    if (!voucher.expense_id) {
        throw new Error('Phiếu hoàn ứng không gắn với khoản chi phí nào — không thể chi');
    }

    const { rows: [exp] } = await client.query(
        `SELECT e.id, e.expense_type, e.reimbursement_status, os.status AS shipment_status
         FROM expenses e
         LEFT JOIN order_shipments os ON os.id = e.shipment_id
         WHERE e.id = $1
         FOR UPDATE OF e`,
        [voucher.expense_id],
    );
    if (!exp) throw new Error('Khoản chi phí của phiếu hoàn ứng không còn tồn tại');

    const isPassThrough = isCustomerBillableExpense(exp.expense_type, exp.shipment_status);
    await financialLedgerRepository.insertTransaction(client, {
        eventType: isPassThrough ? 'pass_through_cost' : 'expense_recorded',
        debitAccount: isPassThrough ? '3388' : '642',
        creditAccount,
        amount: Number(voucher.amount),
        description: `${isPassThrough ? 'Chi hộ khách' : 'Chi phí DN chịu'} (${exp.expense_type}) — `
            + `hoàn tiền tài xế đã ứng, phiếu chi #${voucher.id}, chi cho: ${voucher.payee}`,
        refType: 'expense',
        refId: exp.id,
        actorId: paidBy,
    });

    // Chốt chặn cuối: chỉ hoàn được khoản còn 'pending'. Nếu trong lúc phiếu chờ duyệt mà
    // khoản đã được cấn trừ nợ hoặc hoàn qua lương thì dừng luôn, không chi lần hai.
    const { rowCount } = await client.query(
        `UPDATE expenses
         SET reimbursement_status = 'settled', reimbursed_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND reimbursement_status = 'pending'`,
        [exp.id],
    );
    if (rowCount === 0) {
        throw new Error(
            'Khoản chi phí này đã được hoàn bằng đường khác (cấn trừ nợ thu hộ hoặc qua lương) — không chi lại',
        );
    }
};

// Accountant xác nhận đã chi tiền — ghi sổ nhật ký tài chính trong cùng transaction.
// Tiền mặt → có 1111; chuyển khoản → có 1121.
//  - Phiếu chi thường: Nợ 642 (chi phí QLDN), event 'expense_recorded'.
//  - Phiếu hoàn tiền ứng trước (prepaid_refund): Nợ 131 (phải thu KH — đảo bút toán
//    prepaid_received), event 'prepaid_refunded', gắn ref về đơn.
// Cho phép đính chứng từ (proofUrl) + chọn lại hình thức chi (paymentMethod) khi chi.
const markPaid = async (id, paidBy, { proofUrl = null, paymentMethod = null } = {}) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [row] } = await client.query(
            `UPDATE payment_vouchers
             SET status = 'paid', paid_by = $2, paid_at = NOW(), updated_at = NOW(),
                 proof_url      = COALESCE($3, proof_url),
                 payment_method = COALESCE($4, payment_method)
             WHERE id = $1 AND status = 'approved'
             RETURNING id, voucher_type, amount, payee, payment_method, incident_id, order_id, expense_id`,
            [id, paidBy, proofUrl, paymentMethod],
        );
        if (!row) throw new Error('Không tìm thấy phiếu chi hoặc phiếu chưa được duyệt (cần approved)');

        const creditAccount = row.payment_method === 'bank_transfer' ? '1121' : '1111';

        if (row.voucher_type === 'driver_reimbursement') {
            await settleDriverReimbursement(client, { voucher: row, creditAccount, paidBy });
        } else {
            const isRefund = row.voucher_type === 'prepaid_refund';
            await financialLedgerRepository.insertTransaction(client, {
                eventType: isRefund ? 'prepaid_refunded' : 'expense_recorded',
                debitAccount: isRefund ? '131' : '642',
                creditAccount,
                amount: Number(row.amount),
                description: isRefund
                    ? `Hoàn tiền khách ứng trước — đơn #${row.order_id}, phiếu #${row.id}, cho: ${row.payee}`
                    : `Chi ${row.voucher_type} — phiếu chi #${row.id}, chi cho: ${row.payee}`,
                refType: isRefund ? 'order' : 'voucher',
                refId: isRefund ? row.order_id : row.id,
                actorId: paidBy,
            });
        }

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
    listPendingReimbursements,
    getPendingReimbursement,
    approve,
    reject,
    cancel,
    markPaid,
    getStats,
};
