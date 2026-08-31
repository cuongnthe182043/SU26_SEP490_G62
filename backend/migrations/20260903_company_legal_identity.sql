-- =====================================================================
-- 20260903_company_legal_identity
-- Bổ sung mã số thuế + địa chỉ trụ sở vào company_info.
--
-- Vì sao cần: mọi biểu mẫu kế toán Việt Nam đều bắt đầu bằng khối định danh đơn vị ở
-- góc trên trái — "Đơn vị: ...", "Địa chỉ: ..." — và mã số thuế là thứ cơ quan thuế
-- dùng để đối chiếu. Bảng company_info hiện chỉ có tên và hotline, nên file Excel xuất
-- ra không có cách nào điền đúng khối đó; sổ sách in ra thiếu định danh đơn vị thì
-- không dùng để nộp hay lưu trữ được.
--
-- An toàn với dữ liệu cũ: hai cột đều nullable, không DEFAULT, không đụng dòng đang có.
-- Biểu mẫu để trống các dòng này nếu chưa ai nhập — không chặn xuất file.
-- =====================================================================

BEGIN;

ALTER TABLE company_info ADD COLUMN IF NOT EXISTS tax_code TEXT;
ALTER TABLE company_info ADD COLUMN IF NOT EXISTS address  TEXT;

COMMENT ON COLUMN company_info.tax_code IS 'Mã số thuế — in ở khối định danh đơn vị trên mọi biểu mẫu xuất ra';
COMMENT ON COLUMN company_info.address  IS 'Địa chỉ trụ sở — in ở khối định danh đơn vị trên mọi biểu mẫu xuất ra';

INSERT INTO schema_migrations (filename)
VALUES ('20260903_company_legal_identity.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
