-- ============================================================================
-- Migration: Hoàn tiền khách ứng trước khi hủy đơn (prepaid_refund)
-- ----------------------------------------------------------------------------
-- Chạy 1 lần trên DB ĐANG CÓ SẴN (không cần nếu tạo DB mới từ "DB script.sql").
-- An toàn chạy lại nhiều lần (idempotent).
--
-- Nội dung:
--   1) Thêm loại voucher 'prepaid_refund' vào ràng buộc voucher_type.
--   2) Thêm cột order_id để gắn phiếu hoàn tiền với đơn bị hủy.
--   3) Index cho order_id.
-- (Event 'prepaid_refunded' của financial_transactions đã có sẵn từ trước — không cần sửa.)
-- ============================================================================

BEGIN;

-- 1) Cho phép voucher_type = 'prepaid_refund'
ALTER TABLE payment_vouchers
    DROP CONSTRAINT IF EXISTS payment_vouchers_voucher_type_check;

ALTER TABLE payment_vouchers
    ADD CONSTRAINT payment_vouchers_voucher_type_check
    CHECK (voucher_type IN (
        'office', 'rent', 'utilities', 'equipment',
        'entertainment', 'compensation', 'prepaid_refund', 'other'
    ));

-- 2) Cột order_id (phiếu hoàn tiền ứng trước ← đơn bị hủy)
ALTER TABLE payment_vouchers
    ADD COLUMN IF NOT EXISTS order_id INT REFERENCES orders(id) ON DELETE SET NULL;

-- 3) Index
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_order
    ON payment_vouchers(order_id) WHERE order_id IS NOT NULL;

COMMIT;
