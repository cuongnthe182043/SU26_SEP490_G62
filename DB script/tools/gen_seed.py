# -*- coding: utf-8 -*-
"""Sinh DB script/seed.sql cho tháng 6 + 7/2026.

Nguyên tắc: chỉ khai BASE FACTS (đơn, chuyến, km, chi phí, thu nợ...).
Mọi số tiền phái sinh đều được TÍNH — không gõ tay:
  actual_price   = km thực tế × đơn giá nhóm xe   (hoặc số coord chốt khi hoàn hàng)
  phiếu thu      = actual_price + chi hộ khách (toll/parking/etc)
  KPI            = đếm chuyến completed + tổng actual_price theo tài/tháng
  công nợ còn    = total_amount − tổng debt_payments đã confirmed
  sổ nhật ký     = sinh từ đúng các sự kiện tiền tệ ở trên
"""
import io, textwrap
from datetime import date

PASS_THROUGH = {"toll", "parking", "etc"}

def vn(n):
    return f"{n:,}".replace(",", ".")

# ── Danh mục ────────────────────────────────────────────────────────────────
GROUPS = {  # id: (name, desc, max_kg, price_per_km)
    100000: ("Xe cắt nóc",     "Xe tải nhẹ cắt nóc, chở hàng cồng kềnh nội thành", 2000,  10000),
    100001: ("Xe 3 tấn (4m3)", "Xe tải 3 tấn thùng 4m3",                           3000,  15000),
    100002: ("Xe 5m2",         "Xe tải thùng dài 5m2",                             7000,  20000),
    100003: ("Xe 7m4",         "Xe tải thùng dài 7m4, tuyến liên tỉnh",            10000, 30000),
}
VEHICLES = {  # id: (plate, group, brand, model, kg, year, purchase, driver)
    100000: ("51C-123.45", 100000, "Suzuki",  "Carry Pro",  1900, 2022, "2022-06-10", 100003),
    100001: ("51D-678.90", 100001, "Isuzu",   "QKR 230",    3000, 2021, "2021-09-15", 100004),
    100002: ("51E-246.80", 100002, "Hino",    "XZU 342L",   6800, 2023, "2023-02-20", 100005),
    100003: ("51F-135.79", 100003, "Hyundai", "Mighty EX8", 9500, 2022, "2022-11-05", None),
    100004: ("51H-889.12", 100000, "Thaco",   "Towner 990", 1900, 2023, "2023-08-12", 100006),
}
# driver profile_id: (vehicle, group, license, hire_date, share%)
DRIVERS = {
    100003: (100000, 100000, "DL-0123456", "2023-03-01", 15.00),
    100004: (100001, 100001, "DL-0234567", "2024-05-15", 15.00),
    100005: (100002, 100002, "DL-0345678", "2025-11-01", 15.00),
    100006: (100004, 100000, "DL-0456789", "2025-09-20", 15.00),
}
DRIVER_NAME = {100003: "Phạm Văn Tiền", 100004: "Hoàng Minh Quân",
               100005: "Đỗ Hữu Phước", 100006: "Lê Thanh Sơn"}

COORD, MANAGER, ACCT = 100001, 100000, 100002

# ── BASE FACTS: chuyến ──────────────────────────────────────────────────────
# (id, order_id, idx, group, driver, est_km, km, kg, cargo, status, day, extra)
# status: completed | returned | transit | available
S = [
    # ===== THÁNG 6 =====
    (100000, 100000, 1, 100000, 100003, 240, 250, 800,  "Thực phẩm khô đóng thùng", "completed", "2026-06-05", {}),
    (100001, 100001, 1, 100001, 100004, 200, 210, 1500, "Đồ gia dụng",              "completed", "2026-06-10", {}),
    (100002, 100002, 1, 100002, 100005, 260, 275, 4500, "Bàn ghế gỗ xuất khẩu",     "completed", "2026-06-18", {}),
    (100003, 100003, 1, 100000, 100003, 170, 180, 900,  "Đồ đạc chuyển nhà",        "completed", "2026-06-22", {}),
    # đơn 2 chuyến, 2 tài khác nhau (multi-driver order)
    (100004, 100004, 1, 100000, 100003, 120, 130, 1200, "Hồ sơ lưu trữ đợt 1",      "completed", "2026-06-25", {}),
    (100005, 100004, 2, 100000, 100006, 110, 115, 1100, "Hồ sơ lưu trữ đợt 2",      "completed", "2026-06-26", {}),
    (100006, 100005, 1, 100000, 100006, 160, 165, 950,  "Thiết bị điện tử",         "completed", "2026-06-28", {}),
    # giao thất bại -> coord cho hoàn hàng, thu phí 400k
    (100007, 100006, 1, 100002, 100005, 200, 205, 3800, "Máy CNC mini",             "returned",  "2026-06-29",
        {"charge": "return_fee", "fee": 400000, "fail": "Khách không có mặt nhận hàng, liên hệ 3 lần không được"}),

    # ===== THÁNG 7 =====
    (100008, 100007, 1, 100000, 100003, 190, 200, 700,  "Gia vị & nguyên liệu bếp", "completed", "2026-07-08", {}),
    (100009, 100008, 1, 100002, 100005, 190, 200, 3200, "Máy móc gia công nhỏ",     "completed", "2026-07-12", {}),
    (100010, 100009, 1, 100001, 100004, 230, 240, 2800, "Vật tư xây dựng",          "completed", "2026-07-14", {}),
    # đơn 2 chuyến CÙNG 1 tài (coord pre-assign, chạy tuần tự)
    (100011, 100010, 1, 100000, 100006, 100, 105, 800,  "Kho lưu trữ đợt 1",        "completed", "2026-07-18", {}),
    (100012, 100010, 2, 100000, 100006, 100, 108, 850,  "Kho lưu trữ đợt 2",        "completed", "2026-07-19", {}),
    # trả trước đã xác nhận
    (100013, 100011, 1, 100002, 100005, 320, 330, 6500, "Hàng liên tỉnh Đà Nẵng",   "completed", "2026-07-22", {}),
    # đang chạy + chờ nhận
    (100014, 100012, 1, 100001, 100004, 150, None, 2600, "Nội thất văn phòng đợt 1", "transit",   "2026-07-26", {}),
    (100015, 100012, 2, 100001, None,   140, None, 2400, "Nội thất văn phòng đợt 2", "available", "2026-07-26", {}),
    (100016, 100013, 1, 100000, None,   150, None, 400,  "Tủ lạnh + máy giặt",       "available", "2026-07-27", {}),
]

