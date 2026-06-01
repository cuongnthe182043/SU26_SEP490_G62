-- Seed data for SEP490 Logistics System
-- Note: This script assumes DB script.sql has already been executed

--------------------------------------------------------------------------------
-- 1. ROLES MANAGEMENT (Sync with initial schema definition)
--------------------------------------------------------------------------------
INSERT INTO roles (id, name) VALUES
(1, 'manager'),
(2, 'coordinator'),  
(3, 'accountant'),
(4, 'driver')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Vital Fix: Advance sequence counter for Identity Columns after manual overrides
ALTER TABLE roles ALTER COLUMN id RESTART WITH 5;

--------------------------------------------------------------------------------
-- 2. SECURE AUTHENTICATION ACCOUNTS
--------------------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role_id, is_verified) VALUES
('admin@example.com', crypt('admin123', gen_salt('bf')), 1, TRUE),
('coordinator@example.com', crypt('coord123', gen_salt('bf')), 2, TRUE),
('accountant@example.com', crypt('acct123', gen_salt('bf')), 3, TRUE),
('driver1@example.com', crypt('driver123', gen_salt('bf')), 4, TRUE)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id,
    is_verified = EXCLUDED.is_verified;

--------------------------------------------------------------------------------
-- 3. USER PROFILES
--------------------------------------------------------------------------------
WITH account_data AS (
    SELECT id, email FROM accounts 
    WHERE email IN ('admin@example.com', 'coordinator@example.com', 'accountant@example.com', 'driver1@example.com')
)
INSERT INTO profiles (id, full_name, email, phone, role_id, is_active) 
VALUES
    ((SELECT id FROM account_data WHERE email = 'admin@example.com'), 'Admin User', 'admin@example.com', '0901234560', 1, TRUE),
    ((SELECT id FROM account_data WHERE email = 'coordinator@example.com'), 'Nguyen Coordinator', 'coordinator@example.com', '0901234561', 2, TRUE),
    ((SELECT id FROM account_data WHERE email = 'accountant@example.com'), 'Tran Accountant', 'accountant@example.com', '0901234562', 3, TRUE),
    ((SELECT id FROM account_data WHERE email = 'driver1@example.com'), 'Le Driver', 'driver1@example.com', '0901234563', 4, TRUE)
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 4. DRIVER LOGISTICS SPECIFICS
--------------------------------------------------------------------------------
INSERT INTO drivers (profile_id, license_number, license_expiry_date, base_salary, revenue_share_percent, joined_at)
SELECT p.id, 'DL123456', '2027-12-31', 5000000, 15, '2023-01-01'
FROM profiles p
WHERE p.role_id = 4 AND p.email = 'driver1@example.com'
ON CONFLICT (profile_id) DO NOTHING;

--------------------------------------------------------------------------------
-- 5. CUSTOMERS MANAGEMENT (Avoid conflict syntax on columns without Unique indexes)
--------------------------------------------------------------------------------
INSERT INTO customers (customer_type, full_name, phone, email, address, current_debt) 
SELECT 'individual', 'Nguyen Hoang Anh', '0987654321', 'anh@email.com', '123 Nguyen Hue, HCMC', 0
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone = '0987654321');

INSERT INTO customers (customer_type, full_name, phone, email, address, current_debt)
SELECT 'business', 'ABC Logistics Co.', '0987654322', 'contact@abclogistics.vn', '456 Le Loi, HCMC', 500000
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone = '0987654322');

INSERT INTO customers (customer_type, full_name, phone, email, address, current_debt)
SELECT 'individual', 'Tran Van Binh', '0987654323', 'binh@email.com', '789 Tran Hung Dao, HCMC', 0
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone = '0987654323');

INSERT INTO customers (customer_type, full_name, phone, email, address, current_debt)
SELECT 'business', 'XYZ Trading', '0987654324', 'sales@xyztrading.vn', '321 Nguyen Trai, HCMC', 1000000
WHERE NOT EXISTS (SELECT 1 FROM customers WHERE phone = '0987654324');

