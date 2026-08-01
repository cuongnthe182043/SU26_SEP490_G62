-- =====================================================================
-- 20260730_return_flow
-- Luồng hoàn hàng: điều phối quyết định giao lại / hoàn hàng sau khi tài
-- báo giao thất bại. Cần lưu ai quyết định và quyết định lúc nào.
--
-- An toàn với dữ liệu cũ: chỉ THÊM cột (IF NOT EXISTS), không sửa/xoá dòng nào.
-- Chạy lại nhiều lần không sao (idempotent).
-- =====================================================================

BEGIN;

ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS returning_at       TIMESTAMPTZ;
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS failed_resolved_by INT REFERENCES profiles(id);
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS failed_resolved_at TIMESTAMPTZ;

INSERT INTO schema_migrations (filename)
VALUES ('20260730_return_flow.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
