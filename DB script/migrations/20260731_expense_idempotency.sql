-- =====================================================================
-- 20260731_expense_idempotency
-- Khoá chống trùng cho khai chi phí (app tài xế gửi lại khi có mạng).
--
-- Vì sao cần: app có hàng đợi offline — mất sóng thì lưu thao tác lại rồi tự gửi
-- lại lúc có mạng. Các luồng khác đã được máy trạng thái chặn trùng (nhận chuyến,
-- hoàn thành, gửi phiếu thu...), riêng khai chi phí không có gì chặn: gửi lại 2 lần
-- là ra 2 bản ghi chi phí, tài xế được hoàn tiền gấp đôi.
--
-- An toàn với dữ liệu cũ: chỉ THÊM một cột nullable + ràng buộc UNIQUE. Bản ghi cũ
-- có giá trị NULL, mà UNIQUE trong Postgres KHÔNG chặn nhiều dòng NULL nên không
-- ảnh hưởng gì. Chạy lại nhiều lần không sao (idempotent).
-- =====================================================================

BEGIN;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS client_request_id TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'expenses_client_request_id_key'
    ) THEN
        ALTER TABLE expenses ADD CONSTRAINT expenses_client_request_id_key UNIQUE (client_request_id);
    END IF;
END $$;

INSERT INTO schema_migrations (filename)
VALUES ('20260731_expense_idempotency.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