# (order_id, customer, payment_type, notes, prepaid, partner_id)
O = {
    100000: (100001, "bank_transfer", "Giao kho Quận 7", 0, None),
    100001: (100000, "cash",          "Khách trả tiền mặt cho tài xế", 0, None),
    100002: (100002, "client_credit", "Công nợ 30 ngày theo hợp đồng", 0, None),
    100003: (100003, "cash",          "Chuyển nhà trọn gói Quận 5 → Thủ Đức", 0, None),
    100004: (100001, "bank_transfer", "Chia 2 chuyến, 2 tài xế chạy song song", 0, None),
    100005: (100000, "cash",          "Giao gấp trong ngày", 0, None),
    100006: (100000, "cash",          "Khách không nhận — hoàn hàng, thu phí chở về", 0, None),
    100007: (100001, "bank_transfer", "Giao siêu thị Gò Vấp", 0, None),
    100008: (100000, "cash",          "Hàng nặng, cần xe 5m2", 0, None),
    100009: (100002, "client_credit", "Công nợ 30 ngày, giao công trường", 0, None),
    100010: (100003, "cash",          "Chia 2 chuyến cùng 1 tài, chạy tuần tự", 0, None),
    100011: (100001, "bank_transfer", "Tuyến liên tỉnh, khách trả trước 5 triệu", 5000000, None),
    100012: (100002, "bank_transfer", "Đơn đối tác Tân Cảng, chia 2 chuyến", 0, 100000),
    100013: (100003, "cash",          "Chờ tài xế nhận chuyến", 0, None),
}

# (id, shipment, vehicle, driver, type, amount, desc, day, status)
E = [
    (100000, 100000, 100000, 100003, "toll",   120000, "Phí cầu đường cao tốc Long Thành", "2026-06-05", "approved"),
    (100001, 100003, 100000, 100003, "fuel",   500000, "Đổ dầu chuyến chuyển nhà",          "2026-06-22", "approved"),
    (100002, 100002, 100002, 100005, "toll",   180000, "Phí cầu đường + phà Cát Lái",       "2026-06-18", "approved"),
    (100003, 100006, 100004, 100006, "parking", 80000, "Phí đỗ xe hầm toà nhà",             "2026-06-28", "approved"),
    (100004, 100009, 100002, 100005, "fuel",   450000, "Đổ dầu chuyến Bình Dương",          "2026-07-12", "approved"),
    (100005, 100013, 100002, 100005, "toll",   350000, "Phí cao tốc tuyến Đà Nẵng",         "2026-07-22", "approved"),
    (100006, 100010, 100001, 100004, "etc",    150000, "Phí thu không dừng tuyến QL13",     "2026-07-14", "approved"),
    (100007, None,   100001, 100004, "repair", 800000, "Thay má phanh trước — chờ duyệt",   "2026-07-28", "pending"),
]

# nộp nợ / khách trả nợ: (debt_key, amount, method, day, by, note)
PAY = [
    ("d_100001", 2000000, "cash",          "2026-06-20", 100004, "Tài xế nộp tiền mặt đợt 1"),
    ("d_100003", None,    "cash",          "2026-06-28", 100003, "Tài xế nộp đủ tiền thu hộ"),   # None = nộp đủ
    ("c_100002", 2000000, "bank_transfer", "2026-07-05", ACCT,   "Mộc Việt chuyển khoản trả nợ đợt 1"),
    ("d_100005", None,    "cash",          "2026-06-30", 100006, "Tài xế nộp đủ tiền thu hộ"),
    ("d_100006", 300000,  "cash",          "2026-07-02", 100005, "Nộp một phần phí hoàn hàng"),
]

# Ngày lễ là dữ liệu CHÍNH SÁCH — đã nằm trong DB script.sql (8 ngày theo Điều V.1
# của thông báo lương). Tháng 6 và 7/2026 KHÔNG có ngày lễ nào, nên holiday_bonus
# bằng 0 là đúng thực tế, không phải thiếu dữ liệu.
HOLIDAYS = []
# Công thức lương: actualWorkDays = min(26, số ngày trong tháng − ngày nghỉ không lương).
# Tháng 30 ngày phải nghỉ > 4 ngày mới bắt đầu bị trừ lương → cho tài 100005 nghỉ 6 ngày
# trong T7 để cột absence_penalty có dữ liệu thật, thay vì luôn bằng 0.
LEAVES = [(100005, "2026-06-15", "unpaid", "Việc gia đình"), (100005, "2026-06-16", "unpaid", "Việc gia đình"),
          (100003, "2026-07-06", "paid",   "Nghỉ phép định kỳ"),
          (100006, "2026-07-13", "unpaid", "Ốm")] + [
          (100005, f"2026-07-{d:02d}", "unpaid", "Nghỉ dài về quê lo việc gia đình") for d in (23, 24, 25, 27, 28, 29)]
ATT = [(100004, "2026-06-12", "absent_unexcused", "Không báo trước"),
       (100006, "2026-07-21", "half_day", "Sáng đi làm, chiều xin về")]


# ── Chuyến tuyến cố định (để doanh thu tháng đạt mức THỰC TẾ) ───────────────
# 1 tài chạy ~15-20 chuyến/tháng mới ra doanh thu 50-100tr như ngưỡng KPI trong
# thông báo lương. Nếu chỉ để 1-2 chuyến/tài/tháng thì bonus_rules thành data chết.
# Các chuyến này đều: đơn chuyển khoản 1 chuyến, đã hoàn thành, không chi phí.
ROUTINE = []          # (driver, month, so_chuyen, km_moi_chuyen, ngay_bat_dau)
ROUTINE += [(100005, 6, 12, 250, 2)]    # Xe 5m2 20k/km -> 12*250*20k = 60tr  (duoi 70tr)
ROUTINE += [(100005, 7, 15, 250, 2)]    # -> 15*250*20k = 75tr (+10,6tr cu) => VUOT 70tr
ROUTINE += [(100003, 7, 16, 300, 2)]    # Cat noc 10k/km -> 16*300*10k = 48tr (+2tr) duoi 50tr
ROUTINE += [(100004, 7, 18, 250, 2)]    # 4m3 15k/km -> 18*250*15k = 67,5tr (+3,6tr) => VUOT 65tr

_sid, _oid = 200000, 200000
for drv, mon, n, km, day0 in ROUTINE:
    gid = DRIVERS[drv][1]
    for i in range(n):
        d = day0 + i
        day = f"2026-{mon:02d}-{d:02d}"
        O[_oid] = (100001, "bank_transfer", f"Tuyến cố định {DRIVER_NAME[drv]} — chuyến {i+1}", 0, None)
        S.append((_sid, _oid, 1, gid, drv, km, km, min(GROUPS[gid][2] - 100, 900),
                  "Hàng tuyến cố định", "completed", day, {}))
        _sid += 1
        _oid += 1

# ── TÍNH TOÁN ───────────────────────────────────────────────────────────────
by_id = {s[0]: s for s in S}
km_price = {gid: GROUPS[gid][3] for gid in GROUPS}

def price_of(sid):
    """actual_price của chuyến — km × đơn giá, hoặc số coord chốt khi hoàn hàng."""
    s = by_id[sid]
    st, extra = s[9], s[11]
    if st == "returned":
        return {"no_charge": 0, "return_fee": extra.get("fee", 0)}.get(extra["charge"], s[6] * km_price[s[3]])
    if st != "completed":
        return None
    return s[6] * km_price[s[3]]

