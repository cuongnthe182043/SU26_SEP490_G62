const pool = require('../config/database');
const { isCustomerBillableExpense, isCompanyBorneShipment } = require('../constants/expenseConstants');

// Sổ nhật ký tài chính — append-only (BUSINESS_SPECIFICATION §33)
// Mỗi sự kiện tiền tệ INSERT 1 bản ghi. Không UPDATE, không DELETE
// (ngoại trừ đánh dấu exported_at khi xuất kỳ kế toán).

// Số hiệu tài khoản kế toán VN (text label — MISA xử lý bút toán thật):
//   1111 tiền mặt | 1121 tiền gửi NH | 131 phải thu KH | 1388 phải thu tài xế
//   141 tạm ứng   | 334 phải trả NLĐ | 511 doanh thu   | 642 chi phí QLDN | 3388 thu hộ/chi hộ

// executor: pool hoặc client (khi cần nằm trong transaction của caller)
const insertTransaction = async (executor, {
    eventType, debitAccount, creditAccount, amount,
    description = null, refType = null, refId = null, actorId = null,
    occurredAt = null, // ngày phát sinh thực tế (đơn import quá khứ) — null = NOW()
}) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null; // CHECK (amount > 0)
    const { rows: [row] } = await executor.query(
        `INSERT INTO financial_transactions
            (event_type, debit_account, credit_account, amount, description,
             ref_type, ref_id, actor_id, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()))
         RETURNING id`,
        [eventType, debitAccount, creditAccount, numericAmount, description, refType, refId, actorId, occurredAt],
    );
    return row;
};

const round2 = (n) => Math.round(n * 100) / 100;

// ─── Chi hộ khách: tách vế 3388 ngay tại bút toán tiền về ─────────────────────
//
// Số khách phải trả trên phiếu thu = CƯỚC + CHI HỘ (toll/parking/etc tài xế ứng túi).
// Doanh thu chỉ ghi phần cước (Nợ 131/Có 511), phần chi hộ nằm bên Nợ 3388 từ lúc
// duyệt chi phí. Nên khi tiền về mà ghi Có 131 TOÀN BỘ thì 131 bị Có thừa đúng bằng
// chi hộ (số dư âm) còn 3388 treo Nợ vĩnh viễn — không bao giờ tất toán.
//
// Vì vậy mọi sự kiện tiền khách về đều phải tách hai dòng: Có 3388 phần chi hộ,
// Có 131 phần cước. Quy ước: CHI HỘ ĐƯỢC THU TRƯỚC (khách trả thiếu thì phần thiếu
// là cước, vì chi hộ là tiền công ty đã bỏ ra hộ khách).

// Sự kiện TIỀN KHÁCH VỀ CÔNG TY — chỉ những sự kiện này mới tất toán dần 3388.
// driver_debt_paid (tài xế nộp quỹ) KHÔNG nằm ở đây: đó là luân chuyển nội bộ
// 1388 → 1111, tiền của khách đã được ghi nhận từ lúc tài xế cầm (driver_debt_created).
// Đếm cả nó là cùng một khoản chi hộ bị tất toán hai lần.
const MONEY_IN_EVENTS = ['bank_receipt', 'cash_receipt', 'customer_payment', 'driver_debt_created'];

// Ánh xạ một dòng sổ về đơn hàng của nó — chi hộ được theo dõi theo ĐƠN vì phiếu thu
// gộp cước + chi hộ của mọi chuyến trong đơn.
const FT_ORDER_ID_SQL = (alias) => `CASE
    WHEN ${alias}.ref_type = 'order'    THEN ${alias}.ref_id
    WHEN ${alias}.ref_type = 'shipment' THEN (SELECT order_id FROM order_shipments WHERE id = ${alias}.ref_id)
    WHEN ${alias}.ref_type = 'debt'     THEN (SELECT order_id FROM debts           WHERE id = ${alias}.ref_id)
    WHEN ${alias}.ref_type = 'expense'  THEN (
        SELECT os.order_id FROM expenses ex
        JOIN order_shipments os ON os.id = ex.shipment_id
        WHERE ex.id = ${alias}.ref_id
    )
    ELSE NULL
END`;

