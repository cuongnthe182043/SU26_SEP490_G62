-- =====================================================================
-- 20260802_customer_name_lookup
-- Index tra khách hàng theo TÊN đã chuẩn hoá.
--
-- Vì sao cần: import đơn ngoài giờ cho phép chỉ điền tên HOẶC SĐT. Dòng không có SĐT
-- được khớp khách theo tên, nên mỗi dòng Excel sinh một lượt tra theo tên — file 1000
-- dòng là 1000 lượt quét toàn bảng customers nếu không có index.
--
-- Biểu thức phải TRÙNG KHÍT với tenKhachChuanSql() trong accountantOrderRepository.js,
-- nếu lệch một ký tự thì Postgres không dùng index và câu lệnh âm thầm chậm lại.
--
-- An toàn với dữ liệu cũ: chỉ THÊM index, không đụng dữ liệu. Chạy lại nhiều lần không sao.
-- =====================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_customers_ten_chuan
    ON customers (lower(regexp_replace(btrim(COALESCE(full_name, company_name, '')), '\s+', ' ', 'g')));

INSERT INTO schema_migrations (filename)
VALUES ('20260802_customer_name_lookup.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