def passthrough_of(sid):
    return sum(e[5] for e in E if e[1] == sid and e[4] in PASS_THROUGH and e[8] != "rejected")

PRICE = {s[0]: price_of(s[0]) for s in S}
# chuyến kết thúc = completed hoặc returned (hàng đã về kho, DB status='completed')
DONE = [s for s in S if s[9] in ("completed", "returned")]
ORDER_SHIPMENTS = {}
for s in S:
    ORDER_SHIPMENTS.setdefault(s[1], []).append(s)

def order_receipt_amount(oid):
    """Phiếu thu của đơn = tổng actual_price + tổng chi hộ khách của mọi chuyến."""
    tot = 0
    for s in ORDER_SHIPMENTS[oid]:
        if s[9] in ("completed", "returned"):
            tot += PRICE[s[0]] + passthrough_of(s[0])
    return tot

# đơn đã chốt phiếu thu = mọi chuyến của đơn đã kết thúc
CLOSED_ORDERS = [oid for oid, ss in ORDER_SHIPMENTS.items()
                 if all(s[9] in ("completed", "returned") for s in ss)]
CLOSED_ORDERS.sort()

def last_shipment(oid):
    return max(ORDER_SHIPMENTS[oid], key=lambda s: s[2])

def order_day(oid):
    return max(s[10] for s in ORDER_SHIPMENTS[oid] if s[9] in ("completed", "returned"))

# ── KIỂM TRA BẤT BIẾN (chặn seed sai ngay khi sinh) ─────────────────────────
errs = []
for s_ in S:
    sid, oid, idx, gid, drv, ekm, km, kg, cargo, st, day, extra = s_
    if drv is not None:
        dv = DRIVERS[drv][0]
        if VEHICLES[dv][1] != gid:
            errs.append(f"BR-003: chuyến #{sid} nhóm {gid} nhưng xe của tài {drv} thuộc nhóm {VEHICLES[dv][1]}")
    if kg > GROUPS[gid][2]:
        errs.append(f"Tải trọng: chuyến #{sid} {kg}kg > giới hạn {GROUPS[gid][2]}kg của nhóm {gid}")
    if st in ("completed", "returned") and not km:
        errs.append(f"Chuyến #{sid} đã kết thúc nhưng thiếu km thực tế")
    if oid not in O:
        errs.append(f"Chuyến #{sid} trỏ tới đơn #{oid} không khai trong O")
seen = {}
for s_ in DONE:
    key = (s_[4], int(s_[10][5:7]))
    g = seen.setdefault(key, s_[3])
    if g != s_[3]:
        errs.append(f"KPI: tài {s_[4]} tháng {key[1]} chạy 2 nhóm xe khác nhau ({g} và {s_[3]}) — sẽ sinh 2 dòng KPI")
for oid in O:
    if oid not in ORDER_SHIPMENTS:
        errs.append(f"Đơn #{oid} không có chuyến nào")
if errs:
    print("SEED KHÔNG HỢP LỆ:")
    for e in errs:
        print("  ✗", e)
    raise SystemExit(1)

out = io.StringIO()
master = io.StringIO()
W = out.write
MW = master.write
def block(sql): W(textwrap.dedent(sql).strip() + "\n\n")
def mblock(sql): MW(textwrap.dedent(sql).strip() + "\n\n")

W("-- Dữ liệu nghiệp vụ tháng 6 + 7/2026. Sinh bởi DB script/tools/gen_seed.py —\n")
W("-- mọi số tiền được TÍNH từ km × đơn giá, không gõ tay.\n")
W("-- Danh mục cố định (tài khoản, nhóm xe, xe, tài xế, chế độ thưởng, ngày lễ)\n")
W("-- nằm trong DB script.sql, không nằm ở đây.\n\n")

MW("-- ══ DỮ LIỆU CỐ ĐỊNH ══════════════════════════════════════════════════════\n")
MW("-- Tài khoản, nhóm xe, xe, tài xế và CHẾ ĐỘ THƯỞNG. Đây là danh mục nền, luôn\n")
MW("-- tồn tại từ đầu và reset_data.sql KHÔNG xoá. Sinh bởi tools/gen_seed.py.\n\n")

mblock("""
-- Chế độ thưởng theo "Thông báo thay đổi chính sách tiền lương" 29/03/2026,
-- hiệu lực 01/04/2026. KHÔNG sửa các con số này khi làm dữ liệu demo.
--   Điều II.4 — Thưởng cuối tháng: 3 giải "Lái xe xuất sắc nhất tháng",
--               1.000.000đ/giải, chỉ cho 3 nhóm: cắt nóc, 3 tấn (4m3), 5m2.
--   Điều II.5 — Thưởng vượt KPI 2.000.000đ theo ngưỡng doanh thu/tháng:
--               cắt nóc > 50tr, 4m3 > 65tr, 5m2 > 70tr, 7m4 > 100tr.
INSERT INTO bonus_rules (vehicle_group_id, title, bonus_type, reward_amount, conditions_json) VALUES
    (100000, 'Thưởng vượt KPI — Xe cắt nóc',                'kpi',         2000000, '{"min_revenue": 50000000}'::jsonb),
    (100001, 'Thưởng vượt KPI — Xe 3 tấn (4m3)',            'kpi',         2000000, '{"min_revenue": 65000000}'::jsonb),
    (100002, 'Thưởng vượt KPI — Xe 5m2',                    'kpi',         2000000, '{"min_revenue": 70000000}'::jsonb),
    (100003, 'Thưởng vượt KPI — Xe 7m4',                    'kpi',         2000000, '{"min_revenue": 100000000}'::jsonb),
    (100000, 'Lái xe xuất sắc nhất tháng — Xe cắt nóc',     'top_revenue', 1000000, '{"rank": 1}'::jsonb),
    (100001, 'Lái xe xuất sắc nhất tháng — Xe 3 tấn (4m3)', 'top_revenue', 1000000, '{"rank": 1}'::jsonb),
    (100002, 'Lái xe xuất sắc nhất tháng — Xe 5m2',         'top_revenue', 1000000, '{"rank": 1}'::jsonb);
""")

mblock("""
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
""")

MW("INSERT INTO vehicle_groups (id, name, description, max_load_weight_kg, price_per_km) VALUES\n")
MW(",\n".join(f"    ({i}, '{v[0]}', '{v[1]}', {v[2]}, {v[3]})" for i, v in GROUPS.items()) + ";\n\n")

MW("INSERT INTO vehicles (id, plate_number, vehicle_group_id, brand, model, load_capacity_kg, manufacture_year, purchase_date, assigned_driver_id, status) VALUES\n")
MW(",\n".join(
    f"    ({i}, '{v[0]}', {v[1]}, '{v[2]}', '{v[3]}', {v[4]}, {v[5]}, DATE '{v[6]}', "
    f"{v[7] if v[7] else 'NULL'}, 'active')" for i, v in VEHICLES.items()) + ";\n\n")