// Chi hộ của đơn CÒN PHẢI THU = số đã ghi Nợ 3388 − số đã thu được (ghi Có 3388).
//
// Đo bằng CHÍNH SỔ chứ không tính lại từ bảng expenses. Hai lý do:
//   - không bao giờ ghi Có 3388 nhiều hơn số đã ghi Nợ, nên 3388 của đơn không thể âm
//     vì một khoản chi phí mới khai mà chưa được duyệt (chưa lên sổ);
//   - khoản bị gỡ duyệt, bị đảo, hay chuyển sang 642 khi chuyến hủy đều tự động phản ánh
//     đúng, không phải nhớ đồng bộ thêm một công thức thứ hai.
//
// Phải trừ phần đã thu, nếu không thì đơn có nhiều lần tiền về (tài xế ghi nợ → khách trả
// nốt phần thiếu → ...) sẽ ghi Có 3388 lặp lại cho cùng một khoản chi hộ.
//
// Bút toán đảo mang cùng event_type nhưng ngược chiều nợ/có, nên mỗi vế được nhận diện
// bằng cặp (chiều tài khoản, có phải dòng đảo không) và cộng vào tổng với dấu tương ứng.
const getPassThroughOutstanding = async (executor, orderId) => {
    if (!orderId) return 0;
    const { rows: [row] } = await executor.query(
        `SELECT
            COALESCE((
                SELECT SUM(CASE WHEN f.reversal_of_id IS NULL THEN f.amount ELSE -f.amount END)
                FROM financial_transactions f
                WHERE f.event_type = 'pass_through_cost'
                  AND (
                        (f.reversal_of_id IS     NULL AND f.debit_account  = '3388')
                     OR (f.reversal_of_id IS NOT NULL AND f.credit_account = '3388')
                  )
                  AND ${FT_ORDER_ID_SQL('f')} = $1
            ), 0) AS debited,
            COALESCE((
                SELECT SUM(CASE WHEN f.reversal_of_id IS NULL THEN f.amount ELSE -f.amount END)
                FROM financial_transactions f
                WHERE f.event_type = ANY($2)
                  AND (
                        (f.reversal_of_id IS     NULL AND f.credit_account = '3388')
                     OR (f.reversal_of_id IS NOT NULL AND f.debit_account  = '3388')
                  )
                  AND ${FT_ORDER_ID_SQL('f')} = $1
            ), 0) AS collected`,
        [orderId, MONEY_IN_EVENTS],
    );
    return Math.max(0, round2(Number(row.debited) - Number(row.collected)));
};

// Ghi sự kiện tiền khách về, tự tách vế chi hộ (Có 3388) khỏi vế cước (Có 131).
// Trả về { freight, passThrough } để tầng gọi biết đã tách bao nhiêu.
const insertCustomerCashIn = async (executor, {
    eventType, debitAccount, amount, orderId,
    description, refType = null, refId = null, actorId = null, occurredAt = null,
}) => {
    const total = round2(Number(amount));
    if (!Number.isFinite(total) || total <= 0) return { freight: 0, passThrough: 0 };

    const passThrough = Math.min(await getPassThroughOutstanding(executor, orderId), total);
    const freight     = round2(total - passThrough);

    if (passThrough > 0) {
        await insertTransaction(executor, {
            eventType, debitAccount, creditAccount: '3388',
            amount: passThrough,
            description: `${description} — phần chi hộ khách (tất toán 3388)`,
            refType, refId, actorId, occurredAt,
        });
    }
    if (freight > 0) {
        await insertTransaction(executor, {
            eventType, debitAccount, creditAccount: '131',
            amount: freight,
            description: passThrough > 0 ? `${description} — phần cước` : description,
            refType, refId, actorId, occurredAt,
        });
    }
    return { freight, passThrough };
};

// ─── Chi phí tài xế ứng túi: ghi nhận NGAY KHI DUYỆT ──────────────────────────
//
// Duyệt chi phí = công ty xác nhận nợ tài xế khoản đó ⇒ nghĩa vụ đã phát sinh, phải
// lên sổ ngay (Có 334 — phải trả người lao động). Trước đây bút toán chỉ được ghi lúc
// HOÀN TIỀN, kéo theo hai hậu quả: khoản không đi qua đường hoàn nào (tài xế nghỉ việc,
// chi phí không gắn chuyến, khách CK thẳng nên không có nợ để cấn trừ) thì vĩnh viễn
// không có mặt trên sổ; và khoản có hoàn thì rơi vào tháng chốt lương chứ không phải
// tháng phát sinh.
//
// Bên Nợ tuỳ người chịu chi phí — giống hệt quy tắc của phiếu thu:
//   chi hộ khách (toll/parking/etc, chuyến còn đòi được khách) → Nợ 3388 (phải thu lại)
//   còn lại, hoặc chuyến đã huỷ/thất bại                        → Nợ 642 (DN chịu)
const recordExpenseAccrual = async (executor, {
    expenseId, expenseType, shipmentStatus, amount,
    actorId = null, occurredAt = null, note = null,
}) => {
    const isPassThrough = isCustomerBillableExpense(expenseType, shipmentStatus);
    const label = isPassThrough
        ? 'Chi hộ khách'
        : isCompanyBorneShipment(shipmentStatus)
            ? 'Chi phí DN chịu (chuyến hủy/thất bại)'
            : 'Chi phí vận hành';
    return insertTransaction(executor, {
        eventType:    isPassThrough ? 'pass_through_cost' : 'expense_recorded',
        debitAccount: isPassThrough ? '3388' : '642',
        creditAccount: '334',
        amount,
        description: `${label} (${expenseType}) — duyệt chi phí tài xế đã ứng #${expenseId}${note ? `. ${note}` : ''}`,
        refType: 'expense', refId: expenseId, actorId, occurredAt,
    });
};

