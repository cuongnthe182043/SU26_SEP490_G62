/**
 * L2-FLOW-16 — Màn Đơn hàng của coordinator phải hiện actual_price khi đã chốt, không hiện
 * mãi giá ước tính (giá gốc).
 *
 * Bug: JSON `trips` trả về từ orderRepository.listOrders (dùng cho OrdersView/OrderDetailModal
 * của coordinator) không bao giờ chọn cột actual_price trong json_build_object — chỉ có
 * 'fare' = estimated_price. Frontend (utils.js buildTripFromOrder) đã viết đúng logic ưu tiên
 * trip.actual_price trước trip.fare, nhưng vì backend không gửi field đó nên luôn rơi về giá
 * ước tính — kể cả sau khi actual_price đã được chốt (vd chuyến hoàn hàng x2 giá, hoặc phiếu
 * thu đã duyệt).
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let orderRepository;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    orderRepository = require('../../repositories/orderRepository');

    await pool.query(`
        TRUNCATE trip_stops, shipment_assignment_history, order_shipments, orders,
                 customers, vehicles, vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id) VALUES (2,'coord@test.com','hash',2)`);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (2,'Coordinator',2)`);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1, 'individual', 'Nguyen Van C', '0911111111')`);
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
        VALUES (1, 1, 2, 'Hang test', 'bank_transfer', 500000)
    `);
    // estimated_price = 500.000 (giá gốc), actual_price = 1.200.000 (đã chốt, vd hoàn hàng x2)
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, actual_price, estimated_distance_km, status)
        VALUES (1, 1, 1, 1, 500000, 1200000, 20, 'completed')
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-16 — orderRepository.listOrders phải trả actual_price cho từng chuyến', () => {
    it('trips[0].actual_price phải khớp actual_price đã chốt trong DB, không chỉ có estimated_price', async () => {
        const { orders } = await orderRepository.listOrders({ page: 1, limit: 10 });
        const order = orders.find((o) => o.id === 1);

        assert.ok(order, 'phải tìm thấy đơn vừa seed');
        assert.ok(Array.isArray(order.trips) && order.trips.length === 1);

        const trip = order.trips[0];
        assert.strictEqual(Number(trip.fare), 500000, 'fare vẫn giữ nguyên giá ước tính (không đổi ý nghĩa field cũ)');
        assert.strictEqual(
            Number(trip.actual_price), 1200000,
            'phải có field actual_price riêng để FE ưu tiên hiển thị thay vì luôn dùng giá ước tính (giá gốc)',
        );
    });
});
