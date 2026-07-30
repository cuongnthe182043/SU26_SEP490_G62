-- 2026-07-30 — Quy trình hoàn hàng có coordinator quyết định (commit c978349)
--
-- BỔ SUNG MUỘN: commit c978349 đã thêm 4 cột này vào DB script.sql nhưng KHÔNG
-- tạo file migration, nên các DB đang chạy không có đường cập nhật và sẽ lỗi
-- "column return_charge_type does not exist" khi coordinator xử lý chuyến giao
-- thất bại. File này bù lại phần đó.
--
-- Chạy:
--   docker exec -i <db> psql -U postgres -d SEP490 -v ON_ERROR_STOP=1 \
--     < "DB script/migrations/20260730_return_flow.sql"

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cách tính tiền khách khi chuyến phải hoàn hàng — coordinator chốt theo từng ca
-- vì lỗi có thể từ phía khách (từ chối nhận) hoặc phía doanh nghiệp.
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS return_charge_type TEXT;
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS return_fee         NUMERIC(12,2);
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS failed_resolved_by INT;
ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS failed_resolved_at TIMESTAMPTZ;

-- ADD CONSTRAINT không có IF NOT EXISTS → phải tự kiểm tra để chạy lại được
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'order_shipments_return_charge_type_check') THEN
        ALTER TABLE order_shipments
            ADD CONSTRAINT order_shipments_return_charge_type_check
            CHECK (return_charge_type IN ('no_charge', 'return_fee', 'full_fare'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'order_shipments_return_fee_check') THEN
        ALTER TABLE order_shipments
            ADD CONSTRAINT order_shipments_return_fee_check
            CHECK (return_fee IS NULL OR return_fee >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'order_shipments_failed_resolved_by_fkey') THEN
        ALTER TABLE order_shipments
            ADD CONSTRAINT order_shipments_failed_resolved_by_fkey
            FOREIGN KEY (failed_resolved_by) REFERENCES profiles(id);
    END IF;
END $$;

-- 4 cột đều cho phép NULL: chuyến cũ chưa từng hoàn hàng nên để trống là đúng,
-- không cần backfill. computeReceiptAmount chỉ xét nhánh hoàn hàng khi
-- returning_at IS NOT NULL, nên dữ liệu cũ không bị ảnh hưởng.

INSERT INTO schema_migrations (filename) VALUES ('20260730_return_flow.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
