-- =====================================================================
-- 20260802_holiday_bonus_rule
-- Đưa hệ số lương ngày lễ (200%, Điều V.1) từ mã nguồn vào bonus_rules.
--
-- Vì sao cần: con số 200% trước đây nằm cứng trong accountantPayrollRepository và
-- payrollRepository. Muốn đổi chính sách lương lễ phải sửa mã và deploy lại backend,
-- trong khi bảng bonus_rules sinh ra đúng để chứa những con số như vậy — và cột
-- reward_multiplier đã tồn tại từ đầu nhưng chưa nơi nào đọc.
--
-- Rule để vehicle_group_id = NULL (áp dụng chung mọi nhóm xe). Lưu ý: trước bản này
-- các câu tra rule dùng `WHERE vehicle_group_id = k.vehicle_group_id` nên rule NULL
-- không bao giờ khớp; phần mã đọc rule đã được sửa để rule chung có hiệu lực, với
-- thứ tự ưu tiên rule-theo-nhóm > rule-chung.
--
-- Trung lập về tiền: hệ số 2.00 cho ra đúng công thức cũ
--   (hệ số - 1) × lương ngày × số ngày lễ = 1 × lương ngày × số ngày lễ.
-- Bảng lương đã chốt (reviewed/approved/paid) không bị đụng tới — upsert lương chỉ
-- ghi đè bản ghi còn 'pending'.
--
-- An toàn với dữ liệu cũ: chỉ THÊM một dòng bonus_rules. Chạy lại nhiều lần không
-- sinh trùng (idempotent nhờ NOT EXISTS).
-- =====================================================================

BEGIN;

INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_multiplier, is_active)
SELECT NULL, 'Đi làm ngày lễ — hệ số lương (Điều V.1)', 'holiday', 2.00, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bonus_rules
    WHERE bonus_type = 'holiday' AND is_active = TRUE AND vehicle_group_id IS NULL
);

-- Một nhóm xe chỉ nên có tối đa MỘT rule đang bật cho mỗi loại thưởng. Không có ràng
-- buộc này thì lookup `ORDER BY ... LIMIT 1` sẽ âm thầm chọn rule cũ hơn, khiến người
-- quản lý sửa chính sách bằng cách tạo rule mới mà không hiểu vì sao lương không đổi.
-- Partial index: chỉ ràng buộc rule đang bật, rule đã tắt muốn trùng bao nhiêu cũng được.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_rules_active_group_type
    ON bonus_rules (vehicle_group_id, bonus_type)
    WHERE is_active;

-- vehicle_group_id IS NULL không bị index trên bắt (NULL không đụng nhau trong UNIQUE),
-- nên cần thêm một index riêng cho rule áp dụng chung.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bonus_rules_active_global_type
    ON bonus_rules (bonus_type)
    WHERE is_active AND vehicle_group_id IS NULL;

INSERT INTO schema_migrations (filename)
VALUES ('20260802_holiday_bonus_rule.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