// sort resolved via allowlist, never interpolated directly from user input
const JOURNAL_SORTS = {
    oldest:        'ft.occurred_at ASC, ft.id ASC',
    'amount-desc': 'ft.amount DESC, ft.id DESC',
    'amount-asc':  'ft.amount ASC, ft.id DESC',
};

const getJournal = async ({ eventType = null, from = null, to = null, exported = null, sort = null, limit = 200, offset = 0 }) => {
    const params = [];
    const conditions = [];
    if (eventType) { params.push(eventType); conditions.push(`ft.event_type = $${params.length}`); }
    if (from)      { params.push(from);      conditions.push(`ft.occurred_at >= $${params.length}`); }
    if (to)        { params.push(to);        conditions.push(`ft.occurred_at < ($${params.length}::date + INTERVAL '1 day')`); }
    if (exported === 'pending')  conditions.push('ft.exported_at IS NULL');
    if (exported === 'exported') conditions.push('ft.exported_at IS NOT NULL');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = JOURNAL_SORTS[sort] ?? 'ft.occurred_at DESC, ft.id DESC';
    params.push(limit, offset);

    const { rows } = await pool.query(
        `SELECT
            ft.id, ft.event_type,
            ft.debit_account, ft.credit_account,
            ft.amount::text,
            ft.description,
            ft.ref_type, ft.ref_id,
            ft.occurred_at,
            ft.exported_at, ft.export_batch_id,
            ft.reversal_of_id, ft.reversal_reason,
            rev.id AS reversed_by_id,
            p.full_name AS actor_name,
            COUNT(*) OVER() AS total_count
         FROM financial_transactions ft
         LEFT JOIN profiles p ON p.id = ft.actor_id
         LEFT JOIN financial_transactions rev ON rev.reversal_of_id = ft.id
         ${where}
         ORDER BY ${orderClause}
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
    );
    return rows;
};

// ─── Bút toán đảo (reversal entry) ────────────────────────────────────────────
// Không sửa/xóa dòng gốc — ghi 1 dòng NGƯỢC CHIỀU (đổi TK nợ/có) cùng số tiền,
// gắn reversal_of_id + lý do. Số dư tự triệt tiêu, audit trail giữ nguyên vẹn.
// Chỉ gọi từ luồng nghiệp vụ (voidRepayment...), luôn nằm trong transaction của caller.
// Không có đường gọi thủ công từ phía kế toán — xem ghi chú ở accountantLedgerController.
const reverseTransaction = async (ftId, { reason, actorId }, executor = pool) => {
    const { rows: [original] } = await executor.query(
        `SELECT ft.*, rev.id AS reversed_by_id
         FROM financial_transactions ft
         LEFT JOIN financial_transactions rev ON rev.reversal_of_id = ft.id
         WHERE ft.id = $1`,
        [ftId],
    );
    if (!original) throw new Error('Không tìm thấy bút toán');
    if (original.reversal_of_id) throw new Error('Đây đã là bút toán đảo — không đảo tiếp được');
    if (original.reversed_by_id) throw new Error('Bút toán này đã được đảo trước đó');

    const { rows: [reversal] } = await executor.query(
        `INSERT INTO financial_transactions
            (event_type, debit_account, credit_account, amount, description,
             ref_type, ref_id, actor_id, occurred_at, reversal_of_id, reversal_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
         RETURNING id`,
        [
            original.event_type,
            original.credit_account,   // đổi chiều nợ ↔ có
            original.debit_account,
            original.amount,
            `ĐẢO bút toán #${original.id}: ${reason}`,
            original.ref_type, original.ref_id,
            actorId, ftId, reason,
        ],
    );
    return { reversalId: reversal.id, originalId: Number(ftId) };
};

