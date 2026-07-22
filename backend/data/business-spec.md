# DRIVER MODULE SPECIFICATION V3.3

# 1. PURPOSE

Tài liệu mô tả đầy đủ nghiệp vụ Driver trong hệ thống quản lý vận tải.

Tài liệu là nguồn chuẩn để:

* Thiết kế Database
* Thiết kế Backend API
* Thiết kế Mobile App
* Thiết kế Dashboard
* Thiết kế Test Case
* Thiết kế KPI & Payroll

---

# 2. BUSINESS OVERVIEW

## 2.1 Business Structure

```text
Customer
    ↓
Order
    ↓
Trip
    ↓
Stops
```

## 2.2 Business Principle

Order chỉ là đối tượng nghiệp vụ dùng để:

* Gom nhóm các Trip
* Theo dõi khách hàng
* Theo dõi thanh toán
* Theo dõi công nợ
* Theo dõi hóa đơn

Driver KHÔNG thao tác trên Order.

Driver chỉ thao tác trên Trip.

---

# 3. DRIVER ROLE

Driver chịu trách nhiệm:

## Operation

* Nhận Trip
* Thực hiện Trip
* Cập nhật trạng thái Trip

## Delivery

* Xác nhận lấy hàng (upload ảnh realtime)
* Xác nhận giao hàng (upload ảnh realtime)

## Finance

* Thu hộ tiền khách (nếu được chỉ định)
* Yêu cầu tạo phiếu thu (gửi actual_km để coordinator chốt)
* Báo cáo chi phí
* Theo dõi công nợ

## Incident

* Báo cáo sự cố

## Maintenance

* Gửi yêu cầu bảo dưỡng xe (status = requested → Manager duyệt thành open + xe sang MAINTENANCE, hoặc từ chối kèm lý do)
* Thực hiện bảo dưỡng được duyệt: upload hóa đơn, nhập chi phí, hoàn thành

## KPI

* Theo dõi KPI
* Theo dõi bảng xếp hạng

## Payroll

* Theo dõi lương
* Theo dõi thưởng
* Theo dõi ứng lương

---

# 4. DRIVER - VEHICLE MODEL

## BR-001

Mỗi Driver gắn cố định với một Vehicle.

```text
1 Driver ↔ 1 Vehicle
```

## BR-002

Vehicle thuộc một Vehicle Group.

Ví dụ:

* 500kg
* 1T25
* 2T5
* 5m2
* 8m2

## BR-003

Driver chỉ nhìn thấy Trip phù hợp Vehicle Group.

---

# 5. DASHBOARD

## Hiển thị

### Active Trip

* Trip hiện tại
* Trạng thái
* Điểm tiếp theo

### Trip Pool

* Trip khả dụng

### KPI Summary

* Completed Trips
* Revenue KPI
* Incident Count

### Finance Summary

* Driver Debt
* Salary
* Bonus

### Incident Summary

* Open Incident
* Closed Incident

---

# 6. TRIP POOL

## Definition

Trip Pool là danh sách Trip chưa có Driver.

## Điều kiện

Status:

```text
AVAILABLE
```

Vehicle Group phù hợp.

## BR-004

Driver không nhìn thấy Trip đã được nhận.

---

# 7. CLAIM TRIP

## Flow

```text
Trip Pool
   ↓
Claim Trip
   ↓
Validate
   ↓
Success
```

## BR-005

Driver chỉ được có:

```text
1 Active Trip
```

## Active Status

```text
CLAIMED
PICKING
TRANSIT
ARRIVED
RETURNING
```

## BR-006

Nếu tồn tại Active Trip:

```text
Reject Claim
```

## BR-007

Claim phải xử lý Atomic Lock.

---

# 8. MULTI ORDER / MULTI TRIP

## Scenario

```text
Order A

Trip 1
Trip 2
Trip 3
```

Trip hoạt động độc lập.

## BR-008

Một Order có thể được thực hiện bởi nhiều Driver.

Ví dụ:

```text
Trip 1 → Driver A
Trip 2 → Driver B
Trip 3 → Driver C
```

---

# 8A. MULTI-DRIVER ORDER — PAYMENT COLLECTION

## Scenario

Order có nhiều Trip, khách thanh toán tiền mặt cho driver thu tiền.

Ví dụ:

```text
Order A — cash_collected

Trip 1 → Driver A  (chỉ vận chuyển — không thu tiền)
Trip 2 → Driver B  (chỉ vận chuyển — không thu tiền)
Trip 3 → Driver C  (thu tiền mặt của khách)
```

