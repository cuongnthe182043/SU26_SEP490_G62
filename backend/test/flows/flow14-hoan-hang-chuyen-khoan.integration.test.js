/**
 * L2-FLOW-14 — Hoàn hàng (return-goods) trên đơn CHUYỂN KHOẢN (payment_type = 'bank_transfer')
 *
 * Bug đã sửa: order_shipments.actual_price của chuyến hoàn hàng CHỈ từng được chốt (x2 cước)
 * bên trong approveReceiptRequest — mà order_receipt_requests CHỈ được tạo cho đơn
 * payment_type = 'cash' (requestOrderReceipt trong tripService.js). Với đơn bank_transfer,
 * không có request nào được tạo → actual_price không bao giờ được ghi → BR-026 fallback vĩnh
 * viễn về estimated_price (giá MỘT CHIỀU cũ, trước khi hoàn hàng) — doanh thu/KPI sai một nửa.
 *
 * Kịch bản: đơn bank_transfer 1 chuyến — driver chạy tới ARRIVED → giao thất bại (FAILED) →
 * coordinator cho hoàn hàng (RETURNING, x2 cước) → driver xác nhận đã hoàn hàng (COMPLETED) →
 * driver nhập km thực tế qua requestOrderReceipt (BR-008A, bắt buộc với MỌI driver).
 *
 * Kỳ vọng SAU khi sửa: actual_price được chốt = actual_km × price_per_km × 2 NGAY tại bước
 * nhập km — không cần và không có order_receipt_requests nào được tạo (đơn không phải cash).
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let tripService;
let coordinatorService;

const DRIVER_ID = 4;
const COORD_ID = 2;
const PRICE_PER_KM = 15000;
const ACTUAL_KM = 40;
const EXPECTED_ACTUAL_PRICE = ACTUAL_KM * PRICE_PER_KM * 2; // 1.200.000 — gấp đôi vì chạy cả hai chiều

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    tripService = require('../../services/tripService');
    coordinatorService = require('../../services/coordinatorService');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payment_receipts, shipment_receipts,
                 order_receipt_requests, delivery_proofs, trip_stops,
                 shipment_assignment_history, shipment_revenue_allocations, kpi_records, expenses,
                 incidents, order_shipments, orders, customers, vehicles, vehicle_groups, drivers,
                 profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com','hash',1),(2,'coord@test.com','hash',2),
        (3,'acct@test.com','hash',3),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Manager',1),(2,'Coordinator',2),(3,'Accountant',3),(4,'Driver A',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', ${PRICE_PER_KM})`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1, '51E-246.80', 1, 4, 'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4, 1, 1, 'DL-1', CURRENT_DATE)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1, 'individual', 'Nguyen Van B', '0987654321')`);
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
        VALUES (1, 1, 2, 'Hang dien tu', 'bank_transfer', 300000)
    `);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status)
        VALUES (1, 1, 1, 1, 300000, 20, 'available')
    `);
    await pool.query(`
        INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
        (1, 1, 'pickup', '1 Le Loi, Q1'), (1, 2, 'delivery', '2 Vo Van Ngan, Thu Duc')
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-14 — Hoàn hàng trên đơn chuyển khoản: actual_price phải được chốt dù không có phiếu thu', () => {
    it('B1 — Driver chạy tới ARRIVED rồi báo giao thất bại', async () => {
        await tripService.claimTrip(1, DRIVER_ID);
        await tripService.updateStatus(1, DRIVER_ID, 'picking');
        await tripService.startTransit(1, DRIVER_ID, 'https://proof-loading.test/1.jpg');
        await tripService.updateStatus(1, DRIVER_ID, 'arrived');
        await tripService.updateStatus(1, DRIVER_ID, 'failed', 'Khách từ chối nhận hàng');

        const { rows: [s] } = await pool.query('SELECT status FROM order_shipments WHERE id = 1');
        assert.strictEqual(s.status, 'failed');
    });

    it('B2 — Coordinator cho hoàn hàng (RETURNING) rồi driver xác nhận đã về kho (COMPLETED)', async () => {
        await coordinatorService.resolveFailedShipment(1, { action: 'return' }, COORD_ID);

        const { rows: [returning] } = await pool.query('SELECT status, returning_at FROM order_shipments WHERE id = 1');
        assert.strictEqual(returning.status, 'returning');
        assert.notStrictEqual(returning.returning_at, null);

        await tripService.returnComplete(1, DRIVER_ID, 'https://proof-return.test/1.jpg');

        const { rows: [completed] } = await pool.query('SELECT status FROM order_shipments WHERE id = 1');
        assert.strictEqual(completed.status, 'completed');
    });

    it('B3 — Driver nhập km thực tế (BR-008A): actual_price phải x2 NGAY, không cần phiếu thu', async () => {
        const result = await tripService.requestOrderReceipt(1, DRIVER_ID, { shipmentId: 1, actualKm: ACTUAL_KM });

        // Đơn bank_transfer → không được tạo order_receipt_requests
        assert.strictEqual(result.receipt_request_created, false);
        const { rows: requests } = await pool.query('SELECT * FROM order_receipt_requests WHERE order_id = 1');
        assert.strictEqual(requests.length, 0, 'đơn bank_transfer không được sinh yêu cầu phiếu thu');

        const { rows: [shipment] } = await pool.query(
            'SELECT actual_distance_km, actual_price FROM order_shipments WHERE id = 1',
        );
        assert.strictEqual(Number(shipment.actual_distance_km), ACTUAL_KM);
        assert.strictEqual(
            Number(shipment.actual_price),
            EXPECTED_ACTUAL_PRICE,
            'chuyến hoàn hàng trên đơn bank_transfer vẫn phải được chốt actual_price = km × đơn giá × 2, ' +
            'nếu không BR-026 sẽ fallback về estimated_price (giá một chiều cũ) mãi mãi',
        );
    });
});