// Bút toán ghi nhận chi phí (recordExpenseAccrual) của một khoản, còn hiệu lực.
// Nhận diện bằng Có 334 để không bắt nhầm bút toán hoàn ứng (cũng ref về expense).
const findLiveExpenseAccruals = async (executor, expenseId) => {
    const { rows } = await executor.query(
        `SELECT ft.id, ft.debit_account, ft.amount, ft.occurred_at
         FROM financial_transactions ft
         WHERE ft.ref_type = 'expense'
           AND ft.ref_id   = $1
           AND ft.event_type IN ('pass_through_cost', 'expense_recorded')
           AND ft.credit_account = '334'
           AND ft.reversal_of_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM financial_transactions r WHERE r.reversal_of_id = ft.id)
         ORDER BY ft.id`,
        [expenseId],
    );
    return rows;
};

// Gỡ duyệt / xoá chi phí đã ghi nhận → đảo bút toán ghi nhận (không sửa, không xoá dòng gốc).
const reverseExpenseAccrual = async (executor, { expenseId, reason, actorId }) => {
    const accruals = await findLiveExpenseAccruals(executor, expenseId);
    for (const accrual of accruals) {
        await reverseTransaction(accrual.id, { reason, actorId }, executor);
    }
    return accruals.length;
};

// Chuyến bị huỷ/thất bại SAU khi chi phí đã được duyệt: khoản chi hộ thôi đòi được khách
// nên phải chuyển từ Nợ 3388 (phải thu lại) sang Nợ 642 (DN chịu) — đảo dòng cũ rồi ghi
// lại dòng mới, giữ nguyên vết. Để nguyên 3388 là treo một khoản phải thu không có ai trả.
const reclassPassThroughToCompany = async (executor, { shipmentId, reason, actorId }) => {
    const { rows: expenses } = await executor.query(
        `SELECT e.id, e.expense_type, e.amount, e.expense_date, os.status AS shipment_status
         FROM expenses e
         JOIN order_shipments os ON os.id = e.shipment_id
         WHERE e.shipment_id = $1
           AND e.status = 'approved'
         ORDER BY e.id`,
        [shipmentId],
    );

    let reclassed = 0;
    for (const exp of expenses) {
        const accruals = await findLiveExpenseAccruals(executor, exp.id);
        for (const accrual of accruals) {
            if (accrual.debit_account !== '3388') continue; // đã là 642, không phải làm gì
            await reverseTransaction(accrual.id, { reason, actorId }, executor);
            await recordExpenseAccrual(executor, {
                expenseId: exp.id,
                expenseType: exp.expense_type,
                shipmentStatus: exp.shipment_status,
                amount: accrual.amount,
                actorId,
                occurredAt: accrual.occurred_at,
                note: reason,
            });
            reclassed += 1;
        }
    }
    return reclassed;
};

