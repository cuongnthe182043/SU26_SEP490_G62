-- Seed data for SEP490 Logistics System
-- Note: This script assumes DB script.sql has already been executed
-- Role IDs and all other surrogate keys are auto-generated 6-digit INTs.

--------------------------------------------------------------------------------
-- 1. ROLES MANAGEMENT (Sync with initial schema definition)
--------------------------------------------------------------------------------
INSERT INTO roles (name) VALUES
('manager'),
('coordinator'),
('accountant'),
('driver')
ON CONFLICT (name) DO NOTHING;

--------------------------------------------------------------------------------
-- 2. SECURE AUTHENTICATION ACCOUNTS
--------------------------------------------------------------------------------
INSERT INTO accounts (email, password_hash, role_id, is_active) VALUES
('admin@example.com', crypt('admin123', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'manager'), TRUE),
('ntck005@gmail.com', crypt('coord123', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'coordinator'), TRUE),
('accountant@example.com', crypt('acct123', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'accountant'), TRUE),
('driver1@example.com', crypt('driver123', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'driver'), TRUE)
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active;

--------------------------------------------------------------------------------
-- 3. USER PROFILES
--------------------------------------------------------------------------------
WITH account_data AS (
    SELECT id, email FROM accounts 
    WHERE email IN ('admin@example.com', 'ntck005@gmail.com', 'accountant@example.com', 'driver1@example.com')
)
INSERT INTO profiles (id, full_name, phone, role_id) 
VALUES
    ((SELECT id FROM account_data WHERE email = 'admin@example.com'), 'Admin User', '0901234560', (SELECT id FROM roles WHERE name = 'manager')),
    ((SELECT id FROM account_data WHERE email = 'ntck005@gmail.com'), 'Nguyen Coordinator', '0901234561', (SELECT id FROM roles WHERE name = 'coordinator')),
    ((SELECT id FROM account_data WHERE email = 'accountant@example.com'), 'Tran Accountant', '0901234562', (SELECT id FROM roles WHERE name = 'accountant')),
    ((SELECT id FROM account_data WHERE email = 'driver1@example.com'), 'Le Driver', '0901234563', (SELECT id FROM roles WHERE name = 'driver'))
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 4. DRIVER LOGISTICS SPECIFICS
--------------------------------------------------------------------------------
INSERT INTO drivers (profile_id, license_number, license_expiry_date, hire_date, revenue_share_percent)
SELECT p.id, 'DL123456', '2027-12-31', '2023-01-01', 15
FROM profiles p
JOIN accounts a ON a.id = p.id
WHERE p.role_id = (SELECT id FROM roles WHERE name = 'driver') AND a.email = 'driver1@example.com'
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
INSERT INTO vehicle_groups (name, max_load_weight_kg, price_per_km, depreciation_per_km) 
SELECT 'Small Van (1-2 tấn)', 2000, 10000, 500
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Small Van (1-2 tấn)');

INSERT INTO vehicle_groups (name, max_load_weight_kg, price_per_km, depreciation_per_km)
SELECT 'Medium Truck (2-5 tấn)', 5000, 15000, 800
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Medium Truck (2-5 tấn)');

INSERT INTO vehicle_groups (name, max_load_weight_kg, price_per_km, depreciation_per_km)
SELECT 'Large Truck (5-10 tấn)', 10000, 25000, 1200
WHERE NOT EXISTS (SELECT 1 FROM vehicle_groups WHERE name = 'Large Truck (5-10 tấn)');

--------------------------------------------------------------------------------
-- 7. FLEET VEHICLES
--------------------------------------------------------------------------------
INSERT INTO vehicles (plate_number, vehicle_group_id, brand, model, load_capacity_kg, manufacture_year, status) VALUES
('51-A12345', (SELECT id FROM vehicle_groups WHERE price_per_km = 10000), 'Toyota', 'Hiace', 2000, 2021, 'available'),
('51-B67890', (SELECT id FROM vehicle_groups WHERE price_per_km = 15000), 'Hino', 'FC', 5000, 2020, 'available'),
('51-C11111', (SELECT id FROM vehicle_groups WHERE price_per_km = 25000), 'Hyundai', 'HD120S', 10000, 2019, 'maintenance'),
('51-D22222', (SELECT id FROM vehicle_groups WHERE price_per_km = 10000), 'Ford', 'Transit', 2000, 2022, 'available')
ON CONFLICT (plate_number) DO NOTHING;

