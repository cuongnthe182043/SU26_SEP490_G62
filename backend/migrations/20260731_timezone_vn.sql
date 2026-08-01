-- =====================================================================
-- 20260731_timezone_vn
-- Chuyển múi giờ mặc định của database sang giờ Việt Nam (+07).
--
-- Vì sao cần: Postgres mặc định UTC. NOW(), CURRENT_DATE, ép kiểu ::date và
-- EXTRACT(MONTH FROM timestamptz) đều quy đổi theo múi giờ của PHIÊN. Để UTC thì
-- từ 0h đến 7h sáng giờ Việt Nam hệ thống vẫn coi là "ngày hôm qua":
--   * chuyến chạy đêm hoàn thành 2h sáng ngày lễ → không khớp company_holidays,
--     tài xế mất khoản 200% lương
--   * chuyến hoàn thành rạng sáng mùng 1 → KPI/doanh thu rơi nhầm về tháng trước
--   * quy tắc "chỉ ứng lương ngày 25" lệch 7 tiếng
--
-- An toàn với dữ liệu cũ: TIMESTAMPTZ lưu mốc UTC bên trong, đổi múi giờ CHỈ đổi
-- cách quy đổi ra ngày/giờ khi đọc, KHÔNG sửa một byte dữ liệu nào.
-- Chạy lại nhiều lần không sao (idempotent).
--
-- LƯU Ý: ALTER DATABASE chỉ có hiệu lực với phiên kết nối MỚI. Sau khi chạy phải
-- khởi động lại backend để pool mở lại kết nối.
-- =====================================================================

BEGIN;

DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'Asia/Ho_Chi_Minh');
END $$;

INSERT INTO schema_migrations (filename)
VALUES ('20260731_timezone_vn.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- Kiểm tra sau khi chạy (mở phiên psql mới):
--   SHOW timezone;                    -- kỳ vọng: Asia/Ho_Chi_Minh
--   SELECT NOW(), CURRENT_DATE;       -- kỳ vọng: đúng giờ Việt Nam
