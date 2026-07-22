-- ─────────────────────────────────────────────────────────────────────────────
-- CHATBOT RAG — Curated read-only views
-- ─────────────────────────────────────────────────────────────────────────────
-- Con chatbot (Text-to-SQL) CHỈ được truy vấn các view dưới đây, KHÔNG bao giờ
-- chạm bảng gốc → không thể lộ password (accounts), refresh token, hay PII nhạy
-- cảm (national_id...). Mọi view đều read-only; tầng app còn ép thêm transaction
-- READ ONLY + statement_timeout + allowlist theo role.
--
-- Driver scoping: các view v_chatbot_my_* tự lọc theo GUC app.actor_id mà tầng app
-- set (SET LOCAL app.actor_id = <profile_id>) trước mỗi truy vấn. Nếu chưa set →
-- current_setting(...) trả NULL → không ra dòng nào (fail-closed).
--
-- Áp dụng cho DB đang chạy: psql -f "DB script/chatbot_views.sql"
-- (init script chỉ chạy khi volume rỗng — DB đang chạy phải apply tay).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Nhân sự (chỉ tên + vai trò, KHÔNG PII) ───────────────────────────────────
CREATE OR REPLACE VIEW v_chatbot_staff AS
SELECT p.id, p.full_name, p.phone, r.name AS role_name
FROM profiles p
JOIN roles r ON r.id = p.role_id;

-- ── Nhóm xe / xe ──────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_chatbot_vehicle_groups AS
SELECT id, name, description, max_load_weight_kg, price_per_km, status
FROM vehicle_groups;

CREATE OR REPLACE VIEW v_chatbot_vehicles AS
SELECT v.id, v.plate_number, vg.name AS vehicle_group, v.brand, v.model,
       v.load_capacity_kg, v.status,
       v.assigned_driver_id, dp.full_name AS assigned_driver_name
FROM vehicles v
JOIN vehicle_groups vg ON vg.id = v.vehicle_group_id
LEFT JOIN profiles dp ON dp.id = v.assigned_driver_id;

-- ── Khách hàng / đối tác (không tax_code/địa chỉ đầy đủ) ─────────────────────
CREATE OR REPLACE VIEW v_chatbot_customers AS
SELECT id, customer_type, full_name, company_name, contact_person, phone, address, created_at
FROM customers;

CREATE OR REPLACE VIEW v_chatbot_partners AS
SELECT id, company_name, short_name, contact_person, phone, payment_term_days, created_at
FROM partners;

-- ── Đơn hàng (ẩn đơn is_confidential) ────────────────────────────────────────
CREATE OR REPLACE VIEW v_chatbot_orders AS
SELECT o.id, o.customer_id, c.full_name AS customer_name, c.company_name AS customer_company,
       o.partner_id, pn.company_name AS partner_name,
       o.cargo_name, o.cargo_weight_kg, o.payment_type,
       o.total_estimated_price, o.prepaid_amount, o.derived_status, o.created_at
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN partners  pn ON pn.id = o.partner_id
WHERE o.is_confidential = FALSE;

-- ── Chuyến (shipment) + tài xế hiện tại ──────────────────────────────────────
CREATE OR REPLACE VIEW v_chatbot_shipments AS
SELECT s.id, s.order_id, s.shipment_index, vg.name AS vehicle_group,
       s.estimated_price, s.actual_price, s.estimated_distance_km, s.actual_distance_km,
       s.cargo_name, s.cargo_weight_kg, s.status,
       sc.owner_driver_id AS driver_id, dp.full_name AS driver_name,
       s.completed_at, s.created_at
FROM order_shipments s
LEFT JOIN vehicle_groups vg ON vg.id = s.vehicle_group_id
LEFT JOIN v_shipment_current sc ON sc.shipment_id = s.id
LEFT JOIN profiles dp ON dp.id = sc.owner_driver_id;

-- ── Sự cố ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_chatbot_incidents AS
SELECT i.id, i.shipment_id, i.vehicle_id, i.reported_by, rp.full_name AS reported_by_name,
       i.incident_type, i.severity_level, i.description, i.location, i.estimated_loss,
       i.status, i.occurred_at, i.resolved_at