--------------------------------------------------------------------------------
-- 6. VEHICLE GROUPS DEFINITIONS
--------------------------------------------------------------------------------
INSERT INTO vehicle_groups (name, max_load_weight, fixed_price_per_km, depreciation_per_km) 
SELECT 'Small Van (1-2 tấn)', 2000, 10000, 500
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Small Van (1-2 tấn)');

INSERT INTO vehicle_groups (name, max_load_weight, fixed_price_per_km, depreciation_per_km)
SELECT 'Medium Truck (2-5 tấn)', 5000, 15000, 800
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Medium Truck (2-5 tấn)');

INSERT INTO vehicle_groups (name, max_load_weight, fixed_price_per_km, depreciation_per_km)
SELECT 'Large Truck (5-10 tấn)', 10000, 25000, 1200
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Large Truck (5-10 tấn)');

--------------------------------------------------------------------------------
-- 7. FLEET VEHICLES
--------------------------------------------------------------------------------
INSERT INTO vehicles (plate_number, vehicle_group_id, brand, model, load_capacity, manufacture_year, status) VALUES
('51-A12345', 1, 'Toyota', 'Hiace', 2000, 2021, 'available'),
('51-B67890', 2, 'Hino', 'FC', 5000, 2020, 'available'),
('51-C11111', 3, 'Hyundai', 'HD120S', 10000, 2019, 'maintenance'),
('51-D22222', 1, 'Ford', 'Transit', 2000, 2022, 'available')
ON CONFLICT (plate_number) DO NOTHING;

--------------------------------------------------------------------------------
-- 8. ASSET ASSIGNMENT
--------------------------------------------------------------------------------
UPDATE vehicles v
SET assigned_driver_id = p.id
FROM profiles p
WHERE p.role_id = 4 AND v.plate_number = '51-A12345'
AND v.assigned_driver_id IS NULL;

--------------------------------------------------------------------------------
-- 9. PARTNERS / SUB-CONTRACTORS
--------------------------------------------------------------------------------
INSERT INTO partners (company_name, contact_person, phone, email, address)
SELECT 'Tech Express Logistics', 'Mr. Tuan', '0912345678', 'tuan@techexpress.vn', '100 Pasteur, HCMC'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Tech Express Logistics');

INSERT INTO partners (company_name, contact_person, phone, email, address)
SELECT 'Green Delivery Co.', 'Ms. Hoa', '0912345679', 'hoa@greendelivery.vn', '200 Nguyen Trai, HCMC'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Green Delivery Co.');

INSERT INTO partners (company_name, contact_person, phone, email, address)
SELECT 'FastFreight Vietnam', 'Mr. Long', '0912345680', 'long@fastfreight.vn', '300 Landmark 81, HCMC'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'FastFreight Vietnam');

--------------------------------------------------------------------------------
-- 10. ORDERS
--------------------------------------------------------------------------------
INSERT INTO orders (customer_id, created_by, cargo_name, cargo_weight, pickup_address, delivery_address, estimated_price, payment_type, status, notes)
SELECT c.id, p.id, 'Electronics Package', 50.0, '123 Nguyen Hue, HCMC', '456 Le Loi, HCMC', 500000, 'cash', 'pending', 'Fragile - Handle with care'
FROM customers c
JOIN profiles p ON p.role_id = 2
WHERE c.customer_type = 'individual' AND c.phone = '0987654321'
AND NOT EXISTS (SELECT 1 FROM orders WHERE cargo_name = 'Electronics Package' AND pickup_address = '123 Nguyen Hue, HCMC')
LIMIT 1;

INSERT INTO orders (customer_id, created_by, cargo_name, cargo_weight, pickup_address, delivery_address, estimated_price, payment_type, status, notes)
SELECT c.id, p.id, 'Furniture Set', 200.0, '789 Tran Hung Dao, HCMC', '321 Nguyen Trai, HCMC', 1500000, 'bank_transfer', 'assigned', 'Large furniture item'
FROM customers c
JOIN profiles p ON p.role_id = 2
WHERE c.customer_type = 'business' AND c.phone = '0987654322'
AND NOT EXISTS (SELECT 1 FROM orders WHERE cargo_name = 'Furniture Set' AND pickup_address = '789 Tran Hung Dao, HCMC')
LIMIT 1;

