-- ============================================================================
-- RESET DỮ LIỆU NGHIỆP VỤ — về trạng thái "trắng tinh" để test lại từ đầu
-- ----------------------------------------------------------------------------
-- XOÁ  : toàn bộ dữ liệu phát sinh trong vận hành (đơn, chuyến, phiếu thu/chi,
--        công nợ, chi phí, sự cố, lương, KPI, hoá đơn, thông báo, sổ tài chính...)
-- GIỮ  : dữ liệu nền để đăng nhập & vận hành ngay được:
--          • Tài khoản  : profiles, accounts, roles, auth_refresh_tokens, device_tokens
--          • Xe/tài xế  : vehicles, vehicle_groups, drivers, vehicle_driver_assignments
--          • Cấu hình   : company_info, company_holidays, bonus_rules
--
-- CÁCH CHẠY (ví dụ với docker compose):
--   docker exec -i <db-container> psql -U postgres -d SEP490 < "DB script/reset_data.sql"
--
-- LƯU Ý: file này CHỈ xoá dữ liệu, KHÔNG đụng tới cấu trúc bảng. Muốn dựng lại
-- toàn bộ từ số 0 (kể cả cấu trúc) thì chạy "DB script.sql" — nhưng file đó xoá
-- sạch cả schema, dùng cẩn thận.
-- ============================================================================

TRUNCATE TABLE
    -- Sổ tài chính & thanh toán
    financial_transactions,
    payment_vouchers,
    payment_receipts,
    shipment_receipts,
    order_receipt_requests,
    debt_payments,
    debts,
    invoice_shipments,
    invoices,

    -- Lương / thưởng / KPI / chấm công
    payrolls,
    salary_advances,
    driver_bonuses,
    bonus_records,
    kpi_records,
    attendance_overrides,
    leave_requests,

    -- Báo cáo đã chốt kỳ
    business_report_periods,

    -- Chi phí
    expense_attachments,
    expenses,

    -- Đơn hàng & chuyến
    shipment_revenue_allocations,
    shipment_assignment_history,
    delivery_proofs,
    trip_stops,
    order_shipments,
    orders,

    -- Sự cố & vòng đời xe
    incident_evidences,
    incidents,
    maintenance_records,
    vehicle_status_history,

    -- Đối tượng kinh doanh
    partners,
    customers,

    -- Nhật ký & thông báo
    notifications,
    activity_logs
RESTART IDENTITY CASCADE;

-- Xoá lịch sử bảo dưỡng/sự cố KHÔNG tự đưa xe về trạng thái dùng được — nếu lần
-- test trước để xe ở 'maintenance'/'broken' thì xe sẽ kẹt, không nhận chuyến mới
-- được. Đưa mọi xe (trừ xe đã thu hồi) về 'active' cho sạch.
UPDATE vehicles SET status = 'active' WHERE status IN ('maintenance', 'broken');