--------------------------------------------------------------------------------
-- 8. ASSET ASSIGNMENT
--------------------------------------------------------------------------------
UPDATE vehicles v
SET assigned_driver_id = p.id
FROM profiles p
WHERE p.role_id = (SELECT id FROM roles WHERE name = 'driver') AND v.plate_number = '51-A12345'
AND v.assigned_driver_id IS NULL;

UPDATE drivers d
SET vehicle_id = v.id
FROM vehicles v, profiles p
WHERE p.role_id = (SELECT id FROM roles WHERE name = 'driver')
AND p.id = d.profile_id
AND v.plate_number = '51-A12345'
AND d.vehicle_id IS NULL;

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
-- Địa chỉ pickup/delivery lưu ở trip_stops, KHÔNG phải orders
-- orders.derived_status (không phải status), orders.total_estimated_price (không phải estimated_price)
--------------------------------------------------------------------------------
-- Order 1: open — visible in driver trip pool
INSERT INTO orders (customer_id, created_by, cargo_name, cargo_weight_kg, total_estimated_price, payment_type, derived_status, notes)
SELECT c.id, p.id, 'Electronics Package', 50.0, 500000, 'cash', 'open', 'Fragile - Handle with care'
FROM customers c
JOIN profiles p ON p.role_id = (SELECT id FROM roles WHERE name = 'coordinator')
WHERE c.customer_type = 'individual' AND c.phone = '0987654321'
AND NOT EXISTS (SELECT 1 FROM orders WHERE cargo_name = 'Electronics Package')
LIMIT 1;

-- Order 2: completed — appears in driver history
INSERT INTO orders (customer_id, created_by, cargo_name, cargo_weight_kg, total_estimated_price, payment_type, derived_status, notes)
SELECT c.id, p.id, 'Furniture Set', 200.0, 1500000, 'bank_transfer', 'completed', 'Large furniture item'
FROM customers c
JOIN profiles p ON p.role_id = (SELECT id FROM roles WHERE name = 'coordinator')
WHERE c.customer_type = 'business' AND c.phone = '0987654322'
AND NOT EXISTS (SELECT 1 FROM orders WHERE cargo_name = 'Furniture Set')
LIMIT 1;

--------------------------------------------------------------------------------
-- 11. SHIPMENTS + TRIP STOPS
-- pickup_address / delivery_address lưu trong trip_stops (stop_type = pickup/delivery)
--------------------------------------------------------------------------------
-- Shipment 1: available — visible in pool, no owner
INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, cargo_weight_kg, estimated_price, status)
SELECT o.id, 1, (SELECT id FROM vehicle_groups WHERE price_per_km = 10000),
       o.cargo_weight_kg, o.total_estimated_price, 'available'
FROM orders o
WHERE o.derived_status = 'open' AND o.cargo_name = 'Electronics Package'
AND NOT EXISTS (SELECT 1 FROM order_shipments os WHERE os.order_id = o.id AND os.shipment_index = 1);

-- Trip stops for shipment 1
INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone)
SELECT os.id, 1, 'pickup', '123 Nguyen Hue, HCMC', 'Nguyen Hoang Anh', '0987654321'
FROM order_shipments os JOIN orders o ON o.id = os.order_id
WHERE o.cargo_name = 'Electronics Package' AND os.shipment_index = 1
AND NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.shipment_id = os.id AND ts.stop_index = 1);

INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address)
SELECT os.id, 2, 'delivery', '456 Le Loi, HCMC'
FROM order_shipments os JOIN orders o ON o.id = os.order_id
WHERE o.cargo_name = 'Electronics Package' AND os.shipment_index = 1
AND NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.shipment_id = os.id AND ts.stop_index = 2);

-- Shipment 2: completed — owned by driver1, shows in history
INSERT INTO order_shipments (order_id, shipment_index, vehicle_group_id, owner_driver_id, cargo_weight_kg, estimated_price, status, claimed_at, completed_at)
SELECT o.id, 1, (SELECT id FROM vehicle_groups WHERE price_per_km = 10000),
       drv.id, o.cargo_weight_kg, o.total_estimated_price, 'completed',
       NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'
