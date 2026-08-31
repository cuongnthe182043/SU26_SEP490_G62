-- =====================================================================
-- 20260831_receipt_duplicate_keys
-- Khoá nhận dạng hóa đơn, để chặn việc dùng LẠI một hóa đơn.
--
-- Băm ảnh (image_sha256) chỉ bắt được đúng một tấm file gửi lại hai lần. Chụp lại cùng
-- tờ hóa đơn từ góc khác là ra file khác, băm khác — vẫn lọt. Muốn chặn được thì phải
-- nhận dạng theo NỘI DUNG tờ hóa đơn, và cặp (đơn vị bán, số hóa đơn) chính là thứ
-- định danh nó.
--
-- Hai cột này rút từ raw_extraction ra thành cột riêng thay vì truy vấn thẳng JSONB:
-- việc dò trùng chạy trên mọi lần upload nên cần index, mà index trên biểu thức JSONB
-- lồng nhau thì vừa khó đọc vừa dễ hỏng khi đổi hình dạng JSON.
--
-- CỐ Ý KHÔNG đặt ràng buộc UNIQUE: một hóa đơn hoàn toàn có thể được đọc nhiều lần hợp
-- lệ (tài xế chụp lại vì ảnh mờ, hoặc chính đợt bảo dưỡng đó quét lại). Việc phân biệt
-- "đọc lại của cùng một đợt" với "dùng cho đợt khác" là luật nghiệp vụ, thuộc về code
-- chứ không thuộc về ràng buộc DB — đẩy vào UNIQUE thì lần chụp lại hợp lệ sẽ vỡ ở
-- tầng insert, không còn chỗ nào giải thích cho người dùng.
--
-- An toàn với dữ liệu cũ: thêm cột nullable, dòng đã có giữ nguyên NULL và bị bỏ qua
-- khi dò trùng (điều kiện dò luôn yêu cầu khoá khác NULL).
-- =====================================================================

BEGIN;

ALTER TABLE receipt_extractions
    ADD COLUMN IF NOT EXISTS vendor_key     TEXT,
    ADD COLUMN IF NOT EXISTS invoice_no_key TEXT;

COMMENT ON COLUMN receipt_extractions.vendor_key IS
    'Định danh bên bán đã chuẩn hoá: ưu tiên mã số thuế, không có thì tên đã bỏ dấu/chữ thường.';
COMMENT ON COLUMN receipt_extractions.invoice_no_key IS
    'Số hóa đơn đã chuẩn hoá (chỉ chữ và số, viết hoa). NULL khi hóa đơn không ghi số.';

-- Chỉ đánh index phần có đủ khoá — hóa đơn viết tay không có số hóa đơn thì cặp
-- (bên bán, số) không định danh được gì, đưa vào index chỉ tổ phình.
CREATE INDEX IF NOT EXISTS idx_receipt_extractions_invoice_identity
    ON receipt_extractions (vendor_key, invoice_no_key)
    WHERE vendor_key IS NOT NULL AND invoice_no_key IS NOT NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260831_receipt_duplicate_keys.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