MW("INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, license_expiry_date, hire_date, revenue_share_percent, emergency_contact_name, emergency_contact_phone) VALUES\n")
MW(",\n".join(
    f"    ({d}, {v[0]}, {v[1]}, '{v[2]}', DATE '2029-12-31', DATE '{v[3]}', {v[4]}, "
    f"'Người thân {DRIVER_NAME[d].split()[-1]}', '090800000{i+4}')"
    for i, (d, v) in enumerate(DRIVERS.items())) + ";\n\n")

block("""
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
""")

# company_holidays: 8 ngày lễ theo Điều V.1 đã có sẵn trong DB script.sql.
# Tháng 6 và 7/2026 không có ngày lễ nào nên holiday_bonus = 0 là đúng thực tế.

# ── orders ──────────────────────────────────────────────────────────────────
W("INSERT INTO orders (id, customer_id, created_by, partner_id, cargo_name, cargo_weight_kg, payment_type, total_estimated_price, prepaid_amount, prepaid_status, prepaid_method, prepaid_confirmed_by, prepaid_confirmed_at, derived_status, notes, created_at, updated_at) VALUES\n")
rows = []
for oid in sorted(O):
    cust, ptype, notes, prepaid, partner = O[oid]
    ss = ORDER_SHIPMENTS[oid]
    est = sum(s[5] * km_price[s[3]] for s in ss)
    kg = sum(s[7] for s in ss)
    cargo = ss[0][8] if len(ss) == 1 else f"{ss[0][8].rsplit(' đợt', 1)[0]} ({len(ss)} đợt)"
    done = all(s[9] in ("completed", "returned") for s in ss)
    d0 = min(s[10] for s in ss)
    d1 = max(s[10] for s in ss)
    pre = (f"{prepaid}, 'confirmed', 'bank_transfer', {ACCT}, TIMESTAMPTZ '{d0} 08:00:00+07'"
           if prepaid else "0, 'none', NULL, NULL, NULL")
    rows.append(f"    ({oid}, {cust}, {COORD}, {partner or 'NULL'}, '{cargo}', {kg}, '{ptype}', {est}, {pre}, "
                f"'{'completed' if done else 'open'}', '{notes}', "
                f"TIMESTAMPTZ '{d0} 06:30:00+07', TIMESTAMPTZ '{d1} 17:00:00+07')")
W(",\n".join(rows) + ";\n\n")

# ── order_shipments ─────────────────────────────────────────────────────────
W("INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, actual_distance_km, actual_price, cargo_name, cargo_weight_kg, status, cancel_reason, return_charge_type, return_fee, failed_resolved_by, failed_resolved_at, claimed_at, picking_at, transit_at, arrived_at, failed_at, returning_at, completed_at, created_at, updated_at) VALUES\n")
rows = []
for s in S:
    sid, oid, idx, gid, drv, ekm, km, kg, cargo, st, day, extra = s
    est = ekm * km_price[gid]
    ap = PRICE[sid]
    ts = lambda h: f"TIMESTAMPTZ '{day} {h}+07'"
    if st in ("completed", "returned"):
        claimed, picking, transit, arrived = ts("07:00:00"), ts("07:40:00"), ts("09:00:00"), ts("15:00:00")
        if st == "returned":
            failed, returning, completed = ts("15:20:00"), ts("15:50:00"), ts("18:30:00")
            rc, rf = f"'{extra['charge']}'", extra.get("fee", "NULL")
            resolved_by, resolved_at, reason = COORD, ts("15:45:00"), f"'{extra['fail']}'"
        else:
            failed = returning = "NULL"
            completed = ts("16:30:00")
            rc, rf, resolved_by, resolved_at, reason = "NULL", "NULL", "NULL", "NULL", "NULL"
    elif st == "transit":
        claimed, picking, transit = ts("08:00:00"), ts("08:30:00"), ts("09:15:00")
        arrived = failed = returning = completed = "NULL"
        rc = rf = resolved_by = resolved_at = reason = "NULL"
    else:
        claimed = picking = transit = arrived = failed = returning = completed = "NULL"
        rc = rf = resolved_by = resolved_at = reason = "NULL"
    db_status = "completed" if st in ("completed", "returned") else st
    rows.append(
        f"    ({sid}, {oid}, {idx}, {gid}, {est}, {ekm}, {km if km else 'NULL'}, {ap if ap is not None else 'NULL'}, "
        f"'{cargo}', {kg}, '{db_status}', {reason}, {rc}, {rf}, {resolved_by}, {resolved_at}, "
        f"{claimed}, {picking}, {transit}, {arrived}, {failed}, {returning}, {completed}, "
        f"TIMESTAMPTZ '{day} 06:30:00+07', TIMESTAMPTZ '{day} 18:30:00+07')")
W(",\n".join(rows) + ";\n\n")

# ── trip_stops ──────────────────────────────────────────────────────────────
ADDR = {
    100000: ("Kho Saigon Foods, 456 Lê Lợi, Quận 1, TP.HCM", "Ms. Lan", "0987000002"),
    100001: ("123 Nguyễn Huệ, Quận 1, TP.HCM", "Nguyễn Hoàng An", "0987000001"),
    100002: ("Xưởng Mộc Việt, 321 Nguyễn Trãi, Quận 5, TP.HCM", "Mr. Hùng", "0987000003"),
    100003: ("789 Trần Hưng Đạo, Quận 5, TP.HCM", "Trần Thị Bích", "0987000004"),
}
DEST = ["Kho lạnh Quận 7, 15 Nguyễn Thị Thập, TP.HCM", "45 Quốc lộ 51, Long Thành, Đồng Nai",
        "Cảng Cát Lái, Thủ Đức, TP.HCM", "Chung cư Vinhomes Grand Park, Thủ Đức, TP.HCM",
        "Siêu thị BigC Gò Vấp, TP.HCM", "KCN Sóng Thần, Dĩ An, Bình Dương",
        "Tòa nhà Bitexco, 2 Hải Triều, Quận 1, TP.HCM", "KCN Hòa Khánh, Đà Nẵng"]
W("INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address, contact_name, contact_phone, arrived_at, completed_at) VALUES\n")
rows = []
for n, s in enumerate(S):
    sid, oid, _, _, _, _, _, _, _, st, day, _ = s
    pu = ADDR[O[oid][0]]
    dl = DEST[n % len(DEST)]
    done = st in ("completed", "returned")
    a1 = f"TIMESTAMPTZ '{day} 07:30:00+07'" if st != "available" else "NULL"
    c1 = f"TIMESTAMPTZ '{day} 08:50:00+07'" if st != "available" else "NULL"
    a2 = f"TIMESTAMPTZ '{day} 15:00:00+07'" if done else "NULL"
    c2 = f"TIMESTAMPTZ '{day} 15:10:00+07'" if st == "completed" else "NULL"
    rows.append(f"    ({sid}, 1, 'pickup',   '{pu[0]}', '{pu[1]}', '{pu[2]}', {a1}, {c1})")
    rows.append(f"    ({sid}, 2, 'delivery', '{dl}', 'Người nhận hàng', '0912345{100+n:03d}', {a2}, {c2})")