--------------------------------------------------------------------------------
-- 11. SHIPMENTS
--------------------------------------------------------------------------------
INSERT INTO order_shipments (order_id, shipment_index, pickup_address, delivery_address, cargo_weight, status)
SELECT o.id, 1, o.pickup_address, o.delivery_address, o.cargo_weight, 'pending'
FROM orders o
WHERE o.status = 'pending'
AND NOT EXISTS (SELECT 1 FROM order_shipments os WHERE os.order_id = o.id AND os.shipment_index = 1);

--------------------------------------------------------------------------------
-- 12. SHIPMENT ASSIGNMENTS
--------------------------------------------------------------------------------
INSERT INTO shipment_assignments (shipment_id, driver_id, vehicle_id, assigned_at)
SELECT os.id, p.id, v.id, NOW()
FROM order_shipments os
JOIN profiles p ON p.role_id = 4
JOIN vehicles v ON v.status = 'available' AND v.vehicle_group_id = 1
WHERE os.status = 'pending'
AND NOT EXISTS (SELECT 1 FROM shipment_assignments sa WHERE sa.shipment_id = os.id)
LIMIT 1;

--------------------------------------------------------------------------------
-- 13. BONUS RULES
--------------------------------------------------------------------------------
INSERT INTO bonus_rules (vehicle_group_id, title, reward_amount, conditions)
SELECT 1, 'Small Van Weekly Bonus', 500000, 'Complete 10 trips without incident'
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Small Van Weekly Bonus');

INSERT INTO bonus_rules (vehicle_group_id, title, reward_amount, conditions)
SELECT 2, 'Medium Truck Monthly Bonus', 2000000, 'Complete 50 trips with 95%+ on-time rate'
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Medium Truck Monthly Bonus');

INSERT INTO bonus_rules (vehicle_group_id, title, reward_amount, conditions)
SELECT 3, 'Large Truck Monthly Bonus', 3000000, 'Complete 40 trips with 98%+ on-time rate'
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Large Truck Monthly Bonus');

--------------------------------------------------------------------------------
-- 14. DRIVER PERFORMANCE / KPI RECORDS
--------------------------------------------------------------------------------
INSERT INTO kpi_records (driver_id, month, year, completed_shipments, total_revenue, late_deliveries)
SELECT p.id, 5, 2026, 12, 15000000, 1
FROM profiles p
WHERE p.role_id = 4 AND p.email = 'driver1@example.com'
ON CONFLICT DO NOTHING;

--------------------------------------------------------------------------------
-- 15. MAINTENANCE MANAGEMENT
--------------------------------------------------------------------------------
INSERT INTO maintenance_records (vehicle_id, maintenance_type, description, cost, maintenance_date)
SELECT v.id, 'Routine Maintenance', 'Oil change, filter replacement', 500000, '2026-05-15'
FROM vehicles v
WHERE v.plate_number = '51-C11111'
AND NOT EXISTS (SELECT 1 FROM maintenance_records mr WHERE mr.vehicle_id = v.id AND mr.maintenance_date = '2026-05-15');

--------------------------------------------------------------------------------
-- SEED VALIDATION TEST SUMMARY
--------------------------------------------------------------------------------
SELECT '✓ Accounts' as entity, COUNT(*) as count FROM accounts
UNION ALL
SELECT '✓ Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT '✓ Customers', COUNT(*) FROM customers
UNION ALL
SELECT '✓ Vehicle Groups', COUNT(*) FROM vehicle_groups
UNION ALL
SELECT '✓ Vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT '✓ Orders', COUNT(*) FROM orders
UNION ALL
SELECT '✓ Shipments', COUNT(*) FROM order_shipments
UNION ALL
SELECT '✓ Drivers', COUNT(*) FROM drivers;
