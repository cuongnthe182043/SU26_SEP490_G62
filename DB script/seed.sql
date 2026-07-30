-- Seed tháng 6 + 7/2026. Sinh bởi script — mọi số tiền được TÍNH từ km × đơn giá,
-- không gõ tay. Xem gen_seed.py để biết cách suy ra từng con số.

INSERT INTO accounts (id, email, password_hash, role_id, is_active) VALUES
    (100000, 'anhdv76@gmail.com', crypt('Admin@1234',  gen_salt('bf')), (SELECT id FROM roles WHERE name = 'manager'),     TRUE),
    (100001, 'cuongnt@gmail.com', crypt('Coord@1234',  gen_salt('bf')), (SELECT id FROM roles WHERE name = 'coordinator'), TRUE),
    (100002, 'hoangtm@gmail.com', crypt('Acct@1234',   gen_salt('bf')), (SELECT id FROM roles WHERE name = 'accountant'),  TRUE),
    (100003, 'tienpv@gmail.com',  crypt('Driver@1234', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'driver'),      TRUE),
    (100004, 'quanhm@gmail.com',  crypt('Driver@1234', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'driver'),      TRUE),
    (100005, 'phuocdh@gmail.com', crypt('Driver@1234', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'driver'),      TRUE),
    (100006, 'sonlt@gmail.com',   crypt('Driver@1234', gen_salt('bf')), (SELECT id FROM roles WHERE name = 'driver'),      TRUE);

INSERT INTO profiles (id, full_name, phone, role_id, dob, gender, national_id, address, city, country, emergency_contact_name, emergency_contact_phone, notes) VALUES
    (100000, 'Đỗ Việt Anh',       '0901000001', (SELECT id FROM roles WHERE name = 'manager'),     '1985-04-12', 'male',   '079185000111', '12 Nguyễn Huệ, Quận 1',      'Hồ Chí Minh', 'VN', 'Nguyễn Thị Hoa', '0908000001', 'Giám đốc điều hành'),
    (100001, 'Nguyễn Thế Cương',  '0901000002', (SELECT id FROM roles WHERE name = 'coordinator'), '1992-09-21', 'male',   '079192000222', '88 Lê Lợi, Quận 3',          'Hồ Chí Minh', 'VN', 'Nguyễn Văn Phúc','0908000002', 'Điều phối viên'),
    (100002, 'Triệu Minh Hoàng',  '0901000003', (SELECT id FROM roles WHERE name = 'accountant'),  '1991-03-14', 'male',   '079191000333', '25 Võ Thị Sáu, Quận 3',      'Hồ Chí Minh', 'VN', 'Triệu Minh Châu','0908000003', 'Kế toán tổng hợp'),
    (100003, 'Phạm Văn Tiền',     '0901000004', (SELECT id FROM roles WHERE name = 'driver'),      '1993-07-08', 'male',   '079193000444', '101 Trần Hưng Đạo, Thủ Đức', 'Hồ Chí Minh', 'VN', 'Phạm Thị Lan',   '0908000004', 'Tài xế xe cắt nóc'),
    (100004, 'Hoàng Minh Quân',   '0901000005', (SELECT id FROM roles WHERE name = 'driver'),      '1990-11-02', 'male',   '079190000555', '55 Hùng Vương, Quận 5',      'Hồ Chí Minh', 'VN', 'Hoàng Thị Hạnh', '0908000005', 'Tài xế xe 3 tấn'),
    (100005, 'Đỗ Hữu Phước',      '0901000006', (SELECT id FROM roles WHERE name = 'driver'),      '1996-01-18', 'male',   '079196000666', '7 Nguyễn Văn Cừ, Quận 5',    'Hồ Chí Minh', 'VN', 'Đỗ Quốc Minh',   '0908000006', 'Tài xế xe 5m2'),
    (100006, 'Lê Thanh Sơn',      '0901000007', (SELECT id FROM roles WHERE name = 'driver'),      '1995-05-30', 'male',   '079195000777', '210 Phan Văn Trị, Gò Vấp',   'Hồ Chí Minh', 'VN', 'Lê Thị Mai',     '0908000007', 'Tài xế xe cắt nóc (xe thứ 2)');

INSERT INTO vehicle_groups (id, name, description, max_load_weight_kg, price_per_km) VALUES
    (100000, 'Xe cắt nóc', 'Xe tải nhẹ cắt nóc, chở hàng cồng kềnh nội thành', 2000, 10000),
    (100001, 'Xe 3 tấn (4m3)', 'Xe tải 3 tấn thùng 4m3', 3000, 15000),
    (100002, 'Xe 5m2', 'Xe tải thùng dài 5m2', 7000, 20000),
    (100003, 'Xe 7m4', 'Xe tải thùng dài 7m4, tuyến liên tỉnh', 10000, 30000);

INSERT INTO vehicles (id, plate_number, vehicle_group_id, brand, model, load_capacity_kg, manufacture_year, purchase_date, assigned_driver_id, status) VALUES
    (100000, '51C-123.45', 100000, 'Suzuki', 'Carry Pro', 1900, 2022, DATE '2022-06-10', 100003, 'active'),
    (100001, '51D-678.90', 100001, 'Isuzu', 'QKR 230', 3000, 2021, DATE '2021-09-15', 100004, 'active'),
    (100002, '51E-246.80', 100002, 'Hino', 'XZU 342L', 6800, 2023, DATE '2023-02-20', 100005, 'active'),
    (100003, '51F-135.79', 100003, 'Hyundai', 'Mighty EX8', 9500, 2022, DATE '2022-11-05', NULL, 'active'),
    (100004, '51H-889.12', 100000, 'Thaco', 'Towner 990', 1900, 2023, DATE '2023-08-12', 100006, 'active');

INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, license_expiry_date, hire_date, revenue_share_percent, emergency_contact_name, emergency_contact_phone) VALUES
    (100003, 100000, 100000, 'DL-0123456', DATE '2029-12-31', DATE '2023-03-01', 15.0, 'Người thân Tiền', '0908000004'),
    (100004, 100001, 100001, 'DL-0234567', DATE '2029-12-31', DATE '2024-05-15', 15.0, 'Người thân Quân', '0908000005'),
    (100005, 100002, 100002, 'DL-0345678', DATE '2029-12-31', DATE '2025-11-01', 15.0, 'Người thân Phước', '0908000006'),
    (100006, 100004, 100000, 'DL-0456789', DATE '2029-12-31', DATE '2025-09-20', 15.0, 'Người thân Sơn', '0908000007');

INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_amount, conditions_json) VALUES
    (100000, 'Thưởng vượt KPI — Xe cắt nóc',                'kpi',         2000000, '{"min_revenue": 6000000}'::jsonb),
    (100001, 'Thưởng vượt KPI — Xe 3 tấn (4m3)',            'kpi',         2000000, '{"min_revenue": 6000000}'::jsonb),
    (100002, 'Thưởng vượt KPI — Xe 5m2',                    'kpi',         2000000, '{"min_revenue": 8000000}'::jsonb),
    (100003, 'Thưởng vượt KPI — Xe 7m4',                    'kpi',         2000000, '{"min_revenue": 12000000}'::jsonb),
    (100000, 'Lái xe xuất sắc nhất tháng — Xe cắt nóc',     'top_revenue', 1000000, '{"rank": 1}'::jsonb),
    (100001, 'Lái xe xuất sắc nhất tháng — Xe 3 tấn (4m3)', 'top_revenue', 1000000, '{"rank": 1}'::jsonb),
    (100002, 'Lái xe xuất sắc nhất tháng — Xe 5m2',         'top_revenue', 1000000, '{"rank": 1}'::jsonb),
    (100003, 'Lái xe xuất sắc nhất tháng — Xe 7m4',         'top_revenue', 1000000, '{"rank": 1}'::jsonb);

INSERT INTO customers (id, customer_type, full_name, company_name, contact_person, phone, email, address, tax_code, notes) VALUES
    (100000, 'individual', 'Nguyễn Hoàng An', NULL,                            'Nguyễn Hoàng An', '0987000001', 'hoangan@gmail.com',  '123 Nguyễn Huệ, Quận 1, TP.HCM',    NULL,         'Khách cá nhân, giao nội thành, trả tiền mặt'),
    (100001, 'business',   NULL, 'Công ty TNHH Thực phẩm Sài Gòn',            'Ms. Lan',         '0987000002', 'lan@saigonfoods.vn', '456 Lê Lợi, Quận 1, TP.HCM',        '0312345678', 'Hàng thực phẩm khô, thanh toán chuyển khoản'),
    (100002, 'business',   NULL, 'Công ty CP Nội thất Mộc Việt',              'Mr. Hùng',        '0987000003', 'hung@mocviet.vn',    '321 Nguyễn Trãi, Quận 5, TP.HCM',   '0309876543', 'Nội thất cồng kềnh, công nợ 30 ngày'),
    (100003, 'individual', 'Trần Thị Bích', NULL,                             'Trần Thị Bích',   '0987000004', 'bichtran@gmail.com', '789 Trần Hưng Đạo, Quận 5, TP.HCM', NULL,         'Khách cá nhân, chuyển nhà trọn gói');