FROM incidents i
LEFT JOIN profiles rp ON rp.id = i.reported_by;

-- ── Tài chính (chỉ role privileged được allowlist) ───────────────────────────
CREATE OR REPLACE VIEW v_chatbot_debts AS
SELECT d.id, d.debt_type, d.customer_id, d.partner_id, d.driver_id,
       d.order_id, d.shipment_id, d.total_amount, d.due_date, d.created_at,
       COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) AS paid_amount,
       d.total_amount - COALESCE(SUM(dp.amount) FILTER (WHERE dp.status = 'confirmed'), 0) AS remaining_amount
FROM debts d
LEFT JOIN debt_payments dp ON dp.debt_id = d.id
GROUP BY d.id;

CREATE OR REPLACE VIEW v_chatbot_kpi AS
SELECT k.id, k.driver_id, dp.full_name AS driver_name, vg.name AS vehicle_group,
       k.month, k.year, k.completed_shipments, k.total_revenue,
       k.incident_count, k.major_incident_count, k.critical_incident_count
FROM kpi_records k
LEFT JOIN profiles dp ON dp.id = k.driver_id
LEFT JOIN vehicle_groups vg ON vg.id = k.vehicle_group_id;

CREATE OR REPLACE VIEW v_chatbot_payrolls AS
SELECT pr.id, pr.driver_id, dp.full_name AS driver_name,
       pr.payroll_month, pr.payroll_year, pr.base_salary, pr.total_revenue,
       pr.revenue_bonus, pr.kpi_bonus, pr.top_driver_bonus, pr.status
FROM payrolls pr
LEFT JOIN profiles dp ON dp.id = pr.driver_id;

CREATE OR REPLACE VIEW v_chatbot_expenses AS
SELECT e.id, e.shipment_id, e.vehicle_id, e.expense_type, e.amount, e.status, e.expense_date, e.created_at
FROM expenses e;

CREATE OR REPLACE VIEW v_chatbot_financial_transactions AS
SELECT id, event_type, debit_account, credit_account, amount, description,
       ref_type, ref_id, occurred_at
FROM financial_transactions
WHERE reversal_of_id IS NULL;

CREATE OR REPLACE VIEW v_chatbot_invoices AS
SELECT i.id, i.invoice_number, i.customer_id, c.full_name AS customer_name,
       c.company_name AS customer_company, i.order_id, i.invoice_date, i.due_date,
       i.subtotal, i.tax_amount, i.total_amount, i.status
FROM invoices i
LEFT JOIN customers c ON c.id = i.customer_id;

-- ── Driver-scoped (tự lọc theo GUC app.actor_id — fail-closed nếu chưa set) ───
CREATE OR REPLACE VIEW v_chatbot_my_kpi AS
SELECT * FROM v_chatbot_kpi
WHERE driver_id = current_setting('app.actor_id', true)::int;

CREATE OR REPLACE VIEW v_chatbot_my_payroll AS
SELECT * FROM v_chatbot_payrolls
WHERE driver_id = current_setting('app.actor_id', true)::int;

CREATE OR REPLACE VIEW v_chatbot_my_debts AS
SELECT * FROM v_chatbot_debts
WHERE debt_type = 'driver'
  AND driver_id = current_setting('app.actor_id', true)::int;

CREATE OR REPLACE VIEW v_chatbot_my_shipments AS
SELECT * FROM v_chatbot_shipments
WHERE driver_id = current_setting('app.actor_id', true)::int;

CREATE OR REPLACE VIEW v_chatbot_my_salary_advances AS
SELECT id, driver_id, amount, reason, request_month, request_year, status, created_at
FROM salary_advances
WHERE driver_id = current_setting('app.actor_id', true)::int;

CREATE OR REPLACE VIEW v_chatbot_my_bonuses AS
SELECT id, driver_id, type, year, amount, status, notes
FROM driver_bonuses
WHERE driver_id = current_setting('app.actor_id', true)::int;