## BR-008A — Tất cả driver sau COMPLETED

Mọi driver sau khi COMPLETED đều bắt buộc nhập actual_km:

```text
ARRIVED
  ↓
Upload Delivery Proof (camera realtime)
  ↓
COMPLETED
  ↓
Nhập actual_km (bắt buộc)
  ↓
  ├─ is_final_shipment = true  &&  payment_type = cash
  │    → Gửi order_receipt_requests (yêu cầu phiếu thu)
  └─ Mọi trường hợp còn lại
       → Lưu actual_km, xong
```

`is_final_shipment` = shipment có index cao nhất trong order.

KPI được tính ngay khi COMPLETED — không phụ thuộc km hay phiếu thu.

## BR-008B — Driver cuối đơn cash

Driver cuối (`is_final_shipment = true`) của đơn `payment_type = cash`:

```text
COMPLETED
  ↓
Nhập actual_km (bắt buộc)
  ↓
Gửi order_receipt_requests
  ↓
Coordinator tạo phiếu thu
  ↓
Driver Debt được ghi nhận
```

## BR-008C — Concurrent Completion

Khi 2 driver cùng hoàn thành cùng lúc trong cùng order:

* DB atomic lock quyết định thứ tự COMPLETED.
* Driver nào commit transaction trước → là driver cuối nếu tất cả trips trong order = COMPLETED.
* Driver còn lại COMPLETED bình thường — chỉ nhập km, không tạo receipt request.

---

# 9. TRIP LIFECYCLE

## Main Flow

```text
AVAILABLE
↓
CLAIMED
↓
PICKING
↓
TRANSIT
↓
ARRIVED
↓
COMPLETED
```

## Alternative Status

```text
FAILED
RETURNING
CANCELLED
```

## BR-009

Không được bỏ qua trạng thái.

## BR-010

Mỗi trạng thái phải lưu timestamp.

```text
claimed_at
picking_at
transit_at
arrived_at
completed_at
failed_at
returning_at
cancelled_at
```

---

# 10. MULTI STOP

## Definition

Một Trip có thể chứa nhiều Stop.

Ví dụ:

```text
Pickup A
Pickup B
Delivery C
Delivery D
```

## Stop Type

### PICKUP

Điểm lấy hàng.

### DELIVERY

Điểm giao hàng.

## BR-011

Stop phải thực hiện đúng thứ tự.

Không được bỏ qua Stop.

---

# 11. TRIP RUN (X2C / X3C)

## Definition

Một Trip có thể yêu cầu nhiều lượt vận chuyển.

Ví dụ:

```text
A → B

x2c
```

## Flow

```text
Run 1
A → B

Run 2
A → B
```

## BR-012

Trip chỉ hoàn thành khi toàn bộ Run hoàn thành.

---

# 12. LOADING PROOF

## Flow

```text
PICKING
↓
Upload Loading Proof (camera realtime)
↓
TRANSIT
```

Không có trạng thái trung gian LOADED.
Sau khi upload ảnh lấy hàng thành công → chuyển thẳng sang TRANSIT.

## BR-013

Tối thiểu 1 ảnh.

## BR-014

Ảnh phải chụp realtime — không được upload từ thư viện.

---

# 13. DELIVERY PROOF

## Flow

```text
ARRIVED
↓
Capture Photo (camera realtime)
↓
COMPLETED
```

## BR-015

Tối thiểu 1 ảnh.

## BR-016

Không cho upload từ thư viện.

## BR-017

Phải sử dụng camera realtime.

---

# 14. PHIẾU THU (RECEIPT REQUEST FLOW)

## Vai trò

Driver KHÔNG tự tạo phiếu thu.

Driver chỉ gửi **yêu cầu** tạo phiếu thu.

Coordinator là người **tạo phiếu thu thực tế**.

## Loại Receipt Request duy nhất

Dùng bảng: `order_receipt_requests`

Driver cuối (`is_final_shipment = true`) của đơn cash gửi 1 request cho toàn bộ order.

## Điều kiện

| Trường hợp | Sau COMPLETED làm gì |
|---|---|
| Mọi driver | Nhập `actual_km` (bắt buộc) |
| `is_final_shipment = true` + `payment_type = cash` | Nhập `actual_km` + gửi `order_receipt_requests` |
| Tất cả còn lại | Chỉ lưu `actual_km`, không cần thêm |

## Flow