W(",\n".join(rows) + ";\n\n")

# ── assignment history + revenue allocations + proofs ───────────────────────
W("INSERT INTO shipment_assignment_history (shipment_id, to_driver_id, to_vehicle_id, changed_by, change_reason, changed_at) VALUES\n")
W(",\n".join(
    f"    ({s[0]}, {s[4]}, {DRIVERS[s[4]][0]}, {s[4]}, 'self_claim', TIMESTAMPTZ '{s[10]} 07:00:00+07')"
    for s in S if s[4]) + ";\n\n")

W("INSERT INTO shipment_revenue_allocations (shipment_id, driver_id, share_percent, allocation_reason, created_by) VALUES\n")
W(",\n".join(f"    ({s[0]}, {s[4]}, 100, 'default_owner', {COORD})" for s in DONE) + ";\n\n")

W("INSERT INTO delivery_proofs (shipment_id, captured_by, file_url, is_realtime, captured_at) VALUES\n")
W(",\n".join(
    f"    ({s[0]}, {s[4]}, 'https://res.cloudinary.com/demo/image/upload/sample.jpg', TRUE, "
    f"TIMESTAMPTZ '{s[10]} {'18:20:00' if s[9]=='returned' else '16:25:00'}+07')" for s in DONE) + ";\n\n")

# ── expenses + attachments ──────────────────────────────────────────────────
W("INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, expense_type, amount, description, expense_date, status, reviewed_by, reviewed_at, reimbursement_status, created_at, updated_at) VALUES\n")
rows = []
for eid, sid, vid, drv, et, amt, desc, day, stt in E:
    if stt == "approved":
        rev, revat, reimb = COORD, f"TIMESTAMPTZ '{day} 17:00:00+07'", "'pending'"
    else:
        rev, revat, reimb = "NULL", "NULL", "NULL"
    rows.append(f"    ({eid}, {sid if sid else 'NULL'}, {vid}, {drv}, '{et}', {amt}, '{desc}', DATE '{day}', "
                f"'{stt}', {rev}, {revat}, {reimb}, TIMESTAMPTZ '{day} 16:00:00+07', TIMESTAMPTZ '{day} 17:00:00+07')")
W(",\n".join(rows) + ";\n\n")

W("INSERT INTO expense_attachments (expense_id, file_url) VALUES\n")
W(",\n".join(f"    ({e[0]}, 'https://res.cloudinary.com/demo/image/upload/sample.jpg')" for e in E) + ";\n\n")

# ── receipt requests + receipts ─────────────────────────────────────────────
orr_id, rcpt_id = 100000, 100000
ORR, RCPT = {}, {}
W("INSERT INTO order_receipt_requests (id, order_id, requesting_shipment_id, driver_id, driver_notes, status, requested_at, processed_by, processed_at, coordinator_notes) VALUES\n")
rows = []
for oid in CLOSED_ORDERS:
    ls = last_shipment(oid)
    day = order_day(oid)
    amt = order_receipt_amount(oid)
    ORR[oid] = orr_id
    rows.append(f"    ({orr_id}, {oid}, {ls[0]}, {ls[4]}, 'Km thực tế {ls[6]}', 'approved', "
                f"TIMESTAMPTZ '{day} 17:05:00+07', {COORD}, TIMESTAMPTZ '{day} 17:30:00+07', "
                f"'Chốt {amt:,}đ'.replace(',', '.'))")
    orr_id += 1
W(",\n".join(rows).replace("'.replace(',', '.')", "đ'").replace("đđ'", "đ'") + ";\n\n")

PT = {"bank_transfer": "bank_transfer", "cash": "cash_collected", "client_credit": "client_credit"}
W("INSERT INTO shipment_receipts (id, shipment_id, payment_type, amount, collected_by, collected_at, notes, order_receipt_request_id, created_by) VALUES\n")
rows = []
for oid in CLOSED_ORDERS:
    ls = last_shipment(oid)
    day, amt = order_day(oid), order_receipt_amount(oid)
    pt = PT[O[oid][1]]
    collected = ls[4] if pt == "cash_collected" else "NULL"
    note = {"bank_transfer": "Khách CK về công ty, kế toán đã xác nhận",
            "cash_collected": "Tài xế thu tiền mặt của khách",
            "client_credit": "Khách nợ theo hợp đồng"}[pt]
    RCPT[oid] = rcpt_id
    rows.append(f"    ({rcpt_id}, {ls[0]}, '{pt}', {amt}, {collected}, TIMESTAMPTZ '{day} 17:30:00+07', "
                f"'{note}', {ORR[oid]}, {COORD})")
    rcpt_id += 1
W(",\n".join(rows) + ";\n\n")

W("INSERT INTO payment_receipts (payment_id, file_url) VALUES\n")
W(",\n".join(f"    ({RCPT[oid]}, 'https://res.cloudinary.com/demo/image/upload/sample.jpg')"
             for oid in CLOSED_ORDERS if PT[O[oid][1]] != "client_credit") + ";\n\n")

# ── debts + payments ────────────────────────────────────────────────────────
debt_id = 100000
DEBT = {}
rows = []
for oid in CLOSED_ORDERS:
    pt = PT[O[oid][1]]
    if pt == "bank_transfer":
        continue
    ls, day, amt = last_shipment(oid), order_day(oid), order_receipt_amount(oid)
    due = f"DATE '{day[:8]}{min(28, int(day[8:]) + 15):02d}'" if int(day[8:]) + 15 <= 28 else \
          f"DATE '2026-{int(day[5:7]) + 1:02d}-{int(day[8:]) + 15 - 30:02d}'"
    if pt == "cash_collected":
        key, dtype, cust, drv = f"d_{oid}", "driver", "NULL", ls[4]
        note = f"Thu hộ tiền mặt đơn #{oid}"
    else:
        key, dtype, cust, drv = f"c_{oid}", "customer", O[oid][0], "NULL"
        note = f"Công nợ khách hàng đơn #{oid}"
    DEBT[key] = (debt_id, amt)
    rows.append(f"    ({debt_id}, '{dtype}', {cust}, {drv}, {oid}, {ls[0]}, {amt}, {due}, '{note}', "
                f"TIMESTAMPTZ '{day} 17:30:00+07', TIMESTAMPTZ '{day} 17:30:00+07')")
    debt_id += 1
W("INSERT INTO debts (id, debt_type, customer_id, driver_id, order_id, shipment_id, total_amount, due_date, notes, created_at, updated_at) VALUES\n")
W(",\n".join(rows) + ";\n\n")

W("INSERT INTO debt_payments (debt_id, amount, payment_method, status, paid_at, confirmed_at, confirmed_by, created_by, notes) VALUES\n")
rows, PAID = [], {}
for key, amt, method, day, by, note in PAY:
    did, total = DEBT[key]
    real = total if amt is None else amt
    PAID[key] = PAID.get(key, 0) + real
    rows.append(f"    ({did}, {real}, '{method}', 'confirmed', TIMESTAMPTZ '{day} 09:30:00+07', "
                f"TIMESTAMPTZ '{day} 10:00:00+07', {ACCT}, {by}, '{note}')")