INSERT INTO partners (id, company_name, short_name, contact_person, phone, email, address, tax_code, business_registration_number, payment_term_days, bank_name, bank_account_number, bank_account_name, notes) VALUES
    (100000, 'Công ty TNHH Vận tải Tân Cảng', 'Tân Cảng Express',   'Mr. Tuấn', '0912000001', 'tuan@tancang.vn',    '100 Pasteur, Quận 1, TP.HCM',        '0314000001', '0314000001-001', 30, 'Vietcombank', '0011008899001', 'CTY TNHH VAN TAI TAN CANG', 'Đối tác thuê xe khi quá tải'),
    (100001, 'Công ty CP Giao nhận Miền Nam', 'Southern Logistics', 'Ms. Hoa',  '0912000002', 'hoa@southernlog.vn', '200 Nguyễn Văn Linh, Quận 7, TP.HCM','0314000002', '0314000002-002', 15, 'ACB',         '220055667788',  'CTY CP GIAO NHAN MIEN NAM', 'Đối tác giao nhận liên tỉnh');

UPDATE company_info SET
    company_name        = 'Công ty TNHH Vận tải LogisCount',
    hotline             = '1900 1234',
    bank_name           = 'Vietcombank',
    bank_account_number = '0011002233445',
    bank_account_name   = 'CONG TY TNHH VAN TAI LOGISCOUNT',
    updated_by          = 100000
WHERE id = 1;

INSERT INTO company_holidays (holiday_date, name) VALUES
    (DATE '2026-06-01', 'Nghỉ bù Quốc tế Lao động'),
    (DATE '2026-07-20', 'Ngày truyền thống công ty');

INSERT INTO orders (id, customer_id, created_by, partner_id, cargo_name, cargo_weight_kg, payment_type, total_estimated_price, prepaid_amount, prepaid_status, prepaid_method, prepaid_confirmed_by, prepaid_confirmed_at, derived_status, notes, created_at, updated_at) VALUES
    (100000, 100001, 100001, NULL, 'Thực phẩm khô đóng thùng', 800, 'bank_transfer', 2400000, 0, 'none', NULL, NULL, NULL, 'completed', 'Giao kho Quận 7', TIMESTAMPTZ '2026-06-05 06:30:00+07', TIMESTAMPTZ '2026-06-05 17:00:00+07'),
    (100001, 100000, 100001, NULL, 'Đồ gia dụng', 1500, 'cash', 3000000, 0, 'none', NULL, NULL, NULL, 'completed', 'Khách trả tiền mặt cho tài xế', TIMESTAMPTZ '2026-06-10 06:30:00+07', TIMESTAMPTZ '2026-06-10 17:00:00+07'),
    (100002, 100002, 100001, NULL, 'Bàn ghế gỗ xuất khẩu', 4500, 'client_credit', 5200000, 0, 'none', NULL, NULL, NULL, 'completed', 'Công nợ 30 ngày theo hợp đồng', TIMESTAMPTZ '2026-06-18 06:30:00+07', TIMESTAMPTZ '2026-06-18 17:00:00+07'),
    (100003, 100003, 100001, NULL, 'Đồ đạc chuyển nhà', 900, 'cash', 1700000, 0, 'none', NULL, NULL, NULL, 'completed', 'Chuyển nhà trọn gói Quận 5 → Thủ Đức', TIMESTAMPTZ '2026-06-22 06:30:00+07', TIMESTAMPTZ '2026-06-22 17:00:00+07'),
    (100004, 100001, 100001, NULL, 'Hồ sơ lưu trữ (2 đợt)', 2300, 'bank_transfer', 2300000, 0, 'none', NULL, NULL, NULL, 'completed', 'Chia 2 chuyến, 2 tài xế chạy song song', TIMESTAMPTZ '2026-06-25 06:30:00+07', TIMESTAMPTZ '2026-06-26 17:00:00+07'),
    (100005, 100000, 100001, NULL, 'Thiết bị điện tử', 950, 'cash', 1600000, 0, 'none', NULL, NULL, NULL, 'completed', 'Giao gấp trong ngày', TIMESTAMPTZ '2026-06-28 06:30:00+07', TIMESTAMPTZ '2026-06-28 17:00:00+07'),
    (100006, 100000, 100001, NULL, 'Máy CNC mini', 3800, 'cash', 4000000, 0, 'none', NULL, NULL, NULL, 'completed', 'Khách không nhận — hoàn hàng, thu phí chở về', TIMESTAMPTZ '2026-06-29 06:30:00+07', TIMESTAMPTZ '2026-06-29 17:00:00+07'),
    (100007, 100001, 100001, NULL, 'Gia vị & nguyên liệu bếp', 700, 'bank_transfer', 1900000, 0, 'none', NULL, NULL, NULL, 'completed', 'Giao siêu thị Gò Vấp', TIMESTAMPTZ '2026-07-08 06:30:00+07', TIMESTAMPTZ '2026-07-08 17:00:00+07'),
    (100008, 100000, 100001, NULL, 'Máy móc gia công nhỏ', 3200, 'cash', 3800000, 0, 'none', NULL, NULL, NULL, 'completed', 'Hàng nặng, cần xe 5m2', TIMESTAMPTZ '2026-07-12 06:30:00+07', TIMESTAMPTZ '2026-07-12 17:00:00+07'),
    (100009, 100002, 100001, NULL, 'Vật tư xây dựng', 2800, 'client_credit', 3450000, 0, 'none', NULL, NULL, NULL, 'completed', 'Công nợ 30 ngày, giao công trường', TIMESTAMPTZ '2026-07-14 06:30:00+07', TIMESTAMPTZ '2026-07-14 17:00:00+07'),
    (100010, 100003, 100001, NULL, 'Kho lưu trữ (2 đợt)', 1650, 'cash', 2000000, 0, 'none', NULL, NULL, NULL, 'completed', 'Chia 2 chuyến cùng 1 tài, chạy tuần tự', TIMESTAMPTZ '2026-07-18 06:30:00+07', TIMESTAMPTZ '2026-07-20 17:00:00+07'),
    (100011, 100001, 100001, NULL, 'Hàng liên tỉnh Đà Nẵng', 6500, 'bank_transfer', 6400000, 5000000, 'confirmed', 'bank_transfer', 100002, TIMESTAMPTZ '2026-07-22 08:00:00+07', 'completed', 'Tuyến liên tỉnh, khách trả trước 5 triệu', TIMESTAMPTZ '2026-07-22 06:30:00+07', TIMESTAMPTZ '2026-07-22 17:00:00+07'),
    (100012, 100002, 100001, 100000, 'Nội thất văn phòng (2 đợt)', 5000, 'bank_transfer', 4350000, 0, 'none', NULL, NULL, NULL, 'open', 'Đơn đối tác Tân Cảng, chia 2 chuyến', TIMESTAMPTZ '2026-07-26 06:30:00+07', TIMESTAMPTZ '2026-07-26 17:00:00+07'),
    (100013, 100003, 100001, NULL, 'Tủ lạnh + máy giặt', 400, 'cash', 1500000, 0, 'none', NULL, NULL, NULL, 'open', 'Chờ tài xế nhận chuyến', TIMESTAMPTZ '2026-07-27 06:30:00+07', TIMESTAMPTZ '2026-07-27 17:00:00+07');

INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, actual_distance_km, actual_price, cargo_name, cargo_weight_kg, status, cancel_reason, return_charge_type, return_fee, failed_resolved_by, failed_resolved_at, claimed_at, picking_at, transit_at, arrived_at, failed_at, returning_at, completed_at, created_at, updated_at) VALUES
    (100000, 100000, 1, 100000, 2400000, 240, 250, 2500000, 'Thực phẩm khô đóng thùng', 800, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-05 07:00:00+07', TIMESTAMPTZ '2026-06-05 07:40:00+07', TIMESTAMPTZ '2026-06-05 09:00:00+07', TIMESTAMPTZ '2026-06-05 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-05 16:30:00+07', TIMESTAMPTZ '2026-06-05 06:30:00+07', TIMESTAMPTZ '2026-06-05 18:30:00+07'),
    (100001, 100001, 1, 100001, 3000000, 200, 210, 3150000, 'Đồ gia dụng', 1500, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-10 07:00:00+07', TIMESTAMPTZ '2026-06-10 07:40:00+07', TIMESTAMPTZ '2026-06-10 09:00:00+07', TIMESTAMPTZ '2026-06-10 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-10 16:30:00+07', TIMESTAMPTZ '2026-06-10 06:30:00+07', TIMESTAMPTZ '2026-06-10 18:30:00+07'),
    (100002, 100002, 1, 100002, 5200000, 260, 275, 5500000, 'Bàn ghế gỗ xuất khẩu', 4500, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-18 07:00:00+07', TIMESTAMPTZ '2026-06-18 07:40:00+07', TIMESTAMPTZ '2026-06-18 09:00:00+07', TIMESTAMPTZ '2026-06-18 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-18 16:30:00+07', TIMESTAMPTZ '2026-06-18 06:30:00+07', TIMESTAMPTZ '2026-06-18 18:30:00+07'),
    (100003, 100003, 1, 100000, 1700000, 170, 180, 1800000, 'Đồ đạc chuyển nhà', 900, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-22 07:00:00+07', TIMESTAMPTZ '2026-06-22 07:40:00+07', TIMESTAMPTZ '2026-06-22 09:00:00+07', TIMESTAMPTZ '2026-06-22 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-22 16:30:00+07', TIMESTAMPTZ '2026-06-22 06:30:00+07', TIMESTAMPTZ '2026-06-22 18:30:00+07'),
    (100004, 100004, 1, 100000, 1200000, 120, 130, 1300000, 'Hồ sơ lưu trữ đợt 1', 1200, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-25 07:00:00+07', TIMESTAMPTZ '2026-06-25 07:40:00+07', TIMESTAMPTZ '2026-06-25 09:00:00+07', TIMESTAMPTZ '2026-06-25 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-25 16:30:00+07', TIMESTAMPTZ '2026-06-25 06:30:00+07', TIMESTAMPTZ '2026-06-25 18:30:00+07'),
    (100005, 100004, 2, 100000, 1100000, 110, 115, 1150000, 'Hồ sơ lưu trữ đợt 2', 1100, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-26 07:00:00+07', TIMESTAMPTZ '2026-06-26 07:40:00+07', TIMESTAMPTZ '2026-06-26 09:00:00+07', TIMESTAMPTZ '2026-06-26 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-26 16:30:00+07', TIMESTAMPTZ '2026-06-26 06:30:00+07', TIMESTAMPTZ '2026-06-26 18:30:00+07'),
    (100006, 100005, 1, 100000, 1600000, 160, 165, 1650000, 'Thiết bị điện tử', 950, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-06-28 07:00:00+07', TIMESTAMPTZ '2026-06-28 07:40:00+07', TIMESTAMPTZ '2026-06-28 09:00:00+07', TIMESTAMPTZ '2026-06-28 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-06-28 16:30:00+07', TIMESTAMPTZ '2026-06-28 06:30:00+07', TIMESTAMPTZ '2026-06-28 18:30:00+07'),
    (100007, 100006, 1, 100002, 4000000, 200, 205, 400000, 'Máy CNC mini', 3800, 'completed', 'Khách không có mặt nhận hàng, liên hệ 3 lần không được', 'return_fee', 400000, 100001, TIMESTAMPTZ '2026-06-29 15:45:00+07', TIMESTAMPTZ '2026-06-29 07:00:00+07', TIMESTAMPTZ '2026-06-29 07:40:00+07', TIMESTAMPTZ '2026-06-29 09:00:00+07', TIMESTAMPTZ '2026-06-29 15:00:00+07', TIMESTAMPTZ '2026-06-29 15:20:00+07', TIMESTAMPTZ '2026-06-29 15:50:00+07', TIMESTAMPTZ '2026-06-29 18:30:00+07', TIMESTAMPTZ '2026-06-29 06:30:00+07', TIMESTAMPTZ '2026-06-29 18:30:00+07'),
    (100008, 100007, 1, 100000, 1900000, 190, 200, 2000000, 'Gia vị & nguyên liệu bếp', 700, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-08 07:00:00+07', TIMESTAMPTZ '2026-07-08 07:40:00+07', TIMESTAMPTZ '2026-07-08 09:00:00+07', TIMESTAMPTZ '2026-07-08 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-08 16:30:00+07', TIMESTAMPTZ '2026-07-08 06:30:00+07', TIMESTAMPTZ '2026-07-08 18:30:00+07'),
    (100009, 100008, 1, 100002, 3800000, 190, 200, 4000000, 'Máy móc gia công nhỏ', 3200, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-12 07:00:00+07', TIMESTAMPTZ '2026-07-12 07:40:00+07', TIMESTAMPTZ '2026-07-12 09:00:00+07', TIMESTAMPTZ '2026-07-12 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-12 16:30:00+07', TIMESTAMPTZ '2026-07-12 06:30:00+07', TIMESTAMPTZ '2026-07-12 18:30:00+07'),
    (100010, 100009, 1, 100001, 3450000, 230, 240, 3600000, 'Vật tư xây dựng', 2800, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-14 07:00:00+07', TIMESTAMPTZ '2026-07-14 07:40:00+07', TIMESTAMPTZ '2026-07-14 09:00:00+07', TIMESTAMPTZ '2026-07-14 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-14 16:30:00+07', TIMESTAMPTZ '2026-07-14 06:30:00+07', TIMESTAMPTZ '2026-07-14 18:30:00+07'),
    (100011, 100010, 1, 100000, 1000000, 100, 105, 1050000, 'Kho lưu trữ đợt 1', 800, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-18 07:00:00+07', TIMESTAMPTZ '2026-07-18 07:40:00+07', TIMESTAMPTZ '2026-07-18 09:00:00+07', TIMESTAMPTZ '2026-07-18 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-18 16:30:00+07', TIMESTAMPTZ '2026-07-18 06:30:00+07', TIMESTAMPTZ '2026-07-18 18:30:00+07'),
    (100012, 100010, 2, 100000, 1000000, 100, 108, 1080000, 'Kho lưu trữ đợt 2', 850, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-20 07:00:00+07', TIMESTAMPTZ '2026-07-20 07:40:00+07', TIMESTAMPTZ '2026-07-20 09:00:00+07', TIMESTAMPTZ '2026-07-20 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-20 16:30:00+07', TIMESTAMPTZ '2026-07-20 06:30:00+07', TIMESTAMPTZ '2026-07-20 18:30:00+07'),
    (100013, 100011, 1, 100002, 6400000, 320, 330, 6600000, 'Hàng liên tỉnh Đà Nẵng', 6500, 'completed', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-22 07:00:00+07', TIMESTAMPTZ '2026-07-22 07:40:00+07', TIMESTAMPTZ '2026-07-22 09:00:00+07', TIMESTAMPTZ '2026-07-22 15:00:00+07', NULL, NULL, TIMESTAMPTZ '2026-07-22 16:30:00+07', TIMESTAMPTZ '2026-07-22 06:30:00+07', TIMESTAMPTZ '2026-07-22 18:30:00+07'),
    (100014, 100012, 1, 100001, 2250000, 150, NULL, NULL, 'Nội thất văn phòng đợt 1', 2600, 'transit', NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-26 08:00:00+07', TIMESTAMPTZ '2026-07-26 08:30:00+07', TIMESTAMPTZ '2026-07-26 09:15:00+07', NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-26 06:30:00+07', TIMESTAMPTZ '2026-07-26 18:30:00+07'),
    (100015, 100012, 2, 100001, 2100000, 140, NULL, NULL, 'Nội thất văn phòng đợt 2', 2400, 'available', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-26 06:30:00+07', TIMESTAMPTZ '2026-07-26 18:30:00+07'),
    (100016, 100013, 1, 100000, 1500000, 150, NULL, NULL, 'Tủ lạnh + máy giặt', 400, 'available', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-27 06:30:00+07', TIMESTAMPTZ '2026-07-27 18:30:00+07');

INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone, arrived_at, completed_at) VALUES
    (100000, 1, 'pickup',   '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Nguyễn Hoàng An', '0987000001', TIMESTAMPTZ '2026-06-05 07:30:00+07', TIMESTAMPTZ '2026-06-05 08:50:00+07'),
    (100000, 2, 'delivery', 'Kho lạnh Quận 7, 15 Nguyễn Thị Thập, TP.HCM', 'Người nhận hàng', '0912345100', TIMESTAMPTZ '2026-06-05 15:00:00+07', TIMESTAMPTZ '2026-06-05 15:10:00+07'),
    (100001, 1, 'pickup',   'Kho Saigon Foods, 456 Lê Lợi, Quận 1, TP.HCM', 'Ms. Lan', '0987000002', TIMESTAMPTZ '2026-06-10 07:30:00+07', TIMESTAMPTZ '2026-06-10 08:50:00+07'),
    (100001, 2, 'delivery', '45 Quốc lộ 51, Long Thành, Đồng Nai', 'Người nhận hàng', '0912345101', TIMESTAMPTZ '2026-06-10 15:00:00+07', TIMESTAMPTZ '2026-06-10 15:10:00+07'),
    (100002, 1, 'pickup',   'Xưởng Mộc Việt, 321 Nguyễn Trãi, Quận 5, TP.HCM', 'Mr. Hùng', '0987000003', TIMESTAMPTZ '2026-06-18 07:30:00+07', TIMESTAMPTZ '2026-06-18 08:50:00+07'),
    (100002, 2, 'delivery', 'Cảng Cát Lái, Thủ Đức, TP.HCM', 'Người nhận hàng', '0912345102', TIMESTAMPTZ '2026-06-18 15:00:00+07', TIMESTAMPTZ '2026-06-18 15:10:00+07'),
    (100003, 1, 'pickup',   '789 Trần Hưng Đạo, Quận 5, TP.HCM', 'Trần Thị Bích', '0987000004', TIMESTAMPTZ '2026-06-22 07:30:00+07', TIMESTAMPTZ '2026-06-22 08:50:00+07'),
    (100003, 2, 'delivery', 'Chung cư Vinhomes Grand Park, Thủ Đức, TP.HCM', 'Người nhận hàng', '0912345103', TIMESTAMPTZ '2026-06-22 15:00:00+07', TIMESTAMPTZ '2026-06-22 15:10:00+07'),
    (100004, 1, 'pickup',   '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Nguyễn Hoàng An', '0987000001', TIMESTAMPTZ '2026-06-25 07:30:00+07', TIMESTAMPTZ '2026-06-25 08:50:00+07'),
    (100004, 2, 'delivery', 'Siêu thị BigC Gò Vấp, TP.HCM', 'Người nhận hàng', '0912345104', TIMESTAMPTZ '2026-06-25 15:00:00+07', TIMESTAMPTZ '2026-06-25 15:10:00+07'),
    (100005, 1, 'pickup',   '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Nguyễn Hoàng An', '0987000001', TIMESTAMPTZ '2026-06-26 07:30:00+07', TIMESTAMPTZ '2026-06-26 08:50:00+07'),
    (100005, 2, 'delivery', 'KCN Sóng Thần, Dĩ An, Bình Dương', 'Người nhận hàng', '0912345105', TIMESTAMPTZ '2026-06-26 15:00:00+07', TIMESTAMPTZ '2026-06-26 15:10:00+07'),
    (100006, 1, 'pickup',   'Kho Saigon Foods, 456 Lê Lợi, Quận 1, TP.HCM', 'Ms. Lan', '0987000002', TIMESTAMPTZ '2026-06-28 07:30:00+07', TIMESTAMPTZ '2026-06-28 08:50:00+07'),
    (100006, 2, 'delivery', 'Tòa nhà Bitexco, 2 Hải Triều, Quận 1, TP.HCM', 'Người nhận hàng', '0912345106', TIMESTAMPTZ '2026-06-28 15:00:00+07', TIMESTAMPTZ '2026-06-28 15:10:00+07'),
    (100007, 1, 'pickup',   'Kho Saigon Foods, 456 Lê Lợi, Quận 1, TP.HCM', 'Ms. Lan', '0987000002', TIMESTAMPTZ '2026-06-29 07:30:00+07', TIMESTAMPTZ '2026-06-29 08:50:00+07'),
    (100007, 2, 'delivery', 'KCN Hòa Khánh, Đà Nẵng', 'Người nhận hàng', '0912345107', TIMESTAMPTZ '2026-06-29 15:00:00+07', NULL),
    (100008, 1, 'pickup',   '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Nguyễn Hoàng An', '0987000001', TIMESTAMPTZ '2026-07-08 07:30:00+07', TIMESTAMPTZ '2026-07-08 08:50:00+07'),
    (100008, 2, 'delivery', 'Kho lạnh Quận 7, 15 Nguyễn Thị Thập, TP.HCM', 'Người nhận hàng', '0912345108', TIMESTAMPTZ '2026-07-08 15:00:00+07', TIMESTAMPTZ '2026-07-08 15:10:00+07'),
    (100009, 1, 'pickup',   'Kho Saigon Foods, 456 Lê Lợi, Quận 1, TP.HCM', 'Ms. Lan', '0987000002', TIMESTAMPTZ '2026-07-12 07:30:00+07', TIMESTAMPTZ '2026-07-12 08:50:00+07'),
    (100009, 2, 'delivery', '45 Quốc lộ 51, Long Thành, Đồng Nai', 'Người nhận hàng', '0912345109', TIMESTAMPTZ '2026-07-12 15:00:00+07', TIMESTAMPTZ '2026-07-12 15:10:00+07'),
    (100010, 1, 'pickup',   'Xưởng Mộc Việt, 321 Nguyễn Trãi, Quận 5, TP.HCM', 'Mr. Hùng', '0987000003', TIMESTAMPTZ '2026-07-14 07:30:00+07', TIMESTAMPTZ '2026-07-14 08:50:00+07'),
    (100010, 2, 'delivery', 'Cảng Cát Lái, Thủ Đức, TP.HCM', 'Người nhận hàng', '0912345110', TIMESTAMPTZ '2026-07-14 15:00:00+07', TIMESTAMPTZ '2026-07-14 15:10:00+07'),
    (100011, 1, 'pickup',   '789 Trần Hưng Đạo, Quận 5, TP.HCM', 'Trần Thị Bích', '0987000004', TIMESTAMPTZ '2026-07-18 07:30:00+07', TIMESTAMPTZ '2026-07-18 08:50:00+07'),
    (100011, 2, 'delivery', 'Chung cư Vinhomes Grand Park, Thủ Đức, TP.HCM', 'Người nhận hàng', '0912345111', TIMESTAMPTZ '2026-07-18 15:00:00+07', TIMESTAMPTZ '2026-07-18 15:10:00+07'),
    (100012, 1, 'pickup',   '789 Trần Hưng Đạo, Quận 5, TP.HCM', 'Trần Thị Bích', '0987000004', TIMESTAMPTZ '2026-07-20 07:30:00+07', TIMESTAMPTZ '2026-07-20 08:50:00+07'),
    (100012, 2, 'delivery', 'Siêu thị BigC Gò Vấp, TP.HCM', 'Người nhận hàng', '0912345112', TIMESTAMPTZ '2026-07-20 15:00:00+07', TIMESTAMPTZ '2026-07-20 15:10:00+07'),
    (100013, 1, 'pickup',   '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Nguyễn Hoàng An', '0987000001', TIMESTAMPTZ '2026-07-22 07:30:00+07', TIMESTAMPTZ '2026-07-22 08:50:00+07'),
    (100013, 2, 'delivery', 'KCN Sóng Thần, Dĩ An, Bình Dương', 'Người nhận hàng', '0912345113', TIMESTAMPTZ '2026-07-22 15:00:00+07', TIMESTAMPTZ '2026-07-22 15:10:00+07'),
    (100014, 1, 'pickup',   'Xưởng Mộc Việt, 321 Nguyễn Trãi, Quận 5, TP.HCM', 'Mr. Hùng', '0987000003', TIMESTAMPTZ '2026-07-26 07:30:00+07', TIMESTAMPTZ '2026-07-26 08:50:00+07'),
    (100014, 2, 'delivery', 'Tòa nhà Bitexco, 2 Hải Triều, Quận 1, TP.HCM', 'Người nhận hàng', '0912345114', NULL, NULL),
    (100015, 1, 'pickup',   'Xưởng Mộc Việt, 321 Nguyễn Trãi, Quận 5, TP.HCM', 'Mr. Hùng', '0987000003', NULL, NULL),
    (100015, 2, 'delivery', 'KCN Hòa Khánh, Đà Nẵng', 'Người nhận hàng', '0912345115', NULL, NULL),
    (100016, 1, 'pickup',   '789 Trần Hưng Đạo, Quận 5, TP.HCM', 'Trần Thị Bích', '0987000004', NULL, NULL),
    (100016, 2, 'delivery', 'Kho lạnh Quận 7, 15 Nguyễn Thị Thập, TP.HCM', 'Người nhận hàng', '0912345116', NULL, NULL);

INSERT INTO shipment_assignment_history (shipment_id, to_driver_id, to_vehicle_id, changed_by, change_reason, changed_at) VALUES
    (100000, 100003, 100000, 100003, 'self_claim', TIMESTAMPTZ '2026-06-05 07:00:00+07'),
    (100001, 100004, 100001, 100004, 'self_claim', TIMESTAMPTZ '2026-06-10 07:00:00+07'),
    (100002, 100005, 100002, 100005, 'self_claim', TIMESTAMPTZ '2026-06-18 07:00:00+07'),
    (100003, 100003, 100000, 100003, 'self_claim', TIMESTAMPTZ '2026-06-22 07:00:00+07'),
    (100004, 100003, 100000, 100003, 'self_claim', TIMESTAMPTZ '2026-06-25 07:00:00+07'),
    (100005, 100006, 100004, 100006, 'self_claim', TIMESTAMPTZ '2026-06-26 07:00:00+07'),
    (100006, 100006, 100004, 100006, 'self_claim', TIMESTAMPTZ '2026-06-28 07:00:00+07'),
    (100007, 100005, 100002, 100005, 'self_claim', TIMESTAMPTZ '2026-06-29 07:00:00+07'),
    (100008, 100003, 100000, 100003, 'self_claim', TIMESTAMPTZ '2026-07-08 07:00:00+07'),
    (100009, 100005, 100002, 100005, 'self_claim', TIMESTAMPTZ '2026-07-12 07:00:00+07'),
    (100010, 100004, 100001, 100004, 'self_claim', TIMESTAMPTZ '2026-07-14 07:00:00+07'),
    (100011, 100006, 100004, 100006, 'self_claim', TIMESTAMPTZ '2026-07-18 07:00:00+07'),
    (100012, 100006, 100004, 100006, 'self_claim', TIMESTAMPTZ '2026-07-20 07:00:00+07'),
    (100013, 100005, 100002, 100005, 'self_claim', TIMESTAMPTZ '2026-07-22 07:00:00+07'),
    (100014, 100004, 100001, 100004, 'self_claim', TIMESTAMPTZ '2026-07-26 07:00:00+07');

INSERT INTO shipment_revenue_allocations (shipment_id, driver_id, share_percent, allocation_reason, created_by) VALUES
    (100000, 100003, 100, 'default_owner', 100001),
    (100001, 100004, 100, 'default_owner', 100001),
    (100002, 100005, 100, 'default_owner', 100001),
    (100003, 100003, 100, 'default_owner', 100001),
    (100004, 100003, 100, 'default_owner', 100001),
    (100005, 100006, 100, 'default_owner', 100001),
    (100006, 100006, 100, 'default_owner', 100001),
    (100007, 100005, 100, 'default_owner', 100001),
    (100008, 100003, 100, 'default_owner', 100001),
    (100009, 100005, 100, 'default_owner', 100001),
    (100010, 100004, 100, 'default_owner', 100001),
    (100011, 100006, 100, 'default_owner', 100001),
    (100012, 100006, 100, 'default_owner', 100001),
    (100013, 100005, 100, 'default_owner', 100001);

INSERT INTO delivery_proofs (shipment_id, captured_by, file_url, is_realtime, captured_at) VALUES
    (100000, 100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-05 16:25:00+07'),
    (100001, 100004, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-10 16:25:00+07'),
    (100002, 100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-18 16:25:00+07'),
    (100003, 100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-22 16:25:00+07'),
    (100004, 100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-25 16:25:00+07'),
    (100005, 100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-26 16:25:00+07'),
    (100006, 100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-28 16:25:00+07'),
    (100007, 100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-06-29 18:20:00+07'),
    (100008, 100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-08 16:25:00+07'),
    (100009, 100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-12 16:25:00+07'),
    (100010, 100004, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-14 16:25:00+07'),
    (100011, 100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-18 16:25:00+07'),
    (100012, 100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-20 16:25:00+07'),
    (100013, 100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, TIMESTAMPTZ '2026-07-22 16:25:00+07');

INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, expense_type, amount, description, expense_date, status, reviewed_by, reviewed_at, reimbursement_status, created_at, updated_at) VALUES
    (100000, 100000, 100000, 100003, 'toll', 120000, 'Phí cầu đường cao tốc Long Thành', DATE '2026-06-05', 'approved', 100001, TIMESTAMPTZ '2026-06-05 17:00:00+07', 'pending', TIMESTAMPTZ '2026-06-05 16:00:00+07', TIMESTAMPTZ '2026-06-05 17:00:00+07'),
    (100001, 100003, 100000, 100003, 'fuel', 500000, 'Đổ dầu chuyến chuyển nhà', DATE '2026-06-22', 'approved', 100001, TIMESTAMPTZ '2026-06-22 17:00:00+07', 'pending', TIMESTAMPTZ '2026-06-22 16:00:00+07', TIMESTAMPTZ '2026-06-22 17:00:00+07'),
    (100002, 100002, 100002, 100005, 'toll', 180000, 'Phí cầu đường + phà Cát Lái', DATE '2026-06-18', 'approved', 100001, TIMESTAMPTZ '2026-06-18 17:00:00+07', 'pending', TIMESTAMPTZ '2026-06-18 16:00:00+07', TIMESTAMPTZ '2026-06-18 17:00:00+07'),
    (100003, 100006, 100004, 100006, 'parking', 80000, 'Phí đỗ xe hầm toà nhà', DATE '2026-06-28', 'approved', 100001, TIMESTAMPTZ '2026-06-28 17:00:00+07', 'pending', TIMESTAMPTZ '2026-06-28 16:00:00+07', TIMESTAMPTZ '2026-06-28 17:00:00+07'),
    (100004, 100009, 100002, 100005, 'fuel', 450000, 'Đổ dầu chuyến Bình Dương', DATE '2026-07-12', 'approved', 100001, TIMESTAMPTZ '2026-07-12 17:00:00+07', 'pending', TIMESTAMPTZ '2026-07-12 16:00:00+07', TIMESTAMPTZ '2026-07-12 17:00:00+07'),
    (100005, 100013, 100002, 100005, 'toll', 350000, 'Phí cao tốc tuyến Đà Nẵng', DATE '2026-07-22', 'approved', 100001, TIMESTAMPTZ '2026-07-22 17:00:00+07', 'pending', TIMESTAMPTZ '2026-07-22 16:00:00+07', TIMESTAMPTZ '2026-07-22 17:00:00+07'),
    (100006, 100010, 100001, 100004, 'etc', 150000, 'Phí thu không dừng tuyến QL13', DATE '2026-07-14', 'approved', 100001, TIMESTAMPTZ '2026-07-14 17:00:00+07', 'pending', TIMESTAMPTZ '2026-07-14 16:00:00+07', TIMESTAMPTZ '2026-07-14 17:00:00+07'),
    (100007, NULL, 100001, 100004, 'repair', 800000, 'Thay má phanh trước — chờ duyệt', DATE '2026-07-28', 'pending', NULL, NULL, NULL, TIMESTAMPTZ '2026-07-28 16:00:00+07', TIMESTAMPTZ '2026-07-28 17:00:00+07');

INSERT INTO expense_attachments (expense_id, file_url) VALUES
    (100000, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100001, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100002, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100004, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100007, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');

INSERT INTO order_receipt_requests (id, order_id, requesting_shipment_id, driver_id, driver_notes, status, requested_at, processed_by, processed_at, coordinator_notes) VALUES
    (100000, 100000, 100000, 100003, 'Km thực tế 250', 'approved', TIMESTAMPTZ '2026-06-05 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-05 17:30:00+07', 'Chốt 2,620,000đ'),
    (100001, 100001, 100001, 100004, 'Km thực tế 210', 'approved', TIMESTAMPTZ '2026-06-10 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-10 17:30:00+07', 'Chốt 3,150,000đ'),
    (100002, 100002, 100002, 100005, 'Km thực tế 275', 'approved', TIMESTAMPTZ '2026-06-18 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-18 17:30:00+07', 'Chốt 5,680,000đ'),
    (100003, 100003, 100003, 100003, 'Km thực tế 180', 'approved', TIMESTAMPTZ '2026-06-22 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-22 17:30:00+07', 'Chốt 1,800,000đ'),
    (100004, 100004, 100005, 100006, 'Km thực tế 115', 'approved', TIMESTAMPTZ '2026-06-26 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-26 17:30:00+07', 'Chốt 2,450,000đ'),
    (100005, 100005, 100006, 100006, 'Km thực tế 165', 'approved', TIMESTAMPTZ '2026-06-28 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-28 17:30:00+07', 'Chốt 1,730,000đ'),
    (100006, 100006, 100007, 100005, 'Km thực tế 205', 'approved', TIMESTAMPTZ '2026-06-29 17:05:00+07', 100001, TIMESTAMPTZ '2026-06-29 17:30:00+07', 'Chốt 400,000đ'),
    (100007, 100007, 100008, 100003, 'Km thực tế 200', 'approved', TIMESTAMPTZ '2026-07-08 17:05:00+07', 100001, TIMESTAMPTZ '2026-07-08 17:30:00+07', 'Chốt 2,000,000đ'),
    (100008, 100008, 100009, 100005, 'Km thực tế 200', 'approved', TIMESTAMPTZ '2026-07-12 17:05:00+07', 100001, TIMESTAMPTZ '2026-07-12 17:30:00+07', 'Chốt 4,000,000đ'),
    (100009, 100009, 100010, 100004, 'Km thực tế 240', 'approved', TIMESTAMPTZ '2026-07-14 17:05:00+07', 100001, TIMESTAMPTZ '2026-07-14 17:30:00+07', 'Chốt 3,750,000đ'),
    (100010, 100010, 100012, 100006, 'Km thực tế 108', 'approved', TIMESTAMPTZ '2026-07-20 17:05:00+07', 100001, TIMESTAMPTZ '2026-07-20 17:30:00+07', 'Chốt 2,130,000đ'),
    (100011, 100011, 100013, 100005, 'Km thực tế 330', 'approved', TIMESTAMPTZ '2026-07-22 17:05:00+07', 100001, TIMESTAMPTZ '2026-07-22 17:30:00+07', 'Chốt 6,950,000đ');

INSERT INTO shipment_receipts (id, shipment_id, payment_type, amount, collected_by, collected_at, notes, order_receipt_request_id, created_by) VALUES
    (100000, 100000, 'bank_transfer', 2620000, NULL, TIMESTAMPTZ '2026-06-05 17:30:00+07', 'Khách CK về công ty, kế toán đã xác nhận', 100000, 100001),
    (100001, 100001, 'cash_collected', 3150000, 100004, TIMESTAMPTZ '2026-06-10 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100001, 100001),
    (100002, 100002, 'client_credit', 5680000, NULL, TIMESTAMPTZ '2026-06-18 17:30:00+07', 'Khách nợ theo hợp đồng', 100002, 100001),
    (100003, 100003, 'cash_collected', 1800000, 100003, TIMESTAMPTZ '2026-06-22 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100003, 100001),
    (100004, 100005, 'bank_transfer', 2450000, NULL, TIMESTAMPTZ '2026-06-26 17:30:00+07', 'Khách CK về công ty, kế toán đã xác nhận', 100004, 100001),
    (100005, 100006, 'cash_collected', 1730000, 100006, TIMESTAMPTZ '2026-06-28 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100005, 100001),
    (100006, 100007, 'cash_collected', 400000, 100005, TIMESTAMPTZ '2026-06-29 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100006, 100001),
    (100007, 100008, 'bank_transfer', 2000000, NULL, TIMESTAMPTZ '2026-07-08 17:30:00+07', 'Khách CK về công ty, kế toán đã xác nhận', 100007, 100001),
    (100008, 100009, 'cash_collected', 4000000, 100005, TIMESTAMPTZ '2026-07-12 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100008, 100001),
    (100009, 100010, 'client_credit', 3750000, NULL, TIMESTAMPTZ '2026-07-14 17:30:00+07', 'Khách nợ theo hợp đồng', 100009, 100001),
    (100010, 100012, 'cash_collected', 2130000, 100006, TIMESTAMPTZ '2026-07-20 17:30:00+07', 'Tài xế thu tiền mặt của khách', 100010, 100001),
    (100011, 100013, 'bank_transfer', 6950000, NULL, TIMESTAMPTZ '2026-07-22 17:30:00+07', 'Khách CK về công ty, kế toán đã xác nhận', 100011, 100001);

INSERT INTO payment_receipts (payment_id, file_url) VALUES
    (100000, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100001, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100003, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100004, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100005, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100006, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100007, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100008, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100010, 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    (100011, 'https://res.cloudinary.com/demo/image/upload/sample.jpg');

INSERT INTO debts (id, debt_type, customer_id, driver_id, order_id, shipment_id, total_amount, due_date, notes, created_at, updated_at) VALUES
    (100000, 'driver', NULL, 100004, 100001, 100001, 3150000, DATE '2026-06-25', 'Thu hộ tiền mặt đơn #100001', TIMESTAMPTZ '2026-06-10 17:30:00+07', TIMESTAMPTZ '2026-06-10 17:30:00+07'),
    (100001, 'customer', 100002, NULL, 100002, 100002, 5680000, DATE '2026-07-03', 'Công nợ khách hàng đơn #100002', TIMESTAMPTZ '2026-06-18 17:30:00+07', TIMESTAMPTZ '2026-06-18 17:30:00+07'),
    (100002, 'driver', NULL, 100003, 100003, 100003, 1800000, DATE '2026-07-07', 'Thu hộ tiền mặt đơn #100003', TIMESTAMPTZ '2026-06-22 17:30:00+07', TIMESTAMPTZ '2026-06-22 17:30:00+07'),
    (100003, 'driver', NULL, 100006, 100005, 100006, 1730000, DATE '2026-07-13', 'Thu hộ tiền mặt đơn #100005', TIMESTAMPTZ '2026-06-28 17:30:00+07', TIMESTAMPTZ '2026-06-28 17:30:00+07'),
    (100004, 'driver', NULL, 100005, 100006, 100007, 400000, DATE '2026-07-14', 'Thu hộ tiền mặt đơn #100006', TIMESTAMPTZ '2026-06-29 17:30:00+07', TIMESTAMPTZ '2026-06-29 17:30:00+07'),
    (100005, 'driver', NULL, 100005, 100008, 100009, 4000000, DATE '2026-07-27', 'Thu hộ tiền mặt đơn #100008', TIMESTAMPTZ '2026-07-12 17:30:00+07', TIMESTAMPTZ '2026-07-12 17:30:00+07'),
    (100006, 'customer', 100002, NULL, 100009, 100010, 3750000, DATE '2026-08--1', 'Công nợ khách hàng đơn #100009', TIMESTAMPTZ '2026-07-14 17:30:00+07', TIMESTAMPTZ '2026-07-14 17:30:00+07'),
    (100007, 'driver', NULL, 100006, 100010, 100012, 2130000, DATE '2026-08-05', 'Thu hộ tiền mặt đơn #100010', TIMESTAMPTZ '2026-07-20 17:30:00+07', TIMESTAMPTZ '2026-07-20 17:30:00+07');

INSERT INTO debt_payments (debt_id, amount, payment_method, status, paid_at, confirmed_at, confirmed_by, created_by, notes) VALUES
    (100000, 2000000, 'cash', 'confirmed', TIMESTAMPTZ '2026-06-20 09:30:00+07', TIMESTAMPTZ '2026-06-20 10:00:00+07', 100002, 100004, 'Tài xế nộp tiền mặt đợt 1'),
    (100002, 1800000, 'cash', 'confirmed', TIMESTAMPTZ '2026-06-28 09:30:00+07', TIMESTAMPTZ '2026-06-28 10:00:00+07', 100002, 100003, 'Tài xế nộp đủ tiền thu hộ'),
    (100001, 2000000, 'bank_transfer', 'confirmed', TIMESTAMPTZ '2026-07-05 09:30:00+07', TIMESTAMPTZ '2026-07-05 10:00:00+07', 100002, 100002, 'Mộc Việt chuyển khoản trả nợ đợt 1'),
    (100003, 1730000, 'cash', 'confirmed', TIMESTAMPTZ '2026-06-30 09:30:00+07', TIMESTAMPTZ '2026-06-30 10:00:00+07', 100002, 100006, 'Tài xế nộp đủ tiền thu hộ'),
    (100004, 300000, 'cash', 'confirmed', TIMESTAMPTZ '2026-07-02 09:30:00+07', TIMESTAMPTZ '2026-07-02 10:00:00+07', 100002, 100005, 'Nộp một phần phí hoàn hàng');

INSERT INTO kpi_records (driver_id, vehicle_group_id, month, year, completed_shipments, total_revenue, incident_count, major_incident_count, critical_incident_count) VALUES
    (100003, 100000, 6, 2026, 3, 5600000, 0, 0, 0),
    (100004, 100001, 6, 2026, 1, 3150000, 1, 0, 0),
    (100005, 100002, 6, 2026, 2, 5900000, 1, 0, 0),
    (100006, 100000, 6, 2026, 2, 2800000, 0, 0, 0),
    (100003, 100000, 7, 2026, 1, 2000000, 0, 0, 0),
    (100004, 100001, 7, 2026, 1, 3600000, 0, 0, 0),
    (100005, 100002, 7, 2026, 2, 10600000, 1, 0, 0),
    (100006, 100000, 7, 2026, 2, 2130000, 0, 0, 0);

INSERT INTO incidents (shipment_id, vehicle_id, reported_by, incident_type, severity_level, description, location, status, resolved_by, resolution_note, occurred_at, resolved_at) VALUES
    (100001, 100001, 100004, 'traffic_jam', 'low', 'Kẹt xe kéo dài cao tốc Long Thành — Dầu Giây, trễ 1 tiếng', 'Cao tốc Long Thành, Km 15', 'resolved', 100001, 'Đã xử lý, thông báo khách', TIMESTAMPTZ '2026-06-10 10:00:00+07', TIMESTAMPTZ '2026-06-10 11:30:00+07'),
    (100007, 100002, 100005, 'customer_refusal', 'medium', 'Khách không có mặt, không liên lạc được — phải hoàn hàng', 'KCN Sóng Thần, Bình Dương', 'resolved', 100001, 'Đã xử lý, thông báo khách', TIMESTAMPTZ '2026-06-29 10:00:00+07', TIMESTAMPTZ '2026-06-29 11:30:00+07'),
    (100009, 100002, 100005, 'cargo_damage', 'medium', 'Một kiện máy bị trầy xước vỏ ngoài khi hạ hàng', 'KCN Sóng Thần, Bình Dương', 'open', NULL, NULL, TIMESTAMPTZ '2026-07-12 10:00:00+07', NULL);

INSERT INTO incident_evidences (incident_id, file_url) VALUES
    ((SELECT id FROM incidents WHERE shipment_id = 100001), 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    ((SELECT id FROM incidents WHERE shipment_id = 100007), 'https://res.cloudinary.com/demo/image/upload/sample.jpg'),
    ((SELECT id FROM incidents WHERE shipment_id = 100009), 'https://res.cloudinary.com/demo/image/upload/sample.jpg');

INSERT INTO leave_requests (driver_id, leave_date, leave_type, reason, status) VALUES
    (100005, DATE '2026-06-15', 'unpaid', 'Việc gia đình', 'approved'),
    (100005, DATE '2026-06-16', 'unpaid', 'Việc gia đình', 'approved'),
    (100003, DATE '2026-07-06', 'paid', 'Nghỉ phép định kỳ', 'approved'),
    (100006, DATE '2026-07-13', 'unpaid', 'Ốm', 'approved'),
    (100005, DATE '2026-07-23', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved'),
    (100005, DATE '2026-07-24', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved'),
    (100005, DATE '2026-07-25', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved'),
    (100005, DATE '2026-07-27', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved'),
    (100005, DATE '2026-07-28', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved'),
    (100005, DATE '2026-07-29', 'unpaid', 'Nghỉ dài về quê lo việc gia đình', 'approved');

INSERT INTO attendance_overrides (driver_id, work_date, status, notes, marked_by) VALUES
    (100004, DATE '2026-06-12', 'absent_unexcused', 'Không báo trước', 100001),
    (100006, DATE '2026-07-21', 'half_day', 'Sáng đi làm, chiều xin về', 100001);

INSERT INTO salary_advances (id, driver_id, amount, reason, request_month, request_year, status, approved_by, approved_at, paid_by, paid_at, reject_reason, created_at, updated_at) VALUES
    (100000, 100004, 3000000, 'Ứng lương lo việc gia đình', 6, 2026, 'paid',     100000, TIMESTAMPTZ '2026-06-25 09:00:00+07', 100002, TIMESTAMPTZ '2026-06-25 14:00:00+07', NULL, TIMESTAMPTZ '2026-06-25 08:00:00+07', TIMESTAMPTZ '2026-06-25 14:00:00+07'),
    (100001, 100005, 5000000, 'Ứng lương sửa nhà',          6, 2026, 'rejected', 100000, TIMESTAMPTZ '2026-06-25 10:00:00+07', NULL,   NULL, 'Mới vào làm, chưa đủ điều kiện ứng', TIMESTAMPTZ '2026-06-25 08:30:00+07', TIMESTAMPTZ '2026-06-25 10:00:00+07'),
    (100002, 100006, 2000000, 'Ứng lương đóng học phí con',  7, 2026, 'paid',     100000, TIMESTAMPTZ '2026-07-25 09:00:00+07', 100002, TIMESTAMPTZ '2026-07-25 15:00:00+07', NULL, TIMESTAMPTZ '2026-07-25 08:00:00+07', TIMESTAMPTZ '2026-07-25 15:00:00+07');

INSERT INTO driver_bonuses (driver_id, type, year, amount, notes, status, requested_by, approved_by, paid_by, requested_at, approved_at, paid_at) VALUES
    (100004, 'welfare_birthday', 2026, 200000, 'Sinh nhật tháng 6', 'paid',     100002, 100000, 100002, TIMESTAMPTZ '2026-06-20 09:00:00+07', TIMESTAMPTZ '2026-06-21 09:00:00+07', TIMESTAMPTZ '2026-06-30 09:00:00+07'),
    (100003, 'special',          2026, 500000, 'Thưởng giao hàng gấp cho khách VIP', 'approved', 100002, 100000, NULL, TIMESTAMPTZ '2026-07-10 09:00:00+07', TIMESTAMPTZ '2026-07-11 09:00:00+07', NULL),
    (100006, 'welfare_wedding',  2026, 1000000, 'Mừng cưới', 'pending',  100002, NULL, NULL, TIMESTAMPTZ '2026-07-24 09:00:00+07', NULL, NULL);

INSERT INTO payment_vouchers (id, voucher_type, amount, payee, reason, payment_method, status, created_by, approved_by, paid_by, approved_at, paid_at, created_at, updated_at) VALUES
    (100000, 'office',    1200000, 'Nhà sách Phương Nam', 'Mua giấy in, văn phòng phẩm quý 2',      'cash',          'paid',     100002, 100000, 100002, TIMESTAMPTZ '2026-06-15 09:00:00+07', TIMESTAMPTZ '2026-06-15 14:00:00+07', TIMESTAMPTZ '2026-06-14 15:00:00+07', TIMESTAMPTZ '2026-06-15 14:00:00+07'),
    (100001, 'utilities', 2500000, 'Điện lực TP.HCM',     'Tiền điện văn phòng + kho tháng 6/2026', 'bank_transfer', 'paid',     100002, 100000, 100002, TIMESTAMPTZ '2026-07-03 09:00:00+07', TIMESTAMPTZ '2026-07-04 10:00:00+07', TIMESTAMPTZ '2026-07-02 10:00:00+07', TIMESTAMPTZ '2026-07-04 10:00:00+07'),
    (100002, 'utilities', 2700000, 'Điện lực TP.HCM',     'Tiền điện văn phòng + kho tháng 7/2026', 'bank_transfer', 'pending',  100002, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-28 10:00:00+07', TIMESTAMPTZ '2026-07-28 10:00:00+07');

INSERT INTO maintenance_records (id, vehicle_id, maintenance_type, description, cost, maintenance_date, next_due_date, performed_by, status, bill_pics, started_at, completed_at, created_by, completed_by, verified_by, verified_at) VALUES
    (100000, 100000, 'scheduled', 'Bảo dưỡng định kỳ 10.000km — thay dầu, lọc gió', 1500000, DATE '2026-06-08', DATE '2026-09-08', 100003, 'completed',
        '["https://res.cloudinary.com/demo/image/upload/sample.jpg"]'::jsonb, TIMESTAMPTZ '2026-06-08 08:00:00+07', TIMESTAMPTZ '2026-06-08 15:00:00+07', 100000, 100003, 100000, TIMESTAMPTZ '2026-06-08 16:00:00+07'),
    (100001, 100002, 'repair',    'Thay bộ lốp sau bị nứt hông',                    3200000, DATE '2026-07-05', NULL,               100005, 'completed',
        '["https://res.cloudinary.com/demo/image/upload/sample.jpg"]'::jsonb, TIMESTAMPTZ '2026-07-05 08:00:00+07', TIMESTAMPTZ '2026-07-05 14:00:00+07', 100000, 100005, 100000, TIMESTAMPTZ '2026-07-05 15:00:00+07'),
    (100002, 100001, 'inspection','Kiểm tra hệ thống phanh — tài xế báo có tiếng kêu', NULL, DATE '2026-07-29', NULL,              100004, 'requested',
        '[]'::jsonb, TIMESTAMPTZ '2026-07-29 08:00:00+07', NULL, NULL, NULL, NULL, NULL);

UPDATE maintenance_records SET requested_by = 100004, request_reason = 'Phanh có tiếng kêu lạ khi xuống dốc' WHERE id = 100002;

INSERT INTO vehicle_status_history (vehicle_id, action_type, from_status, to_status, reference_type, reference_id, note, created_by, created_at) VALUES
    (100000, 'send_to_maintenance',  'active',      'maintenance', 'maintenance_record', 100000, 'Bảo dưỡng định kỳ 10.000km', 100000, TIMESTAMPTZ '2026-06-08 08:00:00+07'),
    (100000, 'complete_maintenance', 'maintenance', 'active',      'maintenance_record', 100000, 'Đã xác nhận hoàn tất bảo dưỡng', 100000, TIMESTAMPTZ '2026-06-08 16:00:00+07'),
    (100002, 'send_to_maintenance',  'active',      'maintenance', 'maintenance_record', 100001, 'Thay lốp sau', 100000, TIMESTAMPTZ '2026-07-05 08:00:00+07'),
    (100002, 'complete_maintenance', 'maintenance', 'active',      'maintenance_record', 100001, 'Đã xác nhận hoàn tất', 100000, TIMESTAMPTZ '2026-07-05 15:00:00+07');

INSERT INTO vehicle_driver_assignments (vehicle_id, driver_id, previous_driver_id, action, note, created_by, created_at) VALUES
    (100000, 100003, NULL, 'assign', 'Gán xe khi nhận việc',        100000, TIMESTAMPTZ '2023-03-01 08:00:00+07'),
    (100001, 100004, NULL, 'assign', 'Gán xe khi nhận việc',        100000, TIMESTAMPTZ '2024-05-15 08:00:00+07'),
    (100002, 100005, NULL, 'assign', 'Gán xe khi nhận việc',        100000, TIMESTAMPTZ '2025-11-01 08:00:00+07'),
    (100004, 100006, NULL, 'assign', 'Gán xe mới mua cho tài xế',   100000, TIMESTAMPTZ '2025-09-20 08:00:00+07');

INSERT INTO financial_transactions (event_type, debit_account, credit_account, amount, description, ref_type, ref_id, actor_id, occurred_at) VALUES
    ('pass_through_cost', '3388', '1111', 120000, 'Chi hộ khách (toll) — chuyến #100000', 'expense', 100000, 100001, TIMESTAMPTZ '2026-06-05 17:00:00+07'),
    ('shipment_revenue', '131', '511', 2500000, 'Doanh thu chuyến #100000 — đơn #100000', 'shipment', 100000, 100001, TIMESTAMPTZ '2026-06-05 17:30:00+07'),
    ('bank_receipt', '1121', '131', 2620000, 'Khách CK về công ty — phiếu thu #100000, đơn #100000', 'shipment', 100000, 100002, TIMESTAMPTZ '2026-06-05 18:00:00+07'),
    ('shipment_revenue', '131', '511', 3150000, 'Doanh thu chuyến #100001 — đơn #100001', 'shipment', 100001, 100001, TIMESTAMPTZ '2026-06-10 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 3150000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100001, đơn #100001', 'debt', 100000, 100004, TIMESTAMPTZ '2026-06-10 17:35:00+07'),
    ('expense_recorded', '642', '1111', 1200000, 'Chi office — phiếu chi #100000', 'voucher', 100000, 100002, TIMESTAMPTZ '2026-06-15 14:00:00+07'),
    ('pass_through_cost', '3388', '1111', 180000, 'Chi hộ khách (toll) — chuyến #100002', 'expense', 100002, 100001, TIMESTAMPTZ '2026-06-18 17:00:00+07'),
    ('shipment_revenue', '131', '511', 5500000, 'Doanh thu chuyến #100002 — đơn #100002', 'shipment', 100002, 100001, TIMESTAMPTZ '2026-06-18 17:30:00+07'),
    ('customer_debt_created', '131', '131', 5680000, 'Khách nhận nợ — phiếu thu #100002, đơn #100002', 'debt', 100001, 100001, TIMESTAMPTZ '2026-06-18 17:35:00+07'),
    ('driver_debt_paid', '1111', '1388', 2000000, 'Tài xế nộp tiền thu hộ — công nợ #100000', 'debt', 100000, 100002, TIMESTAMPTZ '2026-06-20 10:00:00+07'),
    ('expense_recorded', '642', '1111', 500000, 'Chi phí vận hành (fuel) — chuyến #100003', 'expense', 100001, 100001, TIMESTAMPTZ '2026-06-22 17:00:00+07'),
    ('shipment_revenue', '131', '511', 1800000, 'Doanh thu chuyến #100003 — đơn #100003', 'shipment', 100003, 100001, TIMESTAMPTZ '2026-06-22 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 1800000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100003, đơn #100003', 'debt', 100002, 100003, TIMESTAMPTZ '2026-06-22 17:35:00+07'),
    ('advance_disbursed', '141', '1111', 3000000, 'Giải ngân ứng lương T6/2026 — Hoàng Minh Quân', 'advance', 100000, 100002, TIMESTAMPTZ '2026-06-25 14:00:00+07'),
    ('shipment_revenue', '131', '511', 1300000, 'Doanh thu chuyến #100004 — đơn #100004', 'shipment', 100004, 100001, TIMESTAMPTZ '2026-06-26 17:30:00+07'),
    ('shipment_revenue', '131', '511', 1150000, 'Doanh thu chuyến #100005 — đơn #100004', 'shipment', 100005, 100001, TIMESTAMPTZ '2026-06-26 17:30:00+07'),
    ('bank_receipt', '1121', '131', 2450000, 'Khách CK về công ty — phiếu thu #100004, đơn #100004', 'shipment', 100005, 100002, TIMESTAMPTZ '2026-06-26 18:00:00+07'),
    ('driver_debt_paid', '1111', '1388', 1800000, 'Tài xế nộp tiền thu hộ — công nợ #100002', 'debt', 100002, 100002, TIMESTAMPTZ '2026-06-28 10:00:00+07'),
    ('pass_through_cost', '3388', '1111', 80000, 'Chi hộ khách (parking) — chuyến #100006', 'expense', 100003, 100001, TIMESTAMPTZ '2026-06-28 17:00:00+07'),
    ('shipment_revenue', '131', '511', 1650000, 'Doanh thu chuyến #100006 — đơn #100005', 'shipment', 100006, 100001, TIMESTAMPTZ '2026-06-28 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 1730000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100005, đơn #100005', 'debt', 100003, 100006, TIMESTAMPTZ '2026-06-28 17:35:00+07'),
    ('shipment_revenue', '131', '511', 400000, 'Doanh thu chuyến #100007 — đơn #100006', 'shipment', 100007, 100001, TIMESTAMPTZ '2026-06-29 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 400000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100006, đơn #100006', 'debt', 100004, 100005, TIMESTAMPTZ '2026-06-29 17:35:00+07'),
    ('bonus_paid', '642', '1111', 200000, 'Chi thưởng phúc lợi sinh nhật — Hoàng Minh Quân', NULL, NULL, 100002, TIMESTAMPTZ '2026-06-30 09:00:00+07'),
    ('driver_debt_paid', '1111', '1388', 1730000, 'Tài xế nộp tiền thu hộ — công nợ #100003', 'debt', 100003, 100002, TIMESTAMPTZ '2026-06-30 10:00:00+07'),
    ('driver_debt_paid', '1111', '1388', 300000, 'Tài xế nộp tiền thu hộ — công nợ #100004', 'debt', 100004, 100002, TIMESTAMPTZ '2026-07-02 10:00:00+07'),
    ('expense_recorded', '642', '1111', 2500000, 'Chi utilities — phiếu chi #100001', 'voucher', 100001, 100002, TIMESTAMPTZ '2026-07-04 10:00:00+07'),
    ('customer_payment', '1121', '131', 2000000, 'Khách hàng thanh toán — công nợ #100001', 'debt', 100001, 100002, TIMESTAMPTZ '2026-07-05 10:00:00+07'),
    ('shipment_revenue', '131', '511', 2000000, 'Doanh thu chuyến #100008 — đơn #100007', 'shipment', 100008, 100001, TIMESTAMPTZ '2026-07-08 17:30:00+07'),
    ('bank_receipt', '1121', '131', 2000000, 'Khách CK về công ty — phiếu thu #100007, đơn #100007', 'shipment', 100008, 100002, TIMESTAMPTZ '2026-07-08 18:00:00+07'),
    ('expense_recorded', '642', '1111', 450000, 'Chi phí vận hành (fuel) — chuyến #100009', 'expense', 100004, 100001, TIMESTAMPTZ '2026-07-12 17:00:00+07'),
    ('shipment_revenue', '131', '511', 4000000, 'Doanh thu chuyến #100009 — đơn #100008', 'shipment', 100009, 100001, TIMESTAMPTZ '2026-07-12 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 4000000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100008, đơn #100008', 'debt', 100005, 100005, TIMESTAMPTZ '2026-07-12 17:35:00+07'),
    ('pass_through_cost', '3388', '1111', 150000, 'Chi hộ khách (etc) — chuyến #100010', 'expense', 100006, 100001, TIMESTAMPTZ '2026-07-14 17:00:00+07'),
    ('shipment_revenue', '131', '511', 3600000, 'Doanh thu chuyến #100010 — đơn #100009', 'shipment', 100010, 100001, TIMESTAMPTZ '2026-07-14 17:30:00+07'),
    ('customer_debt_created', '131', '131', 3750000, 'Khách nhận nợ — phiếu thu #100009, đơn #100009', 'debt', 100006, 100001, TIMESTAMPTZ '2026-07-14 17:35:00+07'),
    ('shipment_revenue', '131', '511', 1050000, 'Doanh thu chuyến #100011 — đơn #100010', 'shipment', 100011, 100001, TIMESTAMPTZ '2026-07-20 17:30:00+07'),
    ('shipment_revenue', '131', '511', 1080000, 'Doanh thu chuyến #100012 — đơn #100010', 'shipment', 100012, 100001, TIMESTAMPTZ '2026-07-20 17:30:00+07'),
    ('driver_debt_created', '1388', '131', 2130000, 'Tài xế thu tiền mặt từ khách — phiếu thu #100010, đơn #100010', 'debt', 100007, 100006, TIMESTAMPTZ '2026-07-20 17:35:00+07'),
    ('pass_through_cost', '3388', '1111', 350000, 'Chi hộ khách (toll) — chuyến #100013', 'expense', 100005, 100001, TIMESTAMPTZ '2026-07-22 17:00:00+07'),
    ('shipment_revenue', '131', '511', 6600000, 'Doanh thu chuyến #100013 — đơn #100011', 'shipment', 100013, 100001, TIMESTAMPTZ '2026-07-22 17:30:00+07'),
    ('bank_receipt', '1121', '131', 6950000, 'Khách CK về công ty — phiếu thu #100011, đơn #100011', 'shipment', 100013, 100002, TIMESTAMPTZ '2026-07-22 18:00:00+07'),
    ('advance_disbursed', '141', '1111', 2000000, 'Giải ngân ứng lương T7/2026 — Lê Thanh Sơn', 'advance', 100002, 100002, TIMESTAMPTZ '2026-07-25 15:00:00+07');

INSERT INTO invoices (id, invoice_number, customer_id, order_id, created_by, invoice_date, due_date, tax_rate, subtotal, status, notes) VALUES
    (100000, 'INV-2026-0001', 100002, 100002, 100002, DATE '2026-06-18', DATE '2026-06-28', 8.00, 5680000, 'sent', 'Hóa đơn GTGT đơn công nợ'),
    (100001, 'INV-2026-0002', 100002, 100009, 100002, DATE '2026-07-14', DATE '2026-07-28', 8.00, 3750000, 'sent', 'Hóa đơn GTGT đơn công nợ');

INSERT INTO invoice_shipments (invoice_id, shipment_id, line_amount) VALUES
    (100000, 100002, 5680000),
    (100001, 100010, 3750000);

SELECT setval(pg_get_serial_sequence('accounts','id'), (SELECT MAX(id) FROM accounts));
SELECT setval(pg_get_serial_sequence('vehicle_groups','id'), (SELECT MAX(id) FROM vehicle_groups));
SELECT setval(pg_get_serial_sequence('vehicles','id'), (SELECT MAX(id) FROM vehicles));
SELECT setval(pg_get_serial_sequence('customers','id'), (SELECT MAX(id) FROM customers));
SELECT setval(pg_get_serial_sequence('partners','id'), (SELECT MAX(id) FROM partners));
SELECT setval(pg_get_serial_sequence('orders','id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_shipments','id'), (SELECT MAX(id) FROM order_shipments));
SELECT setval(pg_get_serial_sequence('order_receipt_requests','id'), (SELECT MAX(id) FROM order_receipt_requests));
SELECT setval(pg_get_serial_sequence('shipment_receipts','id'), (SELECT MAX(id) FROM shipment_receipts));
SELECT setval(pg_get_serial_sequence('debts','id'), (SELECT MAX(id) FROM debts));
SELECT setval(pg_get_serial_sequence('expenses','id'), (SELECT MAX(id) FROM expenses));
SELECT setval(pg_get_serial_sequence('payment_vouchers','id'), (SELECT MAX(id) FROM payment_vouchers));
SELECT setval(pg_get_serial_sequence('salary_advances','id'), (SELECT MAX(id) FROM salary_advances));
SELECT setval(pg_get_serial_sequence('maintenance_records','id'), (SELECT MAX(id) FROM maintenance_records));
SELECT setval(pg_get_serial_sequence('invoices','id'), (SELECT MAX(id) FROM invoices));

-- ── Bảng lương T6 + T7/2026 ─────────────────────────────────────────────
-- Sinh bởi chính hàm tính lương của backend (calculateAndUpsertPayrolls) chạy
-- trên seed này, KHÔNG gõ tay (công thức có 12 thành phần).
-- Trạng thái 'pending' — chờ Manager duyệt rồi Kế toán chi.
INSERT INTO payrolls (id, driver_id, payroll_month, payroll_year, base_salary, months_of_service, total_revenue, revenue_share_pct, revenue_bonus, kpi_bonus, top_driver_bonus, overtime_bonus, holiday_bonus, other_bonus, manual_bonus, insurance_employee, insurance_company, driver_debt_deduction, advance_deduction, absence_penalty, other_deduction, manual_deduction, expense_reimbursement, status) VALUES
    (100000, 100003, 6, 2026, '9000000.00', 39, '5600000.00', '15.00', '840000.00', '0.00', '1000000.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '0.00', '0.00', '0.00', '0.00', '0.00', '620000.00', 'pending'),
    (100001, 100004, 6, 2026, '9000000.00', 25, '3150000.00', '15.00', '472500.00', '0.00', '1000000.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '1150000.00', '3000000.00', '0.00', '0.00', '0.00', '150000.00', 'pending'),
    (100002, 100005, 6, 2026, '8000000.00', 7, '5900000.00', '15.00', '885000.00', '0.00', '1000000.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '4100000.00', '0.00', '0.00', '0.00', '0.00', '980000.00', 'pending'),
    (100003, 100006, 6, 2026, '8000000.00', 9, '2800000.00', '15.00', '420000.00', '0.00', '0.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '2130000.00', '0.00', '0.00', '0.00', '0.00', '80000.00', 'pending'),
    (100004, 100003, 7, 2026, '9000000.00', 40, '2000000.00', '15.00', '300000.00', '0.00', '0.00', '500000.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '0.00', '0.00', '0.00', '0.00', '0.00', '620000.00', 'pending'),
    (100005, 100004, 7, 2026, '9000000.00', 26, '3600000.00', '15.00', '540000.00', '0.00', '1000000.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '1150000.00', '0.00', '0.00', '0.00', '0.00', '150000.00', 'pending'),
    (100006, 100005, 7, 2026, '8000000.00', 8, '10600000.00', '15.00', '1590000.00', '2000000.00', '1000000.00', '0.00', '0.00', '200000.00', '0.00', '557550.00', '1141650.00', '4100000.00', '0.00', '857143.00', '0.00', '0.00', '980000.00', 'pending'),
    (100007, 100006, 7, 2026, '8000000.00', 10, '2130000.00', '15.00', '319500.00', '0.00', '1000000.00', '0.00', '285714.00', '200000.00', '0.00', '557550.00', '1141650.00', '2130000.00', '2000000.00', '0.00', '0.00', '0.00', '80000.00', 'pending');

SELECT setval(pg_get_serial_sequence('payrolls','id'), (SELECT MAX(id) FROM payrolls));
