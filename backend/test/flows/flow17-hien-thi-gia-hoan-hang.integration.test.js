/**
 * L2-FLOW-17 — Các màn HIỂN THỊ giá (không phải màn chốt tiền) cũng phải x2 đúng cho chuyến
 * hoàn hàng, khớp logic thật trong computeReceiptAmount/saveShipmentActualKm.
 *
 * Hai chỗ tìm thấy còn sót khi rà lại toàn bộ luồng hoàn hàng:
 *
 *  1) coordinatorRepository.listReceiptRequests (màn danh sách yêu cầu phiếu thu của
 *     coordinator) — công thức fallback khi actual_price CHƯA chốt không nhân đôi cho
 *     returning_at, khác computeReceiptAmount.
 *
 *  2) tripRepository.getDriverOrderHistory (lịch sử đơn hàng của driver) — chỉ SUM
 *     estimated_price, không hề có actual_price, nên lịch sử kẹt mãi ở giá ước tính dù
 *     đã chốt xong.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let coordinatorService;
let tripRepository;

const DRIVER_ID = 4;
const COORD_ID = 2;
const PRICE_PER_KM = 15000;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    coordinatorService = require('../../services/coordinatorService');
    tripRepository = require('../../repositories/tripRepository');

    await pool.query(`
        TRUNCATE order_receipt_requests, shipment_assignment_history, trip_stops,
                 order_shipments, orders, customers, vehicles, vehicle_groups, drivers,
                 profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (2,'coord@test.com','hash',2),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (2,'Coordinator',2),(4,'Driver A',4)`);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', ${PRICE_PER_KM})`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1, '51E-111.11', 1, 4, 'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4, 1, 1, 'DL-1', CURRENT_DATE)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1, 'individual', 'Nguyen Van D', '0900000000')`);

    // Đơn CASH 1 chuyến — HOÀN HÀNG, đã có actual_distance_km (driver nhập) nhưng CHƯA
    // được coordinator duyệt (actual_price vẫn NULL) — đúng trạng thái "đang chờ duyệt"
    // hiện trên màn danh sách yêu cầu phiếu thu.
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
        VALUES (1, 1, 2, 'Hang cho hoan', 'cash', 300000)
    `);
    await pool.query(`
        INSERT INTO order_shipments
            (id, order_id, shipment_index, vehicle_group_id, estimated_price, actual_distance_km, returning_at, status)
        VALUES (1, 1, 1, 1, 300000, 30, NOW(), 'completed')
    `);
    await pool.query(`
        INSERT INTO order_receipt_requests (id, order_id, requesting_shipment_id, driver_id, status)
        VALUES (1, 1, 1, 4, 'pending')
    `);

    // Đơn thứ 2 — 1 chuyến HOÀN HÀNG đã chốt actual_price (600.000, tự settle qua
    // saveShipmentActualKm), driver xem lại trong lịch sử đơn hàng.
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
        VALUES (2, 1, 2, 'Hang da chot', 'bank_transfer', 300000)
    `);
    await pool.query(`
        INSERT INTO order_shipments
            (id, order_id, shipment_index, vehicle_group_id, estimated_price, actual_distance_km, actual_price, returning_at, status)
        VALUES (2, 2, 1, 1, 300000, 20, 600000, NOW(), 'completed')
    `);
    await pool.query(`
        INSERT INTO shipment_assignment_history (shipment_id, to_driver_id, to_vehicle_id, change_reason, changed_by)
        VALUES (2, 4, 1, 'self_claim', 4)
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-17 — Màn hiển thị giá phải khớp logic x2 hoàn hàng thật', () => {
    it('coordinatorService.getReceiptRequests — preview (chưa duyệt) phải x2 cho chuyến hoàn hàng', async () => {
        const { requests } = await coordinatorService.getReceiptRequests({});
        const req = requests.find((r) => r.order_id === 1);

        assert.ok(req, 'phải tìm thấy yêu cầu phiếu thu vừa seed');
        const expected = 30 * PRICE_PER_KM * 2; // 900.000
        assert.strictEqual(
            Number(req.actual_price), expected,
            'danh sách yêu cầu phiếu thu phải hiện đúng số x2 khi mở duyệt, không phải MỘT NỬA',
        );
        assert.strictEqual(Number(req.gross_amount), expected);
        // FE cần cờ này để chú thích "Hoàn hàng · ×2 cước" cạnh số tiền, tránh coordinator
        // thắc mắc sao tiền không khớp giá báo ban đầu.
        assert.notStrictEqual(req.returning_at, null, 'phải trả returning_at để FE gắn nhãn hoàn hàng');
    });

    it('tripRepository.getDriverOrderHistory — phải hiện actual_price đã chốt, không kẹt ở giá ước tính', async () => {
        const { rows } = await tripRepository.getDriverOrderHistory(DRIVER_ID, { limit: 10, offset: 0 });
        const order = rows.find((o) => o.order_id === 2);

        assert.ok(order, 'phải tìm thấy đơn #2 trong lịch sử');
        assert.strictEqual(
            Number(order.total_actual_price), 600000,
            'lịch sử đơn hàng phải hiện actual_price đã chốt (đã x2 vì hoàn hàng), không phải estimated_price gốc (300.000)',
        );
        assert.strictEqual(order.has_return_shipment, true, 'FE cần cờ này để chú thích hoàn hàng cạnh số tiền');
    });
});
