# Accountant Business Notes

> File ghi nhớ nghiệp vụ sống. Mỗi khi user cập nhật nghiệp vụ mới, cần bổ sung vào đây để đồng bộ giữa user và agent.
> Cập nhật gần nhất: 2026-06-09

---

## 1. Mục tiêu module Accountant

- Màn hình của kế toán **không dùng để tạo đơn mới cho điều phối chạy xe**.
- Kế toán dùng màn hình này để **nhập lại các đơn/chuyến đã hoàn thành vào hệ thống**.
- Mục tiêu là phục vụ:
  - kiểm soát **thu**
  - kiểm soát **chi**
  - theo dõi **công nợ khách hàng**
  - theo dõi **tài xế đã thu hộ và đã nộp quỹ hay chưa**
  - làm dữ liệu đầu vào cho báo cáo doanh thu / đối soát sau này

---

## 2. Cấu trúc dữ liệu nhập

### 2.1 Mô hình dữ liệu

- **1 Order** có **N Shipments** (N chuyến xe).
- Mỗi **Shipment** có: xe, tài xế, nhiều điểm lấy, 1 điểm giao, cước xe, vé, doanh thu riêng.
- Mỗi **Shipment** có **N Expenses** (chi phí linh hoạt: sửa xe, thay lốp, đổ dầu, BOT, vé bến...).
- Chi phí mỗi chuyến được lưu vào bảng `expenses` với `shipment_id`.

### 2.2 Đơn hàng (Order)

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| Ngày đơn | Có | Ngày kế toán nhập đơn |
| Khách hàng | Có | Tên + SĐT |
| Công ty | Không | Tên công ty |

### 2.3 Chuyến xe (Shipment) — có thể thêm nhiều

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| Xe | Không | Chọn từ danh sách |
| Tài xế | Không | Chọn từ danh sách |
| Điểm lấy | Có (ít nhất 1) | Nhiều điểm lấy, mỗi điểm nhập riêng |
| Điểm giao | Có | Điểm giao cuối cùng |
| Tên hàng | Không | |
| Khối lượng (kg) | Không | |
| Cước xe (VND) | Có | |
| Vé / phụ phí (VND) | Không | |
| Doanh thu (VND) | Không | Mặc định = cước xe |
| Hình thức thanh toán | Có | Tiền mặt / Chuyển khoản / Khách nợ |
| Tiền hiện ở đâu | Có (chỉ khi tiền mặt/CK) | Đã về công ty / Tài xế đang giữ |
| Chi phí chuyến | Không | Danh sách chi phí linh hoạt |

### 2.4 Chi phí chuyến (Expense) — thuộc 1 shipment

Các loại chi phí được phép: `fuel`, `toll`, `parking`, `repair`, `maintenance`, `depreciation`, `other`

| Trường | Bắt buộc | Mô tả |
|--------|----------|--------|
| Loại chi phí | Có | Chọn từ danh sách |
| Số tiền (VND) | Có | Số > 0 |
| Mô tả | Không | Ghi chú thêm |

---

## 3. Quy tắc thanh toán / công nợ

### 3.1 Hình thức thanh toán

**CHỈ 3 loại, không có kết hợp:**
- `cash` — Tiền mặt
- `bank_transfer` — Chuyển khoản
- `debt` — Khách nợ

### 3.2 Tiền hiện ở đâu

- Chỉ hiển thị khi hình thức thanh toán là **Tiền mặt** hoặc **Chuyển khoản**.
- Khi chọn **Khách nợ** → ẩn hẳn phần này, không cho chọn.
- 2 lựa chọn:
  - `company_received` — Tiền đã về công ty
  - `driver_holding` — Tài xế đã thu nhưng chưa nộp công ty (tạo driver debt)
  - `customer_debt` **KHÔNG** còn là option ở đây — nợ khách hàng chỉ xảy ra khi chọn "Khách nợ" ở hình thức thanh toán. (tạo customer debt)

### 3.3 Luồng xử lý nợ

- Nếu `payment_type = debt` → ghi nợ vào khách hàng (`debts.type='customer'`), cập nhật `customers.current_debt`.
- Nếu `driver_payment_state = driver_holding` → ghi nợ vào tài xế (`debts.type='driver'`).
- Nếu tiền đã về công ty (`company_received`) + không phải debt → ghi nhận `debt_payments`, không tạo công nợ.

---

## 4. Quy tắc địa chỉ hành trình

- Mỗi shipment có **nhiều điểm lấy hàng** (pickup).
- Mỗi shipment có **1 điểm giao hàng** (delivery).
- Các điểm lấy = `stop_type = 'pickup'`, điểm giao = `stop_type = 'delivery'`.
- Dữ liệu địa chỉ lưu trong `trip_stops`, không lưu trực tiếp trên `orders`.

---

## 5. Schema liên quan

- `orders`: `cargo_name`, `cargo_weight_kg`, `payment_type`, `total_estimated_price`, `total_actual_price`, `derived_status`, `notes`
- `order_shipments`: `vehicle_id`, `owner_driver_id`, `estimated_price`, `actual_price`, `status = 'completed'`
- `trip_stops`: `shipment_id`, `stop_index`, `stop_type`, `address`
- `expenses`: `shipment_id`, `vehicle_id`, `expense_type`, `amount`, `description`, `expense_date`
- `debts`: `debt_type`, `driver_id`/`customer_id`, `order_id`, `shipment_id`, `total_amount`, `paid_amount`, `status`

---

## 6. Quy tắc chọn xe và tài xế

- Chọn từ **danh sách dropdown có search**, không nhập text tự do.
- Chọn xe → tự động gợi ý tài xế gắn xe đó.
- Chọn tài xế → tự động gợi ý xe gắn tài xế đó.
- Quan hệ: `vehicles.assigned_driver_id → profiles.id`, `drivers.vehicle_id → vehicles.id`.

---

## 7. API liên quan

- `GET /accountant/orders/lookup` — lấy danh sách xe + tài xế
- `POST /accountant/orders` — tạo 1 order + n shipments + chi phí từng shipment + công nợ
- `GET /accountant/orders` — danh sách order đã nhập
- `GET /accountant/orders/:id/payments` — lịch sử thanh toán
- `POST /accountant/orders/:id/payments` — ghi nhận thanh toán thêm
