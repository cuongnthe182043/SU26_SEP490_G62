-- =====================================================================
-- 20260802_optional_staff_email
-- Cho phép nhân viên không có email.
--
-- Vì sao cần: phần lớn tài xế không có email, hoặc có nhưng không dùng. Bắt buộc
-- email khiến người nhập phải bịa địa chỉ giả (nvA@gmail.com, driver01@company.vn...)
-- chỉ để qua được form — dữ liệu rác, và mail chào mừng gửi vào hư không.
-- Sau khi hệ thống cho đăng nhập bằng số điện thoại (20260802, xem utils/loginIdentifier),
-- email không còn là định danh đăng nhập duy nhất nên ràng buộc này hết lý do tồn tại.
--
-- UNIQUE vẫn giữ: Postgres coi mỗi NULL là khác nhau nên nhiều tài khoản cùng để
-- trống email không hề vi phạm UNIQUE, trong khi hai tài khoản cùng một email thật
-- thì vẫn bị chặn như trước.
--
-- An toàn với dữ liệu cũ: chỉ NỚI ràng buộc, không sửa/xoá dòng nào. Mọi tài khoản
-- đang có email giữ nguyên. Chạy lại nhiều lần không sao (DROP NOT NULL idempotent).
--
-- Lưu ý vận hành: tài khoản không có email sẽ KHÔNG dùng được đăng nhập Google và
-- KHÔNG tự đặt lại mật khẩu qua "Quên mật khẩu" (cả hai đều cần hộp thư). Những tài
-- khoản này đăng nhập bằng số điện thoại, và khi quên mật khẩu thì nhờ quản lý reset
-- — mật khẩu mới được trả thẳng về màn quản lý để giao tận tay.
-- =====================================================================

BEGIN;

ALTER TABLE accounts ALTER COLUMN email DROP NOT NULL;

-- Chuỗi rỗng KHÔNG phải là "không có email": '' vẫn đụng UNIQUE nên tài khoản thứ hai
-- để trống sẽ lỗi trùng khoá. Quy về NULL để chỉ có đúng một cách biểu diễn "để trống".
UPDATE accounts SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';

-- Chốt bằng ràng buộc để không nơi nào lỡ ghi lại chuỗi rỗng.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS chk_accounts_email_not_blank;
ALTER TABLE accounts ADD CONSTRAINT chk_accounts_email_not_blank
    CHECK (email IS NULL OR btrim(email) <> '');

INSERT INTO schema_migrations (filename)
VALUES ('20260802_optional_staff_email.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