W(",\n".join(rows) + ";\n\n")

for _k, _p in PAID.items():
    _did, _tot = DEBT[_k]
    if _p > _tot:
        raise SystemExit(f"SEED SAI: công nợ #{_did} ({_k}) tổng {_tot} nhưng đã trả {_p}")

# ── KPI (tính từ chuyến) ────────────────────────────────────────────────────
INC = [  # (shipment, vehicle, reporter, type, severity, desc, loc, status, day)
    (100001, 100001, 100004, "traffic_jam",  "low",    "Kẹt xe kéo dài cao tốc Long Thành — Dầu Giây, trễ 1 tiếng", "Cao tốc Long Thành, Km 15", "resolved", "2026-06-10"),
    (100007, 100002, 100005, "customer_refusal", "medium", "Khách không có mặt, không liên lạc được — phải hoàn hàng", "KCN Sóng Thần, Bình Dương", "resolved", "2026-06-29"),
    (100009, 100002, 100005, "cargo_damage", "medium", "Một kiện máy bị trầy xước vỏ ngoài khi hạ hàng",            "KCN Sóng Thần, Bình Dương", "open",     "2026-07-12"),
]
kpi = {}
for s in DONE:
    key = (s[4], s[3], int(s[10][5:7]), 2026)
    c, r = kpi.get(key, (0, 0))
    kpi[key] = (c + 1, r + PRICE[s[0]])
inc_cnt = {}
for sid, _, rep, _, sev, _, _, _, day in INC:
    key = (rep, int(day[5:7]))
    a, b, c = inc_cnt.get(key, (0, 0, 0))
    inc_cnt[key] = (a + 1, b + (1 if sev in ("high",) else 0), c + (1 if sev == "critical" else 0))
W("INSERT INTO kpi_records (driver_id, vehicle_group_id, month, year, completed_shipments, total_revenue, incident_count, major_incident_count, critical_incident_count) VALUES\n")
W(",\n".join(
    f"    ({d}, {g}, {m}, {y}, {c}, {r}, {inc_cnt.get((d, m), (0,0,0))[0]}, "
    f"{inc_cnt.get((d, m), (0,0,0))[1]}, {inc_cnt.get((d, m), (0,0,0))[2]})"
    for (d, g, m, y), (c, r) in sorted(kpi.items(), key=lambda x: (x[0][3], x[0][2], x[0][0]))) + ";\n\n")

W("INSERT INTO incidents (shipment_id, vehicle_id, reported_by, incident_type, severity_level, description, location, status, resolved_by, resolution_note, occurred_at, resolved_at) VALUES\n")
W(",\n".join(
    f"    ({sid}, {vid}, {rep}, '{it}', '{sev}', '{desc}', '{loc}', '{st}', "
    f"{COORD if st == 'resolved' else 'NULL'}, "
    f"{chr(39) + 'Đã xử lý, thông báo khách' + chr(39) if st == 'resolved' else 'NULL'}, "
    f"TIMESTAMPTZ '{day} 10:00:00+07', "
    f"{f'TIMESTAMPTZ ' + chr(39) + day + ' 11:30:00+07' + chr(39) if st == 'resolved' else 'NULL'})"
    for sid, vid, rep, it, sev, desc, loc, st, day in INC) + ";\n\n")

W("INSERT INTO incident_evidences (incident_id, file_url) VALUES\n")
W(",\n".join(f"    ((SELECT id FROM incidents WHERE shipment_id = {sid}), "
             f"'https://res.cloudinary.com/demo/image/upload/sample.jpg')"
             for sid, _, _, _, _, _, _, _, _ in INC) + ";\n\n")

# ── nghỉ phép / chấm công / ứng lương / thưởng ──────────────────────────────
W("INSERT INTO leave_requests (driver_id, leave_date, leave_type, reason, status) VALUES\n")
W(",\n".join(f"    ({d}, DATE '{dt}', '{lt}', '{r}', 'approved')" for d, dt, lt, r in LEAVES) + ";\n\n")

W("INSERT INTO attendance_overrides (driver_id, work_date, status, notes, marked_by) VALUES\n")
W(",\n".join(f"    ({d}, DATE '{dt}', '{st}', '{n}', {COORD})" for d, dt, st, n in ATT) + ";\n\n")

block(f"""
INSERT INTO salary_advances (id, driver_id, amount, reason, request_month, request_year, status, approved_by, approved_at, paid_by, paid_at, reject_reason, created_at, updated_at) VALUES
    (100000, 100004, 3000000, 'Ứng lương lo việc gia đình', 6, 2026, 'paid',     {MANAGER}, TIMESTAMPTZ '2026-06-25 09:00:00+07', {ACCT}, TIMESTAMPTZ '2026-06-25 14:00:00+07', NULL, TIMESTAMPTZ '2026-06-25 08:00:00+07', TIMESTAMPTZ '2026-06-25 14:00:00+07'),
    (100001, 100005, 5000000, 'Ứng lương sửa nhà',          6, 2026, 'rejected', {MANAGER}, TIMESTAMPTZ '2026-06-25 10:00:00+07', NULL,   NULL, 'Mới vào làm, chưa đủ điều kiện ứng', TIMESTAMPTZ '2026-06-25 08:30:00+07', TIMESTAMPTZ '2026-06-25 10:00:00+07'),
    (100002, 100006, 2000000, 'Ứng lương đóng học phí con',  7, 2026, 'paid',     {MANAGER}, TIMESTAMPTZ '2026-07-25 09:00:00+07', {ACCT}, TIMESTAMPTZ '2026-07-25 15:00:00+07', NULL, TIMESTAMPTZ '2026-07-25 08:00:00+07', TIMESTAMPTZ '2026-07-25 15:00:00+07');

INSERT INTO driver_bonuses (driver_id, type, year, amount, notes, status, requested_by, approved_by, paid_by, requested_at, approved_at, paid_at) VALUES
    (100004, 'welfare_birthday', 2026, 200000, 'Sinh nhật tháng 6', 'paid',     {ACCT}, {MANAGER}, {ACCT}, TIMESTAMPTZ '2026-06-20 09:00:00+07', TIMESTAMPTZ '2026-06-21 09:00:00+07', TIMESTAMPTZ '2026-06-30 09:00:00+07'),
    (100003, 'special',          2026, 500000, 'Thưởng giao hàng gấp cho khách VIP', 'approved', {ACCT}, {MANAGER}, NULL, TIMESTAMPTZ '2026-07-10 09:00:00+07', TIMESTAMPTZ '2026-07-11 09:00:00+07', NULL),
    (100006, 'welfare_wedding',  2026, 1000000, 'Mừng cưới', 'pending',  {ACCT}, NULL, NULL, TIMESTAMPTZ '2026-07-24 09:00:00+07', NULL, NULL);

INSERT INTO payment_vouchers (id, voucher_type, amount, payee, reason, payment_method, status, created_by, approved_by, paid_by, approved_at, paid_at, created_at, updated_at) VALUES
    (100000, 'office',    1200000, 'Nhà sách Phương Nam', 'Mua giấy in, văn phòng phẩm quý 2',      'cash',          'paid',     {ACCT}, {MANAGER}, {ACCT}, TIMESTAMPTZ '2026-06-15 09:00:00+07', TIMESTAMPTZ '2026-06-15 14:00:00+07', TIMESTAMPTZ '2026-06-14 15:00:00+07', TIMESTAMPTZ '2026-06-15 14:00:00+07'),
    (100001, 'utilities', 2500000, 'Điện lực TP.HCM',     'Tiền điện văn phòng + kho tháng 6/2026', 'bank_transfer', 'paid',     {ACCT}, {MANAGER}, {ACCT}, TIMESTAMPTZ '2026-07-03 09:00:00+07', TIMESTAMPTZ '2026-07-04 10:00:00+07', TIMESTAMPTZ '2026-07-02 10:00:00+07', TIMESTAMPTZ '2026-07-04 10:00:00+07'),
    (100002, 'utilities', 2700000, 'Điện lực TP.HCM',     'Tiền điện văn phòng + kho tháng 7/2026', 'bank_transfer', 'pending',  {ACCT}, NULL, NULL, NULL, NULL, TIMESTAMPTZ '2026-07-28 10:00:00+07', TIMESTAMPTZ '2026-07-28 10:00:00+07');
""")

