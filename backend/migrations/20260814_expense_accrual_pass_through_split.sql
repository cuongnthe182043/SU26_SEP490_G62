-- Hai sửa đổi kế toán đi liền nhau: tách vế chi hộ tại bút toán tiền về, và ghi nhận
-- chi phí tài xế ứng túi ngay khi duyệt thay vì đợi lúc hoàn tiền.
--
-- Vì sao phải đi cùng nhau: chi hộ được ghi Nợ 3388 lúc duyệt chi phí và phải được ghi
-- Có 3388 lúc khách trả tiền. Sửa một vế mà để vế kia nguyên thì 3388 lệch theo chiều
-- ngược lại, không khá hơn trạng thái cũ.
--
-- Trước đây:
--   duyệt chi phí        → KHÔNG ghi sổ
--   hoàn tiền cho tài xế → Nợ 3388/642 | Có 1388 (cấn trừ nợ) hoặc Có 334 (qua lương)
--                          hoặc Có 1111/1121 (phiếu chi)
--   khách trả tiền       → Có 131 TOÀN BỘ (gồm cả phần chi hộ)
--
-- Từ nay:
--   duyệt chi phí        → Nợ 3388 (chi hộ) hoặc Nợ 642 (DN chịu) | Có 334
--   hoàn tiền cho tài xế → Nợ 334 | Có 1388 / 1111 / 1121  (chỉ là tất toán khoản phải trả,
--                          không còn là lúc ghi nhận chi phí)
--   khách trả tiền       → Có 3388 phần chi hộ + Có 131 phần cước (hai dòng riêng)

BEGIN;

-- 'expense_reimbursed': chi tiền hoàn ứng cho tài xế qua phiếu chi (Nợ 334 | Có 1111/1121).
-- Cần một loại riêng vì đây KHÔNG còn là lúc ghi nhận chi phí — chi phí đã vào sổ từ lúc
-- duyệt. Dùng lại 'expense_recorded' cho bước này sẽ đội chi phí lên gấp đôi trên báo cáo.
ALTER TABLE financial_transactions DROP CONSTRAINT IF EXISTS financial_transactions_event_type_check;
ALTER TABLE financial_transactions ADD CONSTRAINT financial_transactions_event_type_check
    CHECK (event_type IN (
        'shipment_revenue',
        'prepaid_received',
        'prepaid_refunded',
        'cash_receipt',
        'bank_receipt',
        'driver_debt_created',
        'driver_debt_paid',
        'customer_debt_created',
        'customer_payment',
        'pass_through_cost',
        'expense_recorded',
        'expense_reimbursed',
        'payroll_paid',
        'bonus_paid',
        'advance_disbursed',
        'advance_recovered',
        'debt_transferred',
        'opening_balance'
    ));

-- Tra "chi hộ của đơn này đã thu được bao nhiêu" chạy trên MỌI lần tiền khách về, lọc theo
-- tài khoản 3388. Không có index thì mỗi lần thu tiền là một lần quét toàn bảng sổ.
CREATE INDEX IF NOT EXISTS idx_ftx_pass_through_settlement
    ON financial_transactions(ref_type, ref_id)
    WHERE credit_account = '3388' OR debit_account = '3388';

INSERT INTO schema_migrations (filename)
VALUES ('20260814_expense_accrual_pass_through_split.sql')
ON CONFLICT DO NOTHING;

COMMIT;