```text
Driver cuối đơn cash (COMPLETED)
  ↓
Nhập actual_km
  ↓
Gửi order_receipt_requests (status = pending)
  ↓
Coordinator nhận notification
  ↓
Coordinator duyệt { amount } (không set payment_type)
  ↓
INSERT shipment_receipts (payment_type = NULL — chờ driver xác nhận)
UPDATE order_shipments SET actual_price = amount, actual_distance_km = actual_km
  ↓
Driver nhận notification: phiếu thu đã tạo
  ↓
Driver mở Receipt Detail → chọn 1 trong 3 nút thanh toán
  ↓
POST /api/trips/receipts/:id/record-collection { payment_type, proof }
  ↓
shipment_receipts.payment_type được cập nhật + debt tạo tự động
```

## Trạng thái yêu cầu

```text
pending    → đang chờ coordinator
processing → coordinator đang xử lý
approved   → đã tạo phiếu thu
rejected   → bị từ chối (có lý do)
```

## BR-018

Mỗi order chỉ được gửi 1 yêu cầu `order_receipt_requests`.

## BR-019

Coordinator phải nhập payment_type và amount khi duyệt.

## Driver xác nhận thanh toán (3 nút trên Receipt Detail)

Sau khi coordinator tạo phiếu thu, driver mở màn hình Receipt Detail và chọn:

| Nút | payment_type | Bằng chứng | Công nợ |
|---|---|---|---|
| Khách chuyển khoản về công ty | `bank_transfer` | Ảnh bắt buộc | Không tạo debt |
| Khách trả tiền mặt cho tài | `cash_collected` | Ảnh bắt buộc | Driver Debt |
| Khách nợ (chưa thanh toán) | `client_credit` | Không cần | Customer Debt |

Màn hình luôn hiển thị QR code ngân hàng công ty (lấy từ `companyInfo.bank_qr_url`) để driver show cho khách chuyển khoản.

Endpoint: `POST /api/trips/receipts/:receiptId/record-collection`
Body: `{ payment_type }` + file `proof` (ảnh từ camera realtime, bắt buộc với bank_transfer và cash_collected)

## Ghi nhận actual_price và actual_distance_km

Khi coordinator approve:

* `order_shipments.actual_price` = amount coordinator xác nhận
* `order_shipments.actual_distance_km` = actual_km driver nhập

---

# 15. PAYMENT BUSINESS

## Nguyên tắc

Mỗi sự kiện tiền tệ phải sinh 1 bản ghi vào `financial_transactions` (append-only ledger).

## TH1

Khách thanh toán công ty (bank_transfer / qr_transfer).

```text
No Driver Debt
→ financial_transactions: event_type = bank_receipt / prepaid_received
```

## TH2

Khách thanh toán Driver (cash_collected).

```text
Coordinator tạo phiếu thu (amount, payment_type = NULL)
  ↓
Driver mở Receipt Detail → chọn "Khách trả tiền mặt cho tài"
  ↓
Driver chụp ảnh xác minh → gửi POST record-collection
  ↓
BE: UPDATE shipment_receipts SET payment_type = 'cash_collected'
    INSERT payment_receipts (ảnh bằng chứng)
    INSERT debts (debt_type = 'driver')
    INSERT financial_transactions (event_type = 'driver_debt_created')
```

## TH1 — Khách chuyển khoản về công ty

```text
Coordinator tạo phiếu thu
  ↓
Driver mở Receipt Detail → show QR → chọn "Khách chuyển khoản về công ty"
  ↓
Driver chụp ảnh xác minh (screenshot chuyển khoản) → gửi POST record-collection
  ↓
BE: UPDATE shipment_receipts SET payment_type = 'bank_transfer'
    INSERT payment_receipts (ảnh bằng chứng)
    (Không tạo debt — kế toán xác nhận tiền về → INSERT financial_transactions 'bank_receipt')
```

## TH3

Khách chưa thanh toán.

```text
Driver mở Receipt Detail → chọn "Khách nợ"
  ↓
BE: UPDATE shipment_receipts SET payment_type = 'client_credit'
    INSERT debts (debt_type = 'customer')
    INSERT financial_transactions (event_type = 'customer_debt_created')
```

---

# 16. DRIVER DEBT

## Definition

Driver Debt là khoản tiền Driver đã thu hộ nhưng chưa nộp công ty.

## Flow

```text
Customer Pay
      ↓
Driver Debt
      ↓
Remittance
      ↓
Debt Reduced
```

## BR-020

Cho phép nộp nhiều lần.

Ví dụ:

```text
10 triệu

3 triệu
2 triệu
5 triệu
```

---

# 17. EXPENSE REPORTING

## Expense Types

Khách chi trả (pass-through):

