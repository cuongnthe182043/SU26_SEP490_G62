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
