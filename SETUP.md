# Project Setup Guide

## Overview

Dự án SEP490 bao gồm 3 module: Backend (Express + JWT), Frontend (React), Mobile (React Native Driver).  
Sử dụng PostgreSQL EDB schema thực tế với authentication, logistics, orders, và payroll management.

### ✅ Các Tính Năng Đã Tạo

#### 1. **Database (PostgreSQL EDB)**

- **File DB script**: [DB script/DB script.sql](DB%20script/DB%20script.sql) — Production schema
- **File seed**: [DB script/seed.sql](DB%20script/seed.sql) — Test data matched to schema
- **Core Tables**:
  - **Auth**: `accounts` (email, password_hash), `profiles` (roles), `roles` (admin, coordinator, accountant, driver)
  - **Fleet**: `vehicles`, `vehicle_groups`, `drivers`
  - **Logistics**: `orders`, `order_shipments`, `shipment_assignments`, `customers`
  - **Finance**: `expenses`, `payments`, `debts`, `payrolls`, `kpi_records`, `bonus_rules`
  - **Other**: `partners`, `notifications`, `activity_logs`, `incidents`, `maintenance_records`

#### 2. **Backend (Express.js)**

- **Port**: 9999
- **Database Schema**: PostgreSQL EDB with accounts + profiles (not users table)
- **Password Hashing**: bcrypt (gen_salt) via PostgreSQL crypt() function
- **JWT Auth**:
  - `POST /auth/login`: Đăng nhập (trả JWT token)
  - `GET /auth/me`: Lấy thông tin người dùng (yêu cầu token)
- **API Test**: `GET /roles` (test kết nối DB)
- **Note**: User management được thực hiện bằng SQL trực tiếp (manager không tự đăng ký)

#### 3. **Frontend (React)**

- **Theme**: Xanh tím (#6366F1) + Trắng
- **Pages**:
  - **Login**: `frontend/src/Login.jsx` + `Login.css`
  - **Dashboard**: `frontend/src/Dashboard.jsx` + `Dashboard.css`
    - Hiển thị thông tin người dùng
    - Quyền hạn theo role (Accountant, Manager, Coordinator)
    - Danh sách roles

#### 4. **Mobile (React Native)**

- **Login**: `mobile/DriverLogin.js`
- **Dashboard**: Hiển thị thông tin tài xế
- **Chức Năng**: Lộ trình, Giao hàng, Thống kê
- **Role**: Chỉ cho phép driver đăng nhập

---

## Setup Instructions

### 1️⃣ Database Setup

```bash
# Kết nối PostgreSQL
psql -U postgres -h localhost

# Chạy DB script (tạo schema, tables, extensions)
\i 'DB script/DB script.sql'

# Chạy seed script (insert test data)
\i 'DB script/seed.sql'

# Xác nhận
SELECT * FROM roles;
SELECT * FROM accounts;
SELECT * FROM profiles;
SELECT * FROM vehicles;
```

### 2️⃣ Backend Setup

```bash
cd backend

# Cài đặt dependencies
npm install

# Cấu hình .env (copy từ .env.example)
cp .env.example .env

# Điền thông tin database vào .env:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=your_db
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_SSL=false
# JWT_SECRET=your_secret_key

# Chạy server (port 9999)
npm start
```

**Test API**:

```bash
# Đăng nhập (dùng test account từ seed.sql)
curl -X POST http://localhost:9999/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"coordinator@example.com","password":"coord123"}'

# Lấy token từ response, sau đó test:
curl -H "Authorization: Bearer TOKEN_HERE" http://localhost:9999/auth/me

# Test DB: Lấy danh sách roles
curl http://localhost:9999/roles
```

### 3️⃣ Frontend Setup

```bash
cd frontend

# Cài đặt dependencies
npm install

# Chạy dev server (Vite)
npm start
```

**Features**:

- Login page với theme xanh tím + trắng
- Dashboard hiển thị vai trò và quyền hạn
- Danh sách roles từ database
- Test: Đăng nhập với `coordinator@example.com` / `coord123`

### 4️⃣ Mobile Setup

```bash
cd mobile

# Cài đặt dependencies
npm install

# Chạy Metro bundler
npm start

# Trên terminal khác:
npm run android  # Chạy trên Android emulator
# hoặc
npm run ios      # Chạy trên iOS simulator
```

**Features**:

- Driver login screen
- Dashboard với lộ trình, giao hàng, thống kê
- Xác nhận role = driver
- Test: Đăng nhập với `driver1@example.com` / `driver123`

---

## Test Accounts (từ seed.sql)

| Email                   | Role        | Password  |
| ----------------------- | ----------- | --------- |
| admin@example.com       | admin       | admin123  |
| coordinator@example.com | coordinator | coord123  |
| accountant@example.com  | accountant  | acct123   |
| driver1@example.com     | driver      | driver123 |

**Ghi chú**:

- Các mật khẩu được hash bằng bcryptjs extension (gen_salt) trong PostgreSQL.
- User được tạo manual bởi manager qua SQL INSERT/UPDATE hoặc admin panel.
- Không có endpoint `/auth/register` — người dùng được quản lý trực tiếp từ database.

---

## File Structure

```
SU26_SEP490_G62/
├── DB script/
│   ├── DB script.sql          # ✨ Production schema (accounts, profiles, orders, etc.)
│   └── seed.sql               # ✨ Test data matched to actual DB schema
├── backend/
│   ├── app.js                 # ✨ JWT auth endpoints (updated for accounts+profiles)
│   ├── .env                   # ✨ PostgreSQL + JWT config
│   ├── .env.example           # ✨ Template
│   ├── .gitignore             # ✨ Security
│   └── package.json           # ✨ +bcryptjs, jsonwebtoken, cors
├── frontend/
│   ├── src/
│   │   ├── Login.jsx          # ✨ Xanh tím + trắng theme
│   │   ├── Login.css          # ✨ Styling
│   │   ├── Dashboard.jsx      # ✨ Role-based dashboard
│   │   ├── Dashboard.css      # ✨ Styling
│   │   └── App.jsx            # ✨ Login + Dashboard flow
│   └── public/
│       └── index.html
├── mobile/
│   ├── DriverLogin.js    # ✨ Mới: Driver login
│   └── App.js            # ✨ Cập nhật: Dashboard + logout
├── .gitignore            # ✨ Mới
└── README.md
```

---

## Hướng Dẫn Sử Dụng

### Web (Frontend)

1. Chạy Backend: `cd backend && npm start`
2. Chạy Frontend: `cd frontend && npm start`
3. Mở `http://localhost:5173` (Vite default)
4. Đăng nhập với: `coordinator@example.com` / `coord123` (hoặc accountant/admin)
5. Xem Dashboard với role-specific permissions

### Mobile (React Native)

1. Chạy Backend: `cd backend && npm start`
2. Chạy Mobile: `cd mobile && npm start`
3. Chọn Android/iOS platform
4. Đăng nhập với: `driver1@example.com` / `driver123`
5. Xem Driver Dashboard

---

## Lưu Ý Bảo Mật

- 🔐 JWT_SECRET: Thay đổi trong production
- 🔐 .env: Không commit vào git (.gitignore đã bao gồm)
- 🔐 Password hash: Được hash bằng `crypt()` + bcrypt (gen_salt) trong seed.sql
- 🔐 CORS: Cấu hình cho production domains
- 🔐 Accounts: Manager thêm/xoá user trực tiếp qua SQL hoặc admin panel (không tự đăng ký)

---
