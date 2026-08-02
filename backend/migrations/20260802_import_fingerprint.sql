-- =====================================================================
-- 20260802_import_fingerprint
-- Chống import trùng cho luồng "Kế toán nhập đơn ngoài từ Excel".
--
-- Vì sao cần: import lại cùng một file lần thứ hai (bấm nhầm hai lần, tải lại
-- trang sau khi request timeout, gửi lại file đã gửi tuần trước) tạo lại toàn bộ
-- đơn — doanh thu nhân đôi, KPI nhân đôi, công nợ nhân đôi. Không có bất cứ cơ chế
-- nào phát hiện, và sai kiểu này rất khó lần ra vì mọi dòng đều "hợp lệ".
--
-- Cách làm: mỗi dòng Excel sinh ra 1 order kèm một dấu vân tay tính từ chính nội
-- dung nghiệp vụ của dòng (ngày chạy + xe + tài + tuyến + cước + hình thức thanh
-- toán + khách + số lượt). Trùng vân tay = trùng dòng.
--
-- UNIQUE có điều kiện (WHERE NOT NULL) để:
--   * đơn nhập tay và đơn cũ (fingerprint NULL) không bị ràng buộc gì;
--   * kế toán vẫn ép nhập được dòng trùng thật (khi đó ghi NULL, không chặn nữa).
--
-- An toàn với dữ liệu cũ: chỉ THÊM cột nullable + index. Đơn đã có giữ nguyên
-- fingerprint NULL nên không dòng nào bị chặn ngược. Chạy lại nhiều lần không sao.
-- =====================================================================

BEGIN;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS import_fingerprint TEXT;

COMMENT ON COLUMN orders.import_fingerprint IS
    'Vân tay dòng Excel đã import (SHA-256). NULL = nhập tay hoặc kế toán chủ động cho phép trùng.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_import_fingerprint
    ON orders (import_fingerprint)
    WHERE import_fingerprint IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260802_import_fingerprint.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