# ── bảo dưỡng ───────────────────────────────────────────────────────────────
block(f"""
INSERT INTO maintenance_records (id, vehicle_id, maintenance_type, description, cost, maintenance_date, next_due_date, performed_by, status, bill_pics, started_at, completed_at, created_by, completed_by, verified_by, verified_at) VALUES
    (100000, 100000, 'scheduled', 'Bảo dưỡng định kỳ 10.000km — thay dầu, lọc gió', 1500000, DATE '2026-06-08', DATE '2026-09-08', 100003, 'completed',
        '["https://res.cloudinary.com/demo/image/upload/sample.jpg"]'::jsonb, TIMESTAMPTZ '2026-06-08 08:00:00+07', TIMESTAMPTZ '2026-06-08 15:00:00+07', {MANAGER}, 100003, {MANAGER}, TIMESTAMPTZ '2026-06-08 16:00:00+07'),
    (100001, 100002, 'repair',    'Thay bộ lốp sau bị nứt hông',                    3200000, DATE '2026-07-05', NULL,               100005, 'completed',
        '["https://res.cloudinary.com/demo/image/upload/sample.jpg"]'::jsonb, TIMESTAMPTZ '2026-07-05 08:00:00+07', TIMESTAMPTZ '2026-07-05 14:00:00+07', {MANAGER}, 100005, {MANAGER}, TIMESTAMPTZ '2026-07-05 15:00:00+07'),
    (100002, 100001, 'inspection','Kiểm tra hệ thống phanh — tài xế báo có tiếng kêu', NULL, DATE '2026-07-29', NULL,              100004, 'requested',
        '[]'::jsonb, TIMESTAMPTZ '2026-07-29 08:00:00+07', NULL, NULL, NULL, NULL, NULL);

UPDATE maintenance_records SET requested_by = 100004, request_reason = 'Phanh có tiếng kêu lạ khi xuống dốc' WHERE id = 100002;

INSERT INTO vehicle_status_history (vehicle_id, action_type, from_status, to_status, reference_type, reference_id, note, created_by, created_at) VALUES
    (100000, 'send_to_maintenance',  'active',      'maintenance', 'maintenance_record', 100000, 'Bảo dưỡng định kỳ 10.000km', {MANAGER}, TIMESTAMPTZ '2026-06-08 08:00:00+07'),
    (100000, 'complete_maintenance', 'maintenance', 'active',      'maintenance_record', 100000, 'Đã xác nhận hoàn tất bảo dưỡng', {MANAGER}, TIMESTAMPTZ '2026-06-08 16:00:00+07'),
    (100002, 'send_to_maintenance',  'active',      'maintenance', 'maintenance_record', 100001, 'Thay lốp sau', {MANAGER}, TIMESTAMPTZ '2026-07-05 08:00:00+07'),
    (100002, 'complete_maintenance', 'maintenance', 'active',      'maintenance_record', 100001, 'Đã xác nhận hoàn tất', {MANAGER}, TIMESTAMPTZ '2026-07-05 15:00:00+07');

INSERT INTO vehicle_driver_assignments (vehicle_id, driver_id, previous_driver_id, action, note, created_by, created_at) VALUES
    (100000, 100003, NULL, 'assign', 'Gán xe khi nhận việc',        {MANAGER}, TIMESTAMPTZ '2023-03-01 08:00:00+07'),
    (100001, 100004, NULL, 'assign', 'Gán xe khi nhận việc',        {MANAGER}, TIMESTAMPTZ '2024-05-15 08:00:00+07'),
    (100002, 100005, NULL, 'assign', 'Gán xe khi nhận việc',        {MANAGER}, TIMESTAMPTZ '2025-11-01 08:00:00+07'),
    (100004, 100006, NULL, 'assign', 'Gán xe mới mua cho tài xế',   {MANAGER}, TIMESTAMPTZ '2025-09-20 08:00:00+07');
""")

# ── sổ nhật ký tài chính (sinh từ đúng các sự kiện tiền) ────────────────────
ft = []
for oid in CLOSED_ORDERS:
    day, pt = order_day(oid), PT[O[oid][1]]
    for s in ORDER_SHIPMENTS[oid]:
        if s[9] in ("completed", "returned") and PRICE[s[0]] > 0:
            ft.append((f"{day} 17:30:00", "shipment_revenue", "131", "511", PRICE[s[0]],
                       f"Doanh thu chuyến #{s[0]} — đơn #{oid}", "shipment", s[0], COORD))
    amt = order_receipt_amount(oid)
    if pt == "bank_transfer":
        ft.append((f"{day} 18:00:00", "bank_receipt", "1121", "131", amt,
                   f"Khách CK về công ty — phiếu thu #{RCPT[oid]}, đơn #{oid}", "shipment", last_shipment(oid)[0], ACCT))
    elif pt == "cash_collected":
        did = DEBT[f"d_{oid}"][0]
        ft.append((f"{day} 17:35:00", "driver_debt_created", "1388", "131", amt,
                   f"Tài xế thu tiền mặt từ khách — phiếu thu #{RCPT[oid]}, đơn #{oid}", "debt", did, last_shipment(oid)[4]))
    else:
        did = DEBT[f"c_{oid}"][0]
        ft.append((f"{day} 17:35:00", "customer_debt_created", "131", "131", amt,
                   f"Khách nhận nợ — phiếu thu #{RCPT[oid]}, đơn #{oid}", "debt", did, COORD))