* Toll (Phí cầu đường)
* Parking (Phí đỗ xe)
* ETC (Phí thu không dừng)

Công ty chi trả:

* Fuel (Xăng dầu / nhiên liệu)
* Repair (Sửa xe)

## Flow

```text
Create Expense
      ↓
Upload Receipt / Ảnh chứng từ
      ↓
Submit
```

## BR-021

Expense phải có:

* Type
* Amount
* Receipt (ảnh chứng từ)

## BR-022

Expense gắn với Vehicle.

## Phân biệt Expense và Pass-Through Cost

|                    | Pass Through Cost | Expense                        |
| ------------------ | ----------------- | ------------------------------ |
| Ai chịu           | Khách hàng      | Công ty / Driver ứng trước |
| Ghi nhận          | Trong phiếu thu  | Trong bảng expenses           |
| Ảnh chứng từ    | Không bắt buộc | Bắt buộc                     |
| Tính vào KPI     | KHÔNG            | KHÔNG                         |
| Tính vào Revenue | KHÔNG            | KHÔNG                         |

---

# 18. INCIDENT MANAGEMENT

## Incident Types

* Vehicle Breakdown
* Cargo Damage
* Road Incident (Traffic Accident)
* Customer Refusal
* Traffic Jam
* Other

## Flow

```text
Driver
    ↓
Create Incident
    ↓
Coordinator
    ↓
Manager
    ↓
Resolved
```

## BR-023

Driver không được tự đóng Incident.

---

# 19. VEHICLE BREAKDOWN FLOW

## Scenario

Xe hỏng giữa đường.

## Flow

```text
Vehicle Breakdown
        ↓
Incident (type: vehicle_breakdown)
        ↓
Coordinator nhận notification
        ↓
Coordinator điều xe thay thế
Coordinator điều driver thay thế
        ↓
Resolve Incident
        ↓
Mark Broken xe cũ (vehicle lifecycle)
```

## BR-024

Driver không được tự đổi xe.

## BR-025

Driver không được tự điều phối Driver khác.

---

# 20. KPI

## KPI Components

### Completed Trips

Số Trip hoàn thành.

### Revenue KPI

Tổng doanh thu Trip (tính theo actual_price, fallback estimated_price).

### Incident KPI

Số sự cố phát sinh (tổng / nghiêm trọng / khẩn cấp).

## BR-030 — KPI Timing

KPI được tính ngay khi Trip COMPLETED.

Không phụ thuộc:

* payment_type của order
* Thời điểm khách thanh toán
* Thời điểm coordinator tạo phiếu thu

```text
Mọi driver hoàn thành trip đều nhận KPI cho trip đó ngay lập tức.
Không phân biệt driver có thu tiền hay không.
```

---

# 21. REVENUE KPI

## BR-026

Revenue KPI tính theo:

```text
Actual Trip Price (actual_price)
Fallback: estimated_price nếu actual_price chưa được coordinator chốt
```

Ví dụ:

```text
Trip A = 500k
Trip B = 700k
```

Revenue KPI:

```text
1.2 triệu
```

`actual_price` được chốt khi coordinator approve phiếu thu.

---

# 22. PASS THROUGH COST

Ví dụ:

* BOT
* Phà
* Vé bãi
* Toll (khi khách trả)

Bản chất: Thu hộ / Chi hộ.

Khách thanh toán thêm ngoài cước xe — không phải doanh thu doanh nghiệp.

## BR-027

Không tính vào:

* KPI
* Revenue KPI
* Bonus Revenue

---

# 23. LEADERBOARD

## Rule

Leaderboard tính theo Vehicle Group.

Ví dụ:

```text
Top 5 xe 5m2
Top 5 xe 8m2
```

## BR-028

Không so sánh giữa các nhóm xe khác nhau.

## Chu kỳ

Tháng.

## Tiêu chí

* Doanh thu (revenue_rank)
* Số chuyến (trips_rank)

---

# 24. PAYROLL

## Income

* Base Salary
* KPI Bonus
* Revenue Bonus
* Special Bonus
* Thưởng & Phúc lợi (driver_bonuses status = approved trong kỳ — Tết, hiếu hỉ, đặc biệt)

## Deduction

* Driver Debt còn tồn đọng
* Penalty
* Advance Recovery (hoàn ứng lương)

## Formula

```text
Net Salary
=
Gross Salary
+
Bonus
-
Penalty
-
Outstanding Driver Debt
-
Advance Recovery
```

## Chi lương (markPayrollPaid)

Khi kế toán đánh dấu "Đã thanh toán lương", trong 1 transaction:

