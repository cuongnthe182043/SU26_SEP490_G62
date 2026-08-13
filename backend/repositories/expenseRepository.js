const pool = require('../config/database');
const { NO_LIVE_REIMBURSEMENT_VOUCHER_SQL } = require('../constants/expenseConstants');
const financialLedgerRepository = require('./financialLedgerRepository');

const createExpense = async ({ shipmentId, vehicleId, driverId, expenseType, amount, description, clientRequestId }) => {
    // Driver khai chi phí → pending, chờ coordinator duyệt (ghi sổ FT khi duyệt)
    //
    // clientRequestId: khoá chống trùng do app sinh. App có hàng đợi offline nên một
    // thao tác có thể được gửi lại nhiều lần; ON CONFLICT DO NOTHING khiến lần gửi
    // thứ hai không tạo thêm bản ghi, và ta trả về đúng bản ghi đã tạo lần đầu để
    // phía client vẫn thấy thành công (thay vì báo lỗi rồi lại gửi lại nữa).
    const result = await pool.query(
        `INSERT INTO expenses (shipment_id, vehicle_id, created_by, expense_type, amount, description, status, client_request_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
         ON CONFLICT (client_request_id) DO NOTHING
         RETURNING *`,
        [shipmentId, vehicleId ?? null, driverId, expenseType, amount, description ?? null, clientRequestId ?? null],
    );
    if (result.rows[0]) return result.rows[0];

    // Không insert được nghĩa là clientRequestId đã tồn tại → lấy lại bản ghi cũ
    const existing = await pool.query(
        `SELECT * FROM expenses WHERE client_request_id = $1`,
        [clientRequestId],
    );
    if (!existing.rows[0]) throw new Error('Không tạo được chi phí');
    return { ...existing.rows[0], _daTonTai: true };
};

const addExpenseAttachment = async (expenseId, fileUrl) => {
    const result = await pool.query(
        `INSERT INTO expense_attachments (expense_id, file_url)
         VALUES ($1, $2)
         RETURNING *`,
        [expenseId, fileUrl],
    );
    return result.rows[0];
};

const getShipmentExpenses = async (shipmentId) => {
    const result = await pool.query(
        `SELECT
            e.id,
            e.shipment_id,
            e.expense_type,
            e.amount::text,
            e.description,
            e.expense_date,
            e.status,
            e.reject_reason,
            e.created_at,
            COALESCE(
                json_agg(ea.file_url ORDER BY ea.uploaded_at)
                FILTER (WHERE ea.id IS NOT NULL),
                '[]'::json
            ) AS receipt_urls
         FROM expenses e
         LEFT JOIN expense_attachments ea ON ea.expense_id = e.id
         WHERE e.shipment_id = $1
         GROUP BY e.id
         ORDER BY e.created_at ASC`,
        [shipmentId],
    );
    return result.rows;
};

// Điều kiện tài xế được sửa/xoá chi phí của chính mình.
//
// Trước đây điều kiện bắt buộc phải có order_receipt_requests ở trạng thái
// 'rejected' VÀ requesting_shipment_id trùng shipment của chi phí. Điều đó chặn
// oan 3 trường hợp:
//   - đơn nhiều chuyến: chi phí của tài chuyến 1 không bao giờ trùng
//     requesting_shipment_id (do tài chuyến cuối gửi phiếu)
//   - đơn không phải cash: không hề có order_receipt_requests ⇒ không bao giờ sửa được
//   - chi phí đã được coord duyệt lẻ: khoá cứng, mà coord cũng không gỡ duyệt được
//
// Quy tắc mới: cứ chi phí của mình mà CHƯA được duyệt thì sửa/xoá được, miễn là
// phiếu thu của đơn chưa chốt (chốt rồi thì số tiền đã thu của khách, không được
// đổi nữa). Chi phí đã duyệt thì phải nhờ coord gỡ duyệt trước.
const DRIVER_EDITABLE_EXPENSE_CONDITION = `
    e.created_by = $2
    AND e.status IN ('pending', 'rejected')
    AND NOT EXISTS (
        SELECT 1
        FROM order_shipments os
        JOIN order_receipt_requests orr ON orr.order_id = os.order_id
        WHERE os.id = e.shipment_id
          -- 'approved'   → phiếu thu đã chốt, tiền đã thu của khách, không đổi số nữa.
          -- 'pending'    → tài đã gửi (hoặc gửi lại) và ĐIỀU PHỐI ĐANG XEM XÉT. Cho sửa
          --                lúc này thì con số điều phối nhìn thấy đổi ngay dưới tay họ:
          --                duyệt theo màn hình cũ mà DB đã là số khác.
          -- 'processing' → điều phối đang xử lý, cùng lý do.
          -- Chỉ 'rejected' mới được sửa — đó đúng là lúc hệ thống YÊU CẦU tài sửa lại.
          AND orr.status IN ('approved', 'pending', 'processing')
    )
`;