for eid, sid, vid, drv, et, amt, desc, day, stt in E:
    if stt != "approved":
        continue
    if et in PASS_THROUGH:
        ft.append((f"{day} 17:00:00", "pass_through_cost", "3388", "1111", amt,
                   f"Chi hộ khách ({et}) — chuyến #{sid}", "expense", eid, COORD))
    else:
        ft.append((f"{day} 17:00:00", "expense_recorded", "642", "1111", amt,
                   f"Chi phí vận hành ({et}) — chuyến #{sid}", "expense", eid, COORD))
for key, amt, method, day, by, note in PAY:
    did, total = DEBT[key]
    real = total if amt is None else amt
    if key.startswith("d_"):
        ft.append((f"{day} 10:00:00", "driver_debt_paid", "1111", "1388", real,
                   f"Tài xế nộp tiền thu hộ — công nợ #{did}", "debt", did, ACCT))
    else:
        ft.append((f"{day} 10:00:00", "customer_payment", "1121", "131", real,
                   f"Khách hàng thanh toán — công nợ #{did}", "debt", did, ACCT))
ft += [
    ("2026-06-15 14:00:00", "expense_recorded", "642", "1111", 1200000, "Chi office — phiếu chi #100000", "voucher", 100000, ACCT),
    ("2026-06-25 14:00:00", "advance_disbursed", "141", "1111", 3000000, "Giải ngân ứng lương T6/2026 — Hoàng Minh Quân", "advance", 100000, ACCT),
    ("2026-06-30 09:00:00", "bonus_paid", "642", "1111", 200000, "Chi thưởng phúc lợi sinh nhật — Hoàng Minh Quân", None, None, ACCT),
    ("2026-07-04 10:00:00", "expense_recorded", "642", "1111", 2500000, "Chi utilities — phiếu chi #100001", "voucher", 100001, ACCT),
    ("2026-07-25 15:00:00", "advance_disbursed", "141", "1111", 2000000, "Giải ngân ứng lương T7/2026 — Lê Thanh Sơn", "advance", 100002, ACCT),
]
ft.sort(key=lambda x: x[0])
W("INSERT INTO financial_transactions (event_type, debit_account, credit_account, amount, description, ref_type, ref_id, actor_id, occurred_at) VALUES\n")
W(",\n".join(
    f"    ('{e[1]}', '{e[2]}', '{e[3]}', {e[4]}, '{e[5]}', "
    f"{chr(39) + e[6] + chr(39) if e[6] else 'NULL'}, {e[7] if e[7] else 'NULL'}, {e[8]}, TIMESTAMPTZ '{e[0]}+07')"
    for e in ft) + ";\n\n")

# ── hóa đơn VAT cho đơn công nợ ─────────────────────────────────────────────
inv_rows, invs_rows, inv_id = [], [], 100000
for oid in CLOSED_ORDERS:
    if PT[O[oid][1]] != "client_credit":
        continue
    day, sub = order_day(oid), order_receipt_amount(oid)
    inv_rows.append(f"    ({inv_id}, 'INV-2026-{inv_id - 99999:04d}', {O[oid][0]}, {oid}, {ACCT}, DATE '{day}', "
                    f"DATE '{day[:8]}28', 8.00, {sub}, 'sent', 'Hóa đơn GTGT đơn công nợ')")
    for s in ORDER_SHIPMENTS[oid]:
        invs_rows.append(f"    ({inv_id}, {s[0]}, {PRICE[s[0]] + passthrough_of(s[0])})")
    inv_id += 1
if inv_rows:
    # tax_amount / total_amount là cột GENERATED — không được insert
    W("INSERT INTO invoices (id, invoice_number, customer_id, order_id, created_by, invoice_date, due_date, tax_rate, subtotal, status, notes) VALUES\n")
    W(",\n".join(inv_rows) + ";\n\n")
    W("INSERT INTO invoice_shipments (invoice_id, shipment_id, line_amount) VALUES\n")
    W(",\n".join(invs_rows) + ";\n\n")

# ── sequences ───────────────────────────────────────────────────────────────
for t in ["accounts", "vehicle_groups", "vehicles", "customers", "partners", "orders",
          "order_shipments", "order_receipt_requests", "shipment_receipts", "debts",
          "expenses", "payment_vouchers", "salary_advances", "maintenance_records", "invoices"]:
    W(f"SELECT setval(pg_get_serial_sequence('{t}','id'), (SELECT MAX(id) FROM {t}));\n")

# Bảng lương: KHÔNG gõ tay (công thức 12 thành phần) — các dòng dưới do chính
# accountantPayrollRepository.calculateAndUpsertPayrolls() của backend tính ra
# trên DB đã nạp seed này, rồi xuất lại thành INSERT (xem gen_payroll.mjs).
try:
    payroll_sql = open("payrolls.sql", encoding="utf-8").read().strip()
except FileNotFoundError:
    payroll_sql = ""
if payroll_sql:
    W("\n-- ── Bảng lương T6 + T7/2026 ─────────────────────────────────────────────\n")
    W("-- Sinh bởi chính hàm tính lương của backend (calculateAndUpsertPayrolls) chạy\n")
    W("-- trên seed này, KHÔNG gõ tay (công thức có 12 thành phần).\n")
    W("-- Trạng thái 'pending' — chờ Manager duyệt rồi Kế toán chi.\n")
    W(payroll_sql + "\n")

open("seed_new.sql", "w", encoding="utf-8").write(out.getvalue())
open("master_data.sql", "w", encoding="utf-8").write(master.getvalue())

# ── in ra bảng đối chiếu để người đọc kiểm tay ─────────────────────────────
print("=== CHUYẾN ===")
for s in S:
    if s[9] in ("completed", "returned"):
        print(f"  #{s[0]} T{s[10][5:7]} tài {s[4]} {s[6]}km × {km_price[s[3]]:,} = {PRICE[s[0]]:,}"
              + (f"  [HOÀN HÀNG thu phí {s[11].get('fee',0):,}]" if s[9] == "returned" else ""))
print("\n=== PHIẾU THU (= cước + chi hộ) ===")
for oid in CLOSED_ORDERS:
    parts = [f"{PRICE[s[0]]:,}" for s in ORDER_SHIPMENTS[oid] if s[9] in ("completed", "returned")]
    pth = sum(passthrough_of(s[0]) for s in ORDER_SHIPMENTS[oid])
    print(f"  đơn #{oid} ({O[oid][1]}): {' + '.join(parts)}" + (f" + chi hộ {pth:,}" if pth else "")
          + f" = {order_receipt_amount(oid):,}")
print("\n=== KPI ===")
for (d, g, m, y), (c, r) in sorted(kpi.items(), key=lambda x: (x[0][2], x[0][0])):
    print(f"  tài {d} T{m}: {c} chuyến, {r:,}đ")
print("\n=== CÔNG NỢ ===")
for key, (did, total) in DEBT.items():
    print(f"  #{did} {key}: tổng {total:,} — đã trả {PAID.get(key,0):,} — còn {total - PAID.get(key,0):,}")
print(f"\nĐã ghi seed_new.sql ({len(out.getvalue().splitlines())} dòng)")