* Bonus approved trong kỳ → chuyển status = 'paid' (chi qua lương, không chi lẻ)
* Driver Debt đã khấu trừ → INSERT debt_payments (method = 'offset', confirmed) phân bổ FIFO nợ cũ nhất trước
* Ghi financial_transactions: 'payroll_paid' + 'driver_debt_paid'

---

# 25. SALARY ADVANCE

## Flow

```text
Driver Request
      ↓
Manager Approve
      ↓
Accountant Disburse
```

## BR-029

Driver không được tự duyệt.

Khoản ứng đã giải ngân được trừ ngay vào lương của tháng ứng (advance recovery).

---

# 26. PERMISSION MATRIX

| Function                     | Driver | Coordinator | Manager | Accountant |
| ---------------------------- | ------ | ----------- | ------- | ---------- |
| View Trip Pool               | YES    | YES         | YES     | NO         |
| Claim Trip                   | YES    | NO          | NO      | NO         |
| Update Trip Status           | YES    | YES*        | YES*    | NO         |
| Upload Loading Proof         | YES    | NO          | NO      | NO         |
| Upload Delivery Proof        | YES    | NO          | NO      | NO         |
| Request Receipt (phiếu thu) | YES    | NO          | NO      | NO         |
| Create Receipt (phiếu thu)  | NO     | YES         | NO      | NO         |
| Approve / Reject Receipt     | NO     | YES         | YES     | NO         |
| Create Cash Payment          | YES    | NO          | NO      | NO         |
| Create Expense               | YES    | YES         | NO      | NO         |
| Approve Expense              | NO     | YES         | YES     | NO         |
| Create Incident              | YES    | YES         | YES     | NO         |
| Resolve Incident             | NO     | YES         | YES     | NO         |
| Create Order                 | NO     | YES         | YES     | NO         |
| Create Trip                  | NO     | YES         | YES     | NO         |
| Import Excel                 | NO     | YES         | YES     | NO         |
| Assign Driver / Vehicle      | NO     | YES         | YES     | NO         |
| Cancel Trip                  | NO     | YES         | YES     | NO         |
| Replace Vehicle / Driver     | NO     | YES         | YES     | NO         |
| View KPI                     | YES    | YES         | YES     | NO         |
| View Own Salary              | YES    | NO          | NO      | NO         |
| View All Drivers' Salary     | NO     | YES         | YES     | YES        |
| View Leaderboard             | YES    | YES         | YES     | NO         |
| Request Salary Advance       | YES    | NO          | NO      | NO         |
| Approve Salary Advance       | NO     | NO          | YES     | NO         |
| Disburse Salary Advance      | NO     | NO          | NO      | YES        |
| Finalize Payroll             | NO     | NO          | YES     | YES        |
| Vehicle Lifecycle Management | NO     | YES         | YES     | NO         |
| Customer Management          | NO     | YES         | YES     | NO         |
| User / Account Management    | NO     | NO          | YES     | NO         |
| View Dashboard / Reports     | NO     | YES         | YES     | YES        |
| Record Customer Payment      | NO     | NO          | NO      | YES        |
| Manage Customer Debt         | NO     | NO          | NO      | YES        |
| Export Invoice               | NO     | NO          | YES     | YES        |
| Configure Bonus Rules        | NO     | NO          | YES     | NO         |

*YES\* = Force update bởi coordinator / manager trong trường hợp xử lý sự cố.

---

# 27. AUDIT REQUIREMENTS

Hệ thống phải lưu:

* Claim History
* Status Change History (ai đổi, từ status nào → status nào, khi nào)
* Expense History
* Incident History (tạo / xử lý / resolve)
* Debt History (customer debt + driver debt)
* Payroll History
* Vehicle Status History
* Receipt Request History

Toàn bộ thay đổi phải có:

* User (người thực hiện)
* Timestamp
* Action
* Before Value
* After Value

---

# 28. SUCCESS METRICS

Driver Module được coi là hoàn chỉnh khi hỗ trợ đầy đủ:

* Trip Pool
* Claim Trip
* Multi Stop
* Multi Run
* Loading Proof (PICKING → TRANSIT)
* Delivery Proof
* Receipt Request Flow (Driver → Coordinator) — bao gồm multi-driver order
* Driver Cash Payment
* Driver Debt
* Expense Reporting
* Incident Reporting
* KPI (Completed Trips / Revenue / Incident) — tính ngay khi COMPLETED
* Payroll
* Salary Advance
* Leaderboard (monthly, per vehicle group)
* Audit Tracking