const DRIVER_EDIT_DENIED_MESSAGE = 'Không sửa/xoá được: chi phí đã được duyệt (nhờ điều phối gỡ duyệt), '
    + 'hoặc yêu cầu phiếu thu đang chờ điều phối xử lý, hoặc phiếu thu của đơn đã chốt';

// Đơn của chuyến này có yêu cầu phiếu thu đang bị TỪ CHỐI không.
// Dùng để mở lại quyền khai thêm chi phí cho chuyến đã kết thúc: điều phối từ chối
// vì thiếu khoản nào đó thì tài phải bổ sung được.
const hasRejectedReceiptRequest = async (shipmentId) => {
    const result = await pool.query(
        `SELECT 1
         FROM order_shipments os
         JOIN order_receipt_requests orr ON orr.order_id = os.order_id
         WHERE os.id = $1 AND orr.status = 'rejected'
         LIMIT 1`,
        [shipmentId],
    );
    return result.rowCount > 0;
};

const updateExpense = async (expenseId, driverId, { expenseType, amount, description, fileUrl }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const check = await client.query(
            `SELECT e.id
             FROM expenses e
             WHERE e.id = $1
               AND ${DRIVER_EDITABLE_EXPENSE_CONDITION}`,
            [expenseId, driverId],
        );
        if (!check.rows[0]) throw new Error(DRIVER_EDIT_DENIED_MESSAGE);

        // Sửa xong quay về 'pending' để coordinator duyệt lại
        // (nếu giữ 'rejected' thì khoản đã sửa sẽ không bao giờ được tính lại)
        await client.query(
            `UPDATE expenses
             SET expense_type  = COALESCE($1, expense_type),
                 amount        = COALESCE($2, amount),
                 description   = COALESCE($3, description),
                 status        = 'pending',
                 reject_reason = NULL,
                 reviewed_by   = NULL,
                 reviewed_at   = NULL,
                 updated_by    = $4,
                 updated_at    = NOW()
             WHERE id = $5`,
            [expenseType ?? null, amount ? Number(amount) : null, description ?? null, driverId, expenseId],
        );

        if (fileUrl) {
            await client.query(`DELETE FROM expense_attachments WHERE expense_id = $1`, [expenseId]);
            await client.query(
                `INSERT INTO expense_attachments (expense_id, file_url) VALUES ($1, $2)`,
                [expenseId, fileUrl],
            );
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Cùng điều kiện với sửa. expense_attachments tự xoá theo (ON DELETE CASCADE).
const deleteExpense = async (expenseId, driverId) => {
    const result = await pool.query(
        `DELETE FROM expenses e
         WHERE e.id = $1
           AND ${DRIVER_EDITABLE_EXPENSE_CONDITION}
         RETURNING e.id`,
        [expenseId, driverId],
    );
    if (!result.rows[0]) throw new Error(DRIVER_EDIT_DENIED_MESSAGE);
};

const wasDriverAssignedToShipment = async (shipmentId, driverId) => {
    const { rows: [row] } = await pool.query(
        `SELECT 1 FROM shipment_assignment_history
         WHERE shipment_id = $1 AND (to_driver_id = $2 OR from_driver_id = $2)
         LIMIT 1`,
        [shipmentId, driverId],
    );
    return !!row;
};

// Coordinator/Manager duyệt chi phí tài xế khai.
//
// Duyệt = công ty xác nhận nợ tài xế khoản này ⇒ GHI SỔ NGAY (Nợ 3388 chi hộ / Nợ 642
// DN chịu, Có 334 phải trả tài xế), lấy ngày phát sinh là expense_date chứ không phải
// ngày bấm duyệt. Trước đây bút toán chỉ được ghi lúc HOÀN TIỀN, nên khoản không đi qua
// đường hoàn nào (tài xế nghỉ việc, khách CK thẳng nên không có nợ để cấn trừ) thì vĩnh
// viễn vắng mặt trên sổ, còn khoản có hoàn thì rơi sai tháng.
//
// Việc hoàn tiền sau đó chỉ còn là tất toán khoản phải trả (Nợ 334 | Có 1388/1111/1121).
const approveExpense = async (expenseId, reviewerId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [expense] } = await client.query(
            `UPDATE expenses e
             SET status = 'approved', reviewed_by = $2, reviewed_at = NOW(),
                 reimbursement_status = 'pending', updated_at = NOW()
             WHERE e.id = $1 AND e.status = 'pending'
             RETURNING e.id, e.shipment_id, e.expense_type, e.amount, e.expense_date, e.created_by,
                       (SELECT os.status FROM order_shipments os WHERE os.id = e.shipment_id) AS shipment_status`,
            [expenseId, reviewerId],
        );
        if (!expense) throw new Error('Không tìm thấy chi phí hoặc chi phí đã được xử lý');

        await financialLedgerRepository.recordExpenseAccrual(client, {
            expenseId: expense.id,
            expenseType: expense.expense_type,
            shipmentStatus: expense.shipment_status,
            amount: expense.amount,
            actorId: reviewerId,
            occurredAt: expense.expense_date,
        });

        await client.query('COMMIT');
        return expense;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

// Gỡ duyệt — đưa chi phí đã duyệt về 'pending' để tài xế sửa lại.
// Không có nó thì chi phí duyệt sai là bế tắc vĩnh viễn: tài không sửa được
// (đã approved), coord cũng không từ chối được (rejectExpense chỉ chạy trên
// 'pending'). Chặn khi phiếu thu của đơn đã chốt vì lúc đó tiền đã thu của khách.
//
// Chặn thêm khi khoản ĐÃ ĐƯỢC HOÀN (reimbursement_status khác 'pending'): hoàn tiền
// không đổi expenses.status nên nếu chỉ xét status thì một khoản đã trả tiền cho tài xế
// vẫn gỡ duyệt được, rồi duyệt lại là ghi sổ + hoàn LẦN HAI. Với chi phí không gắn chuyến
// (bảo dưỡng) thì mệnh đề NOT EXISTS bên dưới luôn đúng nên không có gì chặn.
//
// Bút toán ghi nhận lúc duyệt được ĐẢO tại đây — không sửa, không xoá dòng gốc.
const unapproveExpense = async (expenseId, reviewerId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: [expense] } = await client.query(
            `UPDATE expenses e
             SET status = 'pending', reviewed_by = $2, reviewed_at = NULL,
                 reject_reason = NULL, reimbursement_status = NULL, updated_at = NOW()
             WHERE e.id = $1
               AND e.status = 'approved'
               AND e.reimbursement_status = 'pending'
               AND NOT EXISTS (
                   SELECT 1
                   FROM order_shipments os
                   JOIN order_receipt_requests orr ON orr.order_id = os.order_id
                   WHERE os.id = e.shipment_id
                     AND orr.status = 'approved'
               )
               -- Đang có phiếu chi hoàn ứng cho khoản này thì KHÔNG được gỡ duyệt: gỡ ra là
               -- reimbursement_status về NULL, phiếu kẹt cứng (lúc chi tìm 'pending' không thấy
               -- nên báo lỗi mãi, chỉ còn nước huỷ phiếu). Tệ hơn: nếu chi phí được sửa số tiền
               -- rồi duyệt lại, phiếu cũ vẫn giữ số cũ và sẽ chi sai số. Kế toán phải huỷ phiếu
               -- trước rồi mới gỡ duyệt được.
               --
               -- Điều kiện này KHÔNG thừa so với reimbursement_status = 'pending' ở trên:
               -- trong lúc phiếu chi chờ manager duyệt, khoản vẫn mang 'pending' nên vế kia
               -- cho qua. Ngược lại, khoản hoàn thẳng qua lương thì không sinh phiếu nào nên
               -- vế kia mới là cái chặn. Hai vế bịt hai lối khác nhau, phải giữ cả hai.
               AND ${NO_LIVE_REIMBURSEMENT_VOUCHER_SQL('e')}
             RETURNING e.id, e.shipment_id, e.expense_type, e.amount, e.created_by`,
            [expenseId, reviewerId],
        );
        if (!expense) {
            await client.query('ROLLBACK');
            return null;
        }

        await financialLedgerRepository.reverseExpenseAccrual(client, {
            expenseId: expense.id,
            reason: 'Gỡ duyệt chi phí — khoản quay lại chờ tài xế khai lại',
            actorId: reviewerId,
        });

        await client.query('COMMIT');
        return expense;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

const rejectExpense = async (expenseId, reviewerId, reason) => {
    const { rows: [expense] } = await pool.query(
        `UPDATE expenses
         SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW(),
             reject_reason = $3, updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id, shipment_id, expense_type, amount, created_by`,
        [expenseId, reviewerId, reason ?? null],
    );
    return expense;
};

// sort resolved via allowlist, never interpolated directly from user input
const EXPENSE_SORTS = {
    oldest:        'e.created_at ASC',
    'amount-desc': 'e.amount DESC',
    'amount-asc':  'e.amount ASC',
    status:        'e.status ASC, e.created_at DESC',
};

// Danh sách chi phí toàn hệ thống cho web Manager (duyệt) / Accountant (đối chiếu)
const listAllExpenses = async ({ status, expenseType, reimbursementStatus, month, year, search, sort, page, limit } = {}) => {
    const conds  = [];
    const params = [];
    let   i      = 1;

    if (status)      { conds.push(`e.status = $${i++}`);       params.push(status); }
    if (reimbursementStatus) { conds.push(`e.reimbursement_status = $${i++}`); params.push(reimbursementStatus); }
    if (expenseType) { conds.push(`e.expense_type = $${i++}`); params.push(expenseType); }
    if (month)       { conds.push(`EXTRACT(MONTH FROM e.expense_date) = $${i++}`); params.push(Number(month)); }
    if (year)        { conds.push(`EXTRACT(YEAR  FROM e.expense_date) = $${i++}`); params.push(Number(year)); }
    if (search) {
        conds.push(`(p.full_name ILIKE $${i} OR v.plate_number ILIKE $${i} OR e.description ILIKE $${i})`);
        params.push(`%${search}%`);
        i++;
    }

    const where       = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const orderClause = EXPENSE_SORTS[sort] ?? 'e.created_at DESC';
    const safeLimit   = Math.min(100, Math.max(1, Number(limit) || 20));
    const safePage    = Math.max(1, Number(page) || 1);
    const offset      = (safePage - 1) * safeLimit;

    // Cột "Tài xế" phải là người THỰC SỰ chịu/ứng chi phí, không phải người tạo phiếu:
    //   - chi phí theo chuyến  → tài xế giữ chuyến (v_shipment_current.owner_driver_id)
    //   - chi phí bảo dưỡng    → tài xế thực hiện (maintenance_records.performed_by)
    //   - còn lại              → người tạo (e.created_by)
    // Khớp đúng cách hoàn ứng quy chủ trong bảng lương (accountantPayrollRepository).
    const baseFrom = `
        FROM expenses e
        LEFT JOIN v_shipment_current sc ON sc.shipment_id = e.shipment_id
        LEFT JOIN maintenance_records mr ON mr.expense_id = e.id
        JOIN profiles p        ON p.id = COALESCE(sc.owner_driver_id, mr.performed_by, e.created_by)
        LEFT JOIN vehicles v   ON v.id = e.vehicle_id
        LEFT JOIN profiles rev ON rev.id = e.reviewed_by
    `;

    const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(
            `SELECT
                e.id, e.shipment_id, e.expense_type, e.amount::text, e.description,
                e.expense_date, e.status, e.reject_reason, e.reviewed_at, e.created_at,
                e.reimbursement_status, e.reimbursed_at,
                p.full_name      AS driver_name,
                p.phone          AS driver_phone,
                v.plate_number   AS vehicle_plate,
                rev.full_name    AS reviewed_by_name,
                COALESCE(
                    (SELECT json_agg(ea.file_url ORDER BY ea.uploaded_at)
                     FROM expense_attachments ea WHERE ea.expense_id = e.id),
                    '[]'::json
                ) AS receipt_urls
             ${baseFrom} ${where}
             ORDER BY ${orderClause}
             LIMIT $${i} OFFSET $${i + 1}`,
            [...params, safeLimit, offset],
        ),
        pool.query(`SELECT COUNT(*)::int AS total ${baseFrom} ${where}`, params),
    ]);

    return {
        rows,
        total: countRows[0]?.total ?? 0,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil((countRows[0]?.total ?? 0) / safeLimit)),
    };
};

