-- =====================================================================
-- 20260901_drop_chatbot_views
-- Bỏ 20 view phục vụ trợ lý AI cùng với việc gỡ tính năng chatbot.
--
-- Các view này chỉ tồn tại để chatbotSqlRunner chạy SELECT trong một phạm vi hẹp có
-- kiểm soát; không màn hình, báo cáo hay truy vấn nào khác trong hệ thống đọc chúng.
-- Bỏ mã nguồn mà để lại view là để lại 20 định nghĩa mồ côi, khiến người đọc schema
-- sau này tưởng còn tính năng nào đó đang dùng.
--
-- An toàn với dữ liệu cũ: view KHÔNG chứa dữ liệu, chỉ là định nghĩa truy vấn. Xóa
-- không mất gì và dựng lại được nguyên vẹn từ lịch sử git nếu sau này khôi phục chatbot.
--
-- Cố ý KHÔNG dùng CASCADE: cascade sẽ kéo theo mọi thứ phụ thuộc, kể cả những đối
-- tượng ngoài danh sách này mà ta chưa lường tới. Các view v_chatbot_my_* phụ thuộc
-- vào view nền nên được liệt kê TRƯỚC; xóa cả cụm trong một câu lệnh thì Postgres tự
-- giải quyết được phụ thuộc nội bộ của cụm đó.
-- =====================================================================

BEGIN;

DROP VIEW IF EXISTS
    v_chatbot_my_kpi,
    v_chatbot_my_payroll,
    v_chatbot_my_debts,
    v_chatbot_my_shipments,
    v_chatbot_my_salary_advances,
    v_chatbot_my_bonuses,
    v_chatbot_staff,
    v_chatbot_vehicle_groups,
    v_chatbot_vehicles,
    v_chatbot_customers,
    v_chatbot_partners,
    v_chatbot_orders,
    v_chatbot_shipments,
    v_chatbot_incidents,
    v_chatbot_debts,
    v_chatbot_kpi,
    v_chatbot_payrolls,
    v_chatbot_expenses,
    v_chatbot_financial_transactions,
    v_chatbot_invoices;

INSERT INTO schema_migrations (filename)
VALUES ('20260901_drop_chatbot_views.sql')
ON CONFLICT (filename) DO NOTHING;

COMMIT;
