-- ============================================================================
-- Migration: Xác nhận tiền trả trước (prepaid) trước khi ghi sổ
-- ----------------------------------------------------------------------------
-- Chạy 1 lần trên DB ĐANG CÓ SẴN (không cần nếu tạo DB mới từ "DB script.sql").
-- An toàn chạy lại nhiều lần (idempotent).
--
-- Bối cảnh: trước đây, khi coordinator nhập "khách trả trước X đồng" lúc tạo
-- đơn, hệ thống ghi NGAY bút toán prepaid_received (Nợ 1121/Có 131) — coi như
-- tiền đã về ngân hàng, dù thực tế coordinator chỉ đang GÕ SỐ, chưa có ai xác
-- nhận tiền thật sự về hay đi kênh nào (tiền mặt/CK). Điều này gây rủi ro mất
-- tiền khi hủy đơn (hoàn tiền thật cho một khoản chưa chắc đã thu).
--
-- Từ nay: prepaid có 3 trạng thái — none / pending / confirmed. Chỉ khi Kế
-- toán hoặc Điều phối XÁC NHẬN (chọn kênh + đính chứng từ) thì mới ghi sổ.
-- ============================================================================

BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS prepaid_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_prepaid_status_check;
ALTER TABLE orders
    ADD CONSTRAINT orders_prepaid_status_check
    CHECK (prepaid_status IN ('none', 'pending', 'confirmed'));

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS prepaid_method TEXT;
ALTER TABLE orders
    DROP CONSTRAINT IF EXISTS orders_prepaid_method_check;
ALTER TABLE orders
    ADD CONSTRAINT orders_prepaid_method_check
    CHECK (prepaid_method IN ('cash', 'bank_transfer') OR prepaid_method IS NULL);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS prepaid_proof_url TEXT;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS prepaid_confirmed_by INT REFERENCES profiles(id);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS prepaid_confirmed_at TIMESTAMPTZ;

-- Dữ liệu cũ: các đơn đã có prepaid_amount > 0 từ trước migration này đã được
-- ghi sổ ngay lúc tạo (theo hành vi cũ) → coi như đã "confirmed" để không phá
-- vỡ đối soát sổ sách đã ghi trước đây. Đơn mới tạo SAU migration mới đi qua
-- luồng pending → xác nhận.
UPDATE orders
SET prepaid_status = 'confirmed',
    prepaid_method = 'bank_transfer',
    prepaid_confirmed_at = COALESCE(prepaid_confirmed_at, created_at)
WHERE prepaid_amount > 0
  AND prepaid_status = 'none';

COMMIT;