const getJournalStats = async ({ from = null, to = null }) => {
    const params = [];
    const conditions = [];
    if (from) { params.push(from); conditions.push(`occurred_at >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`occurred_at < ($${params.length}::date + INTERVAL '1 day')`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
        `SELECT event_type,
                COUNT(*)                 AS tx_count,
                COALESCE(SUM(amount),0)::text AS total_amount,
                COUNT(*) FILTER (WHERE exported_at IS NULL) AS pending_export_count
         FROM financial_transactions
         ${where}
         GROUP BY event_type
         ORDER BY event_type`,
        params,
    );
    return rows;
};

// Xuất kỳ kế toán: chốt các bản ghi chưa export trong khoảng [from, to],
// đánh dấu exported_at + export_batch_id, trả về data để dựng file CSV.
const exportPeriod = async ({ from, to, accountantId }) => {
    const batchId = `EXP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // TH1 — cặp gốc + đảo đều CHƯA export: triệt tiêu nhau → đánh dấu VOID-batch,
        // KHÔNG đưa vào file (MISA nhận file sạch; vết sai vẫn nằm đủ trong TMS)
        await client.query(
            `UPDATE financial_transactions ft
             SET exported_at = NOW(), export_batch_id = $1
             FROM financial_transactions rev
             WHERE rev.reversal_of_id = ft.id
               AND ft.exported_at  IS NULL
               AND rev.exported_at IS NULL`,
            [`VOID-${batchId}`],
        );
        await client.query(
            `UPDATE financial_transactions rev
             SET exported_at = NOW(), export_batch_id = $1
             FROM financial_transactions orig
             WHERE rev.reversal_of_id = orig.id
               AND rev.exported_at IS NULL
               AND orig.export_batch_id = $1`,
            [`VOID-${batchId}`],
        );

        // TH2 — bút toán đảo của dòng ĐÃ export kỳ trước: vẫn nằm trong file kỳ này
        // như một dòng điều chỉnh (MISA hạch toán điều chỉnh kỳ sau — chuẩn kế toán).
        //
        // Không còn cột tách cước/chi hộ ở đây: sổ đã ghi sẵn hai dòng riêng (Có 3388 phần
        // chi hộ, Có 131 phần cước) ngay tại thời điểm tiền về — xem insertCustomerCashIn.
        // Cột cũ tính tổng chi hộ theo ĐƠN rồi gán cho MỌI dòng tiền về của đơn đó, nên một
        // đơn có nhiều lần tiền về thì cùng một khoản chi hộ được xuất sang MISA nhiều lần.
        const { rows } = await client.query(
            `UPDATE financial_transactions ft
             SET exported_at = NOW(), export_batch_id = $1
             WHERE ft.exported_at IS NULL
               AND ft.occurred_at >= $2
               AND ft.occurred_at < ($3::date + INTERVAL '1 day')
             RETURNING ft.id, ft.event_type, ft.debit_account, ft.credit_account,
                       ft.amount::text, ft.description, ft.ref_type, ft.ref_id,
                       ft.actor_id, ft.occurred_at, ft.reversal_of_id`,
            [batchId, from, to],
        );

        await client.query('COMMIT');
        return { batchId, exportedBy: accountantId, rows };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// ─── Tổng hợp chi (money-out) ─────────────────────────────────────────────────
// Các event tiền RA khỏi công ty. Bút toán đảo (reversal_of_id) trừ ngược để
// số liệu tự triệt tiêu khi có sai sót đã đảo.
const MONEY_OUT_EVENTS = [
    'expense_recorded', 'pass_through_cost', 'payroll_paid',
    'bonus_paid', 'advance_disbursed', 'prepaid_refunded',
];

const getSpendingSummary = async ({ month, year }) => {
    const m = Number(month);
    const y = Number(year);

    const [byType, trend] = await Promise.all([
        // Tổng theo loại trong tháng được chọn
        pool.query(
            `SELECT event_type,
                    COUNT(*) FILTER (WHERE reversal_of_id IS NULL)::int AS tx_count,
                    COALESCE(SUM(CASE WHEN reversal_of_id IS NULL THEN amount ELSE -amount END), 0)::text AS total_amount
             FROM financial_transactions
             WHERE event_type = ANY($1)
               AND EXTRACT(MONTH FROM occurred_at) = $2
               AND EXTRACT(YEAR  FROM occurred_at) = $3
             GROUP BY event_type
             ORDER BY event_type`,
            [MONEY_OUT_EVENTS, m, y],
        ),
        // Xu hướng 6 tháng gần nhất tính đến tháng được chọn
        pool.query(
            `SELECT EXTRACT(YEAR  FROM occurred_at)::int AS year,
                    EXTRACT(MONTH FROM occurred_at)::int AS month,
                    COALESCE(SUM(CASE WHEN reversal_of_id IS NULL THEN amount ELSE -amount END), 0)::text AS total_amount
             FROM financial_transactions
             WHERE event_type = ANY($1)
               AND occurred_at >= (make_date($3, $2, 1) - INTERVAL '5 months')
               AND occurred_at <  (make_date($3, $2, 1) + INTERVAL '1 month')
             GROUP BY 1, 2
             ORDER BY 1, 2`,
            [MONEY_OUT_EVENTS, m, y],
        ),
    ]);

    const grandTotal = byType.rows.reduce((s, r) => s + Number(r.total_amount), 0);
    return { by_type: byType.rows, trend: trend.rows, grand_total: String(grandTotal) };
};

module.exports = {
    insertTransaction, getJournal, getJournalStats, exportPeriod,
    reverseTransaction, getSpendingSummary,
    // chi hộ khách — tách vế 3388 tại bút toán tiền về
    insertCustomerCashIn, getPassThroughOutstanding, MONEY_IN_EVENTS,
    // chi phí tài xế ứng túi — ghi nhận khi duyệt, đảo khi gỡ duyệt
    recordExpenseAccrual, reverseExpenseAccrual, reclassPassThroughToCompany,
};
