-- Cơ chế fallback khi khoản đền bù không được duyệt.
-- Chạy script này trên DB đang có sẵn; DB tạo mới từ "DB script.sql" đã bao gồm các thay đổi này.
-- An toàn khi chạy lại nhiều lần.

BEGIN;

-- Liên kết phiếu chi đền bù về đúng sự cố đã sinh ra nó.
-- Trước đây chỉ có chuỗi text "sự cố #123" trong cột reason nên không truy ngược được.
ALTER TABLE payment_vouchers
    ADD COLUMN IF NOT EXISTS incident_id INT REFERENCES incidents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_vouchers_incident
    ON payment_vouchers(incident_id) WHERE incident_id IS NOT NULL;

-- Tách bạch "sự cố đã xử lý xong" khỏi "khoản đền bù đã được duyệt chưa".
ALTER TABLE incidents
    ADD COLUMN IF NOT EXISTS compensation_status TEXT NOT NULL DEFAULT 'none';

ALTER TABLE incidents
    DROP CONSTRAINT IF EXISTS incidents_compensation_status_check;

ALTER TABLE incidents
    ADD CONSTRAINT incidents_compensation_status_check
    CHECK (compensation_status IN ('none','pending','approved','rejected','paid','cancelled'));

-- Kế toán huỷ phiếu đã duyệt nhưng chưa chi. Giữ lại phiếu kèm người huỷ + lý do,
-- không xoá, để vẫn quy trách nhiệm được.
ALTER TABLE payment_vouchers
    ADD COLUMN IF NOT EXISTS cancelled_by        INT REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE payment_vouchers
    DROP CONSTRAINT IF EXISTS payment_vouchers_status_check;

ALTER TABLE payment_vouchers
    ADD CONSTRAINT payment_vouchers_status_check
    CHECK (status IN ('pending','approved','rejected','paid','cancelled'));

-- Vá dữ liệu cũ: các phiếu đền bù đã tạo trước đây chỉ nhận diện được qua cột reason.
UPDATE payment_vouchers pv
SET incident_id = sub.incident_id
FROM (
    SELECT id,
           NULLIF(substring(reason FROM 'sự cố #(\d+)'), '')::int AS incident_id
    FROM payment_vouchers
    WHERE voucher_type = 'compensation' AND incident_id IS NULL
) sub
WHERE pv.id = sub.id
  AND sub.incident_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM incidents i WHERE i.id = sub.incident_id);

-- Đồng bộ cờ trên sự cố theo phiếu đền bù mới nhất của nó.
UPDATE incidents i
SET compensation_status = cv.status
FROM (
    SELECT DISTINCT ON (incident_id) incident_id, status
    FROM payment_vouchers
    WHERE incident_id IS NOT NULL
    ORDER BY incident_id, created_at DESC
) cv
WHERE i.id = cv.incident_id;

COMMIT;
