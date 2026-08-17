/**
 * L2-FLOW-20 — Khách ứng trước DƯ trên đơn KHÔNG THU TIỀN MẶT (payment_type != 'cash')
 *
 * Nghi vấn kiểm chứng: phần tiền khách ứng dư hơn số phải trả được hoàn lại bằng phiếu chi
 * 'prepaid_refund' (BR-022E). createPrepaidRefundVoucher chỉ có BA nơi gọi trong production:
 *
 *   1. coordinatorService.approveReceiptRequest  — chốt phiếu thu
 *   2. incidentService                            — hủy chuyến vì hàng hư hại
 *   3. orderRepository.cancelOrder                — hủy đơn
 *
 * Nhánh (1) nằm SAU gate payment_type = 'cash' của requestOrderReceipt, nên đơn
 * bank_transfer / client_credit không bao giờ đi qua. Nhánh (2) và (3) chỉ chạy khi có sự
 * cố hoặc khi hủy — không áp dụng cho một đơn hoàn tất bình thường.
 *
 * ⇒ Đơn non-cash chạy trót lọt mà khách đã ứng dư thì rơi qua cả ba: tiền thừa của khách
 * nằm lại trong két công ty, không phiếu chi, không bút toán, không cảnh báo.
 *
 * Cùng khuôn với bug đã sửa ở L2-FLOW-14 và cùng nghi vấn với L2-FLOW-19: những việc
 * KHÔNG liên quan tới thu tiền mặt lại bị treo sau một cổng chỉ mở cho đơn tiền mặt.
 *
 * Kịch bản: hai đơn giống hệt nhau — cước ước tính 300.000, khách đã ứng 500.000 (đã xác
 * nhận) — chỉ khác payment_type. Cả hai chạy xong bình thường. Đơn cash phải sinh phiếu
 * hoàn tiền ứng dư; đơn bank_transfer thì không có gì.
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
const ACTUAL_KM = 20;
const ESTIMATED_PRICE = 300000;
const PREPAID_AMOUNT = 500000; // khách ứng DƯ so với cước

const countRefundVouchers = async (orderId) => {
    const { rows } = await pool.query(
        `SELECT id, amount, status
         FROM payment_vouchers
         WHERE order_id = $1 AND voucher_type = 'prepaid_refund'
         ORDER BY id`,
        [orderId],
    );
    return rows;
};

const runTripToCompletion = async (shipmentId) => {
    await tripService.claimTrip(shipmentId, DRIVER_ID);
    await tripService.updateStatus(shipmentId, DRIVER_ID, 'picking');
    await tripService.startTransit(shipmentId, DRIVER_ID, `https://proof.test/load-${shipmentId}.jpg`);
    await tripService.updateStatus(shipmentId, DRIVER_ID, 'arrived');
    await tripService.completeTrip(shipmentId, DRIVER_ID, `https://proof.test/done-${shipmentId}.jpg`);
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    tripService = require('../../services/tripService');
    coordinatorService = require('../../services/coordinatorService');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payment_receipts, shipment_receipts,
                 order_receipt_requests, delivery_proofs, trip_stops, payment_vouchers,
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

    // prepaid_status = 'confirmed': tiền ứng ĐÃ về két công ty. Khoản 'pending' (kế toán mới
    // nhập, tiền chưa về) bị createPrepaidRefundVoucher loại thẳng nên không dùng ở đây.
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                            total_estimated_price, prepaid_amount, prepaid_status, prepaid_confirmed_by) VALUES
        (1, 1, 2, 'Hang gom su - don chuyen khoan', 'bank_transfer', ${ESTIMATED_PRICE}, ${PREPAID_AMOUNT}, 'confirmed', 3),
        (2, 1, 2, 'Hang gom su - don tien mat',     'cash',          ${ESTIMATED_PRICE}, ${PREPAID_AMOUNT}, 'confirmed', 3)
    `);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status) VALUES
        (1, 1, 1, 1, ${ESTIMATED_PRICE}, ${ACTUAL_KM}, 'available'),
        (2, 2, 1, 1, ${ESTIMATED_PRICE}, ${ACTUAL_KM}, 'available')
    `);
    await pool.query(`
        INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
        (1, 1, 'pickup', '1 Le Loi, Q1'), (1, 2, 'delivery', '2 Vo Van Ngan, Thu Duc'),
        (2, 1, 'pickup', '1 Le Loi, Q1'), (2, 2, 'delivery', '2 Vo Van Ngan, Thu Duc')
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-20 — Tiền ứng dư trên đơn không thu tiền mặt không có đường hoàn về khách', () => {
    it('B1 — Đơn CHUYỂN KHOẢN: driver chạy xong chuyến và nhập km thực tế', async () => {
        await runTripToCompletion(1);

        const { rows: [shipment] } = await pool.query('SELECT status FROM order_shipments WHERE id = 1');
        assert.strictEqual(shipment.status, 'completed');

        const result = await tripService.requestOrderReceipt(1, DRIVER_ID, { shipmentId: 1, actualKm: ACTUAL_KM });
        assert.strictEqual(result.km_saved, true);
        assert.strictEqual(result.receipt_request_created, false);

        const { rows: requests } = await pool.query('SELECT 1 FROM order_receipt_requests WHERE order_id = 1');
        assert.strictEqual(requests.length, 0, 'đơn bank_transfer không sinh yêu cầu phiếu thu — hành vi ĐÚNG theo thiết kế');
    });

    it('B2 — Đơn hoàn tất nhưng KHÔNG có phiếu hoàn tiền ứng dư nào được tạo', async () => {
        const vouchers = await countRefundVouchers(1);

        assert.strictEqual(
            vouchers.length, 0,
            `khách ứng ${PREPAID_AMOUNT.toLocaleString('vi-VN')}đ cho đơn cước ${ESTIMATED_PRICE.toLocaleString('vi-VN')}đ, `
            + 'chuyến đã hoàn tất mà không có phiếu prepaid_refund nào: tiền thừa của khách nằm lại trong két '
            + 'công ty, không chứng từ, không bút toán, không cảnh báo',
        );

        // Không phải do khoản ứng bị mất — nó vẫn nguyên trên đơn, chỉ là không ai xử lý.
        const { rows: [order] } = await pool.query(
            'SELECT prepaid_amount, prepaid_status FROM orders WHERE id = 1',
        );
        assert.strictEqual(Number(order.prepaid_amount), PREPAID_AMOUNT);
        assert.strictEqual(order.prepaid_status, 'confirmed');
    });

    it('B3 — ĐỐI CHỨNG, đơn TIỀN MẶT: chốt phiếu thu sinh đúng phiếu hoàn tiền ứng dư', async () => {
        await runTripToCompletion(2);

        const result = await tripService.requestOrderReceipt(2, DRIVER_ID, { shipmentId: 2, actualKm: ACTUAL_KM });
        assert.strictEqual(result.receipt_request_created, true, 'đơn cash PHẢI sinh yêu cầu phiếu thu');

        await coordinatorService.approveReceiptRequest(result.request.id, COORD_ID, {});

        const vouchers = await countRefundVouchers(2);
        assert.strictEqual(
            vouchers.length, 1,
            'đơn cash cùng số liệu PHẢI sinh đúng 1 phiếu hoàn tiền ứng dư khi chốt phiếu thu (BR-022E)',
        );
        assert.ok(
            Number(vouchers[0].amount) > 0,
            'phiếu hoàn phải có số tiền dương — phần khách ứng vượt quá số phải trả',
        );
    });

    it('B4 — Chốt bằng chứng: cùng số liệu, khác payment_type, khác kết quả', async () => {
        const nonCashVouchers = await countRefundVouchers(1);
        const cashVouchers = await countRefundVouchers(2);

        assert.strictEqual(nonCashVouchers.length, 0);
        assert.strictEqual(cashVouchers.length, 1);

        assert.notStrictEqual(
            nonCashVouchers.length, cashVouchers.length,
            'hai đơn chỉ khác nhau ở payment_type nhưng khách của đơn bank_transfer không được hoàn tiền: '
            + 'cơ chế hoàn tiền ứng dư bị treo sau gate payment_type = cash của requestOrderReceipt',
        );
    });
});