const getExpenseStats = async ({ month, year } = {}) => {
    const conds  = [];
    const params = [];
    let   i      = 1;
    if (month) { conds.push(`EXTRACT(MONTH FROM expense_date) = $${i++}`); params.push(Number(month)); }
    if (year)  { conds.push(`EXTRACT(YEAR  FROM expense_date) = $${i++}`); params.push(Number(year)); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows: [row] } = await pool.query(
        `SELECT
             COUNT(*)::int                                                     AS total_count,
             COUNT(*) FILTER (WHERE status = 'pending')::int                   AS pending_count,
             COUNT(*) FILTER (WHERE status = 'approved')::int                  AS approved_count,
             COUNT(*) FILTER (WHERE status = 'rejected')::int                  AS rejected_count,
             COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::text AS approved_total,
             COALESCE(SUM(amount) FILTER (WHERE status = 'approved' AND reimbursement_status = 'pending'), 0)::text AS reimbursable_total
         FROM expenses ${where}`,
        params,
    );
    return row;
};

module.exports = {
    hasRejectedReceiptRequest,
    createExpense, addExpenseAttachment, getShipmentExpenses, updateExpense, deleteExpense,
    wasDriverAssignedToShipment, approveExpense, rejectExpense, unapproveExpense,
    listAllExpenses, getExpenseStats,
};
