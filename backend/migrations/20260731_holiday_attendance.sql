-- =====================================================================
-- 20260731_holiday_attendance
--
-- 1. Chấm công ngày lễ: cho phép đánh dấu "đi làm ngày lễ" (200% lương,
--    Điều V.1 chính sách lương).
-- 2. Dọn 2 cột chết của luồng hoàn hàng cũ: hoàn hàng giờ luôn tính gấp
--    đôi cước nên không còn lựa chọn tiền nào để lưu.
--
-- An toàn với dữ liệu cũ: nới CHECK không đụng dòng nào; 2 cột bị xoá
-- không còn code nào đọc/ghi. Chạy lại nhiều lần không sao (idempotent).
-- =====================================================================

BEGIN;

-- 1. Trạng thái chấm công mới
ALTER TABLE attendance_overrides
    DROP CONSTRAINT IF EXISTS attendance_overrides_status_check;

ALTER TABLE attendance_overrides
    ADD CONSTRAINT attendance_overrides_status_check
    CHECK (status IN ('present', 'absent_unexcused', 'half_day', 'holiday_worked'));

-- 2. Dọn cột chết của luồng hoàn hàng cũ
ALTER TABLE order_shipments DROP COLUMN IF EXISTS return_charge_type;
ALTER TABLE order_shipments DROP COLUMN IF EXISTS return_fee;

INSERT INTO schema_migrations (filename)
VALUES ('20260731_holiday_attendance.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