FROM orders o
JOIN accounts a ON a.email = 'driver1@example.com'
JOIN profiles drv ON drv.id = a.id
WHERE o.derived_status = 'completed' AND o.cargo_name = 'Furniture Set'
AND NOT EXISTS (SELECT 1 FROM order_shipments os WHERE os.order_id = o.id AND os.shipment_index = 1);

-- Trip stops for shipment 2
INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone, completed_at)
SELECT os.id, 1, 'pickup', '789 Tran Hung Dao, HCMC', 'Tran Van Binh', '0987654323', NOW() - INTERVAL '2 days'
FROM order_shipments os JOIN orders o ON o.id = os.order_id
WHERE o.cargo_name = 'Furniture Set' AND os.shipment_index = 1
AND NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.shipment_id = os.id AND ts.stop_index = 1);

INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, completed_at)
SELECT os.id, 2, 'delivery', '321 Nguyen Trai, HCMC', NOW() - INTERVAL '1 day'
FROM order_shipments os JOIN orders o ON o.id = os.order_id
WHERE o.cargo_name = 'Furniture Set' AND os.shipment_index = 1
AND NOT EXISTS (SELECT 1 FROM trip_stops ts WHERE ts.shipment_id = os.id AND ts.stop_index = 2);

--------------------------------------------------------------------------------
-- 12. SHIPMENT ASSIGNMENTS (coordinator_assign records for order 1)
--------------------------------------------------------------------------------
INSERT INTO shipment_assignments (shipment_id, driver_id, vehicle_id, assignment_type, assigned_at)
SELECT os.id, p.id, v.id, 'coordinator_assign', NOW()
FROM order_shipments os
JOIN profiles p ON p.role_id = (SELECT id FROM roles WHERE name = 'driver')
JOIN accounts a ON a.id = p.id AND a.email = 'driver1@example.com'
JOIN vehicles v ON v.plate_number = '51-A12345'
WHERE os.status = 'available'
AND NOT EXISTS (SELECT 1 FROM shipment_assignments sa WHERE sa.shipment_id = os.id)
LIMIT 1;

--------------------------------------------------------------------------------
-- 13. BONUS RULES
--------------------------------------------------------------------------------
INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_amount, conditions_json)
SELECT (SELECT id FROM vehicle_groups WHERE price_per_km = 10000), 'Small Van Weekly Bonus', 'kpi', 500000, '{"description":"Complete 10 trips without incident"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Small Van Weekly Bonus');

INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_amount, conditions_json)
SELECT (SELECT id FROM vehicle_groups WHERE price_per_km = 15000), 'Medium Truck Monthly Bonus', 'kpi', 2000000, '{"description":"Complete 50 trips with 95%+ on-time rate"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Medium Truck Monthly Bonus');

INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_amount, conditions_json)
SELECT (SELECT id FROM vehicle_groups WHERE price_per_km = 25000), 'Large Truck Monthly Bonus', 'kpi', 3000000, '{"description":"Complete 40 trips with 98%+ on-time rate"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM bonus_rules WHERE title = 'Large Truck Monthly Bonus');

--------------------------------------------------------------------------------
-- 14. DRIVER PERFORMANCE / KPI RECORDS
--------------------------------------------------------------------------------
INSERT INTO kpi_records (driver_id, vehicle_group_id, month, year, completed_shipments, total_revenue, late_deliveries)
SELECT p.id, (SELECT id FROM vehicle_groups WHERE price_per_km = 10000), 5, 2026, 12, 15000000, 1
FROM profiles p
JOIN accounts a ON a.id = p.id
WHERE p.role_id = (SELECT id FROM roles WHERE name = 'driver') AND a.email = 'driver1@example.com'
ON CONFLICT DO NOTHING;

--------------------------------------------------------------------------------
-- 15. MAINTENANCE MANAGEMENT
--------------------------------------------------------------------------------
INSERT INTO maintenance_records (vehicle_id, maintenance_type, description, cost, maintenance_date)
SELECT v.id, 'scheduled', 'Oil change, filter replacement', 500000, '2026-05-15'
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
