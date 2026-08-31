TRUNCATE TABLE
    financial_transactions,
    payment_vouchers,
    payment_receipts,
    shipment_receipts,
    order_receipt_requests,
    debt_payments,
    debts,
    invoice_shipments,
    invoices,

    payrolls,
    salary_advances,
    driver_bonuses,
    bonus_records,
    kpi_records,
    attendance_overrides,
    leave_requests,

    business_report_periods,

    -- Kết quả đọc hóa đơn bằng AI. Trỏ tới expenses HOẶC maintenance_records qua cặp
    -- (entity_type, entity_id) nên cố ý KHÔNG có khoá ngoại — CASCADE bên dưới không
    -- với tới được. Bỏ sót thì sau khi reset, hóa đơn seed lại bị chấm là TRÙNG với
    -- bản ghi của lần chạy trước: findDuplicates đối chiếu theo băm ảnh và số hóa đơn,
    -- không theo entity_id, nên entity_id mồ côi vẫn khớp.
    receipt_extractions,
    expense_attachments,
    expenses,

    shipment_revenue_allocations,
    shipment_assignment_history,
    delivery_proofs,
    trip_stops,
    order_shipments,
    orders,

    incident_evidences,
    incidents,
    maintenance_records,
    vehicle_status_history,

    partners,
    customers,

    notifications,
    activity_logs
RESTART IDENTITY CASCADE;

UPDATE vehicles SET status = 'active' WHERE status IN ('maintenance', 'broken');
