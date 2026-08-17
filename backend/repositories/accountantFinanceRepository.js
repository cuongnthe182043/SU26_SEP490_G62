const pool = require('../config/database');

const getFinanceStats = async () => {

    const query = `
        WITH order_stats AS (
            SELECT
                o.id,
                COALESCE(ship_sum.actual_price, 0)      AS actual_price,
                COALESCE(cust.remaining, 0)             AS customer_remaining,
                COALESCE(drv.remaining, 0)              AS driver_remaining,
                COALESCE(pending.receipt_remaining, 0)  AS pending_receipt_remaining,
                -- Tiền THỰC đã về công ty của đơn này = tiền ứng trước đã xác nhận
                -- + các khoản tất toán công nợ (đã lọc phần tài giữ lại để bù chi hộ)
                -- + khách chuyển khoản thẳng đã được kế toán xác nhận.
                CASE WHEN o.prepaid_status = 'confirmed'
                     THEN COALESCE(o.prepaid_amount, 0) ELSE 0 END
                  + COALESCE(settled.settled, 0)
                  + COALESCE(bank.bank_received, 0)     AS cash_in
            FROM orders o
            LEFT JOIN (
                SELECT order_id, COALESCE(SUM(actual_price), 0) AS actual_price
                FROM order_shipments
                GROUP BY order_id
            ) ship_sum ON ship_sum.order_id = o.id
            LEFT JOIN (
                SELECT d.order_id,
                       GREATEST(
                           SUM(d.total_amount)
                           - COALESCE(SUM(dp_agg.paid), 0),
                           0
                       ) AS remaining
                FROM debts d
                LEFT JOIN (
                    SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
                    FROM debt_payments
                    GROUP BY debt_id
                ) dp_agg ON dp_agg.debt_id = d.id
                WHERE d.debt_type = 'customer'
                GROUP BY d.order_id
            ) cust ON cust.order_id = o.id
            LEFT JOIN (
                SELECT d.order_id,
                       GREATEST(
                           SUM(d.total_amount)
                           - COALESCE(SUM(dp_agg.paid), 0),
                           0
                       ) AS remaining
                FROM debts d
                LEFT JOIN (
                    SELECT debt_id, COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS paid
                    FROM debt_payments
                    GROUP BY debt_id
                ) dp_agg ON dp_agg.debt_id = d.id
                WHERE d.debt_type = 'driver'
                GROUP BY d.order_id
            ) drv ON drv.order_id = o.id
            LEFT JOIN (
                SELECT rr.order_id,
                       COALESCE(SUM(sr.amount), 0) AS receipt_remaining
                FROM shipment_receipts sr
                JOIN order_receipt_requests rr ON rr.id = sr.order_receipt_request_id
                WHERE sr.payment_type IS NULL
                GROUP BY rr.order_id
            ) pending ON pending.order_id = o.id
            -- TIỀN THỰC VÀO CÔNG TY (nguồn 1/2): các khoản tất toán công nợ đã xác nhận —
            -- tài nộp tiền thu hộ, khách trả nợ, và cấn trừ công nợ vào lương (công ty giữ
            -- lại lương thay vì chi ra ⇒ vẫn là thu hồi được thật).
            --
            -- LOẠI TRỪ dòng "cấn trừ chi phí tài đã ứng": khi khách trả tiền mặt, phần chi hộ
            -- (cầu đường/bến bãi tài đã bỏ tiền túi) được tài GIỮ LẠI luôn để bù khoản đã ứng.
            -- Tiền đó đi thẳng từ khách sang tài, KHÔNG hề chảy về công ty — cộng vào "đã thu
            -- về" là báo công ty đã nhận một khoản chưa từng nhận.
            -- Nhận diện: recordReceiptCollection ghi created_by = chính tài xế mắc nợ; còn cấn
            -- trừ vào lương do KẾ TOÁN ghi (created_by khác driver_id) nên không dính bộ lọc.
            LEFT JOIN (
                SELECT d.order_id, COALESCE(SUM(dp.amount), 0) AS settled
                FROM debts d
                JOIN debt_payments dp ON dp.debt_id = d.id
                WHERE dp.status = 'confirmed'
                  AND NOT (dp.payment_method = 'offset' AND dp.created_by = d.driver_id)
                GROUP BY d.order_id
            ) settled ON settled.order_id = o.id
            -- TIỀN THỰC VÀO CÔNG TY (nguồn 2/2): khách chuyển khoản thẳng về tài khoản công ty
            -- và KẾ TOÁN đã xác nhận tiền về (ghi sổ Nợ 1121). Luồng này không sinh công nợ nên
            -- không nằm trong nguồn 1.
            LEFT JOIN (
                SELECT os_ft.order_id, COALESCE(SUM(ft.amount), 0) AS bank_received
                FROM financial_transactions ft
                JOIN order_shipments os_ft ON os_ft.id = ft.ref_id
                WHERE ft.event_type = 'bank_receipt'
                  AND ft.ref_type   = 'shipment'
                GROUP BY os_ft.order_id
            ) bank ON bank.order_id = o.id
            WHERE o.derived_status = 'completed'
        )
        SELECT
            SUM(actual_price)::numeric AS total_gross_revenue,
            -- "Đã thu về" = TIỀN THỰC công ty đã nhận, KHÔNG suy ra bằng phép trừ
            -- (collectible − còn nợ). Cách trừ cũ coi phần chi hộ mà tài tự giữ lại là đã
            -- thu: đơn 350k (300k cước + 50k chi hộ tài ứng), tài giữ hết tiền chưa nộp
            -- đồng nào, nợ còn 300k ⇒ 350−300 = 50k bị tính là "đã thu về" trong khi công
            -- ty chưa nhận gì. Đếm thẳng dòng tiền vào thì mọi kiểu tất toán đều đúng.
            SUM(cash_in)::numeric AS total_revenue,
            SUM(cash_in)::numeric AS total_collected,
            (SUM(customer_remaining) + SUM(driver_remaining) + SUM(pending_receipt_remaining))::numeric AS total_receivables,
            COUNT(*) FILTER (
                WHERE customer_remaining + driver_remaining + pending_receipt_remaining > 0.01
            )::int AS pending_payments_count
        FROM order_stats
    `;
    // Tiền tài xế đã ứng túi (chi hộ khách/chi phí công ty) chờ công ty hoàn lại —
    // đã duyệt nhưng chưa cấn trừ nợ (TH2) và chưa hoàn qua lương (TH1).
    //
    // Vẫn tính cả khoản đã lập phiếu chi hoàn ứng nhưng CHƯA chi xong: phiếu mới nằm chờ
    // duyệt thì tiền chưa ra khỏi quỹ, công ty vẫn đang nợ tài. Nhưng tách riêng con số đó
    // ra (in_progress) để màn hình nói rõ "trong đó bao nhiêu đang chạy phiếu" — không thì
    // card và màn Hoàn ứng tài xế hiện hai số khác nhau mà không ai hiểu vì sao (màn kia cố
    // ý ẩn khoản đã có phiếu để khỏi lập trùng).
    const reimbursableQuery = `
        SELECT
            COALESCE(SUM(amount), 0)::numeric AS total_reimbursable,
            COALESCE(SUM(amount) FILTER (WHERE EXISTS (
                SELECT 1 FROM payment_vouchers pv
                WHERE pv.expense_id = e.id AND pv.status IN ('pending', 'approved')
            )), 0)::numeric AS total_reimbursable_in_progress
        FROM expenses e
        WHERE status = 'approved' AND reimbursement_status = 'pending'
    `;

    const [result, reimbResult] = await Promise.all([
        pool.query(query),
        pool.query(reimbursableQuery),
    ]);
    const row = result.rows[0];
    return {
        total_gross_revenue:    Number(row.total_gross_revenue)    || 0,
        total_revenue:          Number(row.total_revenue)          || 0,
        total_collected:        Number(row.total_collected)        || 0,
        total_receivables:      Number(row.total_receivables)      || 0,
        pending_payments_count: Number(row.pending_payments_count) || 0,
        total_reimbursable:     Number(reimbResult.rows[0].total_reimbursable) || 0,
        total_reimbursable_in_progress:
                                Number(reimbResult.rows[0].total_reimbursable_in_progress) || 0,
    };
};

module.exports = {
    getFinanceStats,
};
