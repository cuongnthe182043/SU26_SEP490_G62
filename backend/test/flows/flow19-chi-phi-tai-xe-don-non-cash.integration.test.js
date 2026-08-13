/**
 * L2-FLOW-19 — Chi phí tài xế trên đơn KHÔNG THU TIỀN MẶT (payment_type != 'cash')
 *
 * Nghi vấn kiểm chứng: chi phí tài xế khai KHÔNG có bước duyệt riêng bắt buộc —
 * chúng được duyệt hàng loạt bên trong approveReceiptRequest (autoApproveOrderExpenses).
 * Mà order_receipt_requests CHỈ được tạo cho đơn payment_type = 'cash'
 * (requestOrderReceipt trong tripService.js). Với đơn bank_transfer / client_credit,
 * không có phiếu thu nào được phát hành → không có gì kích hoạt việc duyệt.
 *
 * Hệ quả nếu điều phối không duyệt tay ở màn "Chi phí tài xế":
 *   status = 'pending'  ⇒  reimbursement_status = NULL
 * Cả hai đường hoàn tiền đều lọc `status = 'approved' AND reimbursement_status = 'pending'`
 * (accountantPayrollRepository — hoàn qua lương; tripRepository — cấn trừ nợ thu hộ),
 * nên khoản này vô hình với cả hai: tài xế đã ứng tiền thật mà không bao giờ được hoàn,
 * và không có báo cáo quá hạn nào bắt được.
 *
 * Đây CÙNG MỘT KHUÔN với bug đã sửa ở L2-FLOW-14 (actual_price của chuyến hoàn hàng chỉ
 * được chốt bên trong approveReceiptRequest nên đơn bank_transfer rơi qua kẽ).
 *
 * Kịch bản: cùng một tài xế, cùng một loại chi phí, chạy hai đơn giống hệt nhau, chỉ khác
 * payment_type — đơn A bank_transfer, đơn B cash — rồi so sánh số phận của hai khoản chi.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let tripService;
let expenseService;
let coordinatorService;

const DRIVER_ID = 4;
const COORD_ID = 2;
const PRICE_PER_KM = 15000;
const ACTUAL_KM = 20;
const EXPENSE_AMOUNT = 120000;
const RECEIPT_IMG = 'https://bill.test/toll.jpg';

// Truy vấn ĐÚNG BẰNG điều kiện mà cả hai đường hoàn tiền dùng để tìm khoản phải hoàn:
//   - accountantPayrollRepository (hoàn qua kỳ lương)
//   - tripRepository (cấn trừ vào nợ thu hộ khi tài nộp tiền)
// Khoản nào không lọt qua đây thì không có đường nào hoàn cho tài xế.
const REIMBURSABLE_SQL = `
    SELECT e.id
    FROM expenses e
    LEFT JOIN v_shipment_current sc ON sc.shipment_id = e.shipment_id
    LEFT JOIN maintenance_records mr ON mr.expense_id = e.id
    WHERE e.status = 'approved'
      AND e.reimbursement_status = 'pending'
      AND COALESCE(sc.owner_driver_id, mr.performed_by, e.created_by) = $1
    ORDER BY e.id`;

// Chạy trọn một chuyến: nhận → lấy hàng → vận chuyển → tới nơi → khai chi phí → hoàn thành.
// Chi phí PHẢI khai trước khi chuyến 'completed' (EXPENSE_ALLOWED_STATUSES không có
// 'completed' — sau đó chỉ mở lại khi yêu cầu phiếu thu bị từ chối).
const runTripAndDeclareExpense = async (shipmentId) => {
    await tripService.claimTrip(shipmentId, DRIVER_ID);
    await tripService.updateStatus(shipmentId, DRIVER_ID, 'picking');
    await tripService.startTransit(shipmentId, DRIVER_ID, `https://proof.test/load-${shipmentId}.jpg`);
    await tripService.updateStatus(shipmentId, DRIVER_ID, 'arrived');

    await expenseService.createExpense(DRIVER_ID, {
        shipmentId,
        expenseType: 'toll',
        amount: EXPENSE_AMOUNT,
        description: 'Phí cầu đường QL1',
        receiptUrl: RECEIPT_IMG,
    });

    await tripService.completeTrip(shipmentId, DRIVER_ID, `https://proof.test/done-${shipmentId}.jpg`);
};

const getExpenseIdForShipment = async (shipmentId) => {
    const { rows: [e] } = await pool.query(
        'SELECT id FROM expenses WHERE shipment_id = $1 ORDER BY id LIMIT 1',
        [shipmentId],
    );
    return e?.id ?? null;
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    tripService = require('../../services/tripService');
    expenseService = require('../../services/expenseService');
    coordinatorService = require('../../services/coordinatorService');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payment_receipts, shipment_receipts,
                 order_receipt_requests, delivery_proofs, trip_stops, expense_attachments,
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

    // Hai đơn giống hệt nhau, KHÁC DUY NHẤT payment_type — biến độc lập của phép so sánh.
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price) VALUES
        (1, 1, 2, 'Hang dien tu - don chuyen khoan', 'bank_transfer', 300000),
        (2, 1, 2, 'Hang dien tu - don tien mat',     'cash',          300000)
    `);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status) VALUES
        (1, 1, 1, 1, 300000, ${ACTUAL_KM}, 'available'),
        (2, 2, 1, 1, 300000, ${ACTUAL_KM}, 'available')
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

describe('L2-FLOW-19 — Chi phí tài xế trên đơn không thu tiền mặt không có đường được duyệt', () => {
    it('B1 — Đơn CHUYỂN KHOẢN: driver chạy xong chuyến và khai chi phí cầu đường', async () => {
        await runTripAndDeclareExpense(1);

        const { rows: [shipment] } = await pool.query('SELECT status FROM order_shipments WHERE id = 1');
        assert.strictEqual(shipment.status, 'completed');

        const { rows: [expense] } = await pool.query(
            'SELECT status, amount, reimbursement_status FROM expenses WHERE shipment_id = 1',
        );
        assert.strictEqual(expense.status, 'pending', 'chi phí vừa khai luôn ở trạng thái pending');
        assert.strictEqual(Number(expense.amount), EXPENSE_AMOUNT);
        assert.strictEqual(expense.reimbursement_status, null);
    });

    it('B2 — Nhập km thực tế: KHÔNG có yêu cầu phiếu thu nào được tạo (đúng theo gate payment_type)', async () => {
        const result = await tripService.requestOrderReceipt(1, DRIVER_ID, { shipmentId: 1, actualKm: ACTUAL_KM });

        assert.strictEqual(result.km_saved, true, 'km vẫn phải được lưu cho MỌI driver, không phụ thuộc payment_type');
        assert.strictEqual(result.receipt_request_created, false);

        const { rows: requests } = await pool.query('SELECT 1 FROM order_receipt_requests WHERE order_id = 1');
        assert.strictEqual(requests.length, 0, 'đơn bank_transfer không sinh yêu cầu phiếu thu — đây là hành vi ĐÚNG theo thiết kế');
    });

    it('B3 — Hệ quả: chi phí kẹt pending, không có cơ chế tự động nào chạm tới nó', async () => {
        const { rows: [expense] } = await pool.query(
            'SELECT status, reviewed_by, reviewed_at, reimbursement_status FROM expenses WHERE shipment_id = 1',
        );

        assert.strictEqual(
            expense.status, 'pending',
            'đơn hoàn tất mà chi phí vẫn pending: autoApproveOrderExpenses chỉ chạy trong approveReceiptRequest, '
            + 'mà đơn non-cash không bao giờ có phiếu thu để duyệt',
        );
        assert.strictEqual(expense.reviewed_by, null);
        assert.strictEqual(expense.reviewed_at, null);
        assert.strictEqual(
            expense.reimbursement_status, null,
            'reimbursement_status chỉ được set khi duyệt — pending nghĩa là chưa có khoản phải hoàn nào tồn tại',
        );
    });

    it('B4 — ĐỐI CHỨNG, đơn TIỀN MẶT: cùng tài xế, cùng loại chi phí, có phiếu thu để duyệt', async () => {
        await runTripAndDeclareExpense(2);

        const before = await pool.query('SELECT status FROM expenses WHERE shipment_id = 2');
        assert.strictEqual(before.rows[0].status, 'pending', 'trước khi chốt phiếu thu thì cũng pending như đơn kia');

        const result = await tripService.requestOrderReceipt(2, DRIVER_ID, { shipmentId: 2, actualKm: ACTUAL_KM });
        assert.strictEqual(result.receipt_request_created, true, 'đơn cash PHẢI sinh yêu cầu phiếu thu');

        await coordinatorService.approveReceiptRequest(result.request.id, COORD_ID, {});

        const { rows: [expense] } = await pool.query(
            'SELECT status, reimbursement_status FROM expenses WHERE shipment_id = 2',
        );
        assert.strictEqual(
            expense.status, 'approved',
            'phát hành phiếu thu CHÍNH LÀ hành động duyệt chi phí (autoApproveOrderExpenses)',
        );
        assert.strictEqual(
            expense.reimbursement_status, 'pending',
            'duyệt xong thì công ty nợ tài xế khoản này — đây mới là khoản chờ hoàn',
        );
    });

    it('B5 — Chốt bằng chứng: khoản của đơn non-cash vô hình với CẢ HAI đường hoàn tiền', async () => {
        const nonCashExpenseId = await getExpenseIdForShipment(1);
        const cashExpenseId = await getExpenseIdForShipment(2);
        assert.ok(nonCashExpenseId && cashExpenseId, 'cả hai chi phí đều phải tồn tại trong DB');

        const { rows } = await pool.query(REIMBURSABLE_SQL, [DRIVER_ID]);
        const reimbursableIds = rows.map((r) => r.id);

        assert.ok(
            reimbursableIds.includes(cashExpenseId),
            'khoản của đơn cash phải nằm trong danh sách chờ hoàn',
        );
        assert.ok(
            !reimbursableIds.includes(nonCashExpenseId),
            `khoản #${nonCashExpenseId} (đơn bank_transfer) KHÔNG lọt vào danh sách chờ hoàn — `
            + 'không hoàn qua lương được, không cấn trừ nợ được, và không lên báo cáo quá hạn nào. '
            + 'Tài xế đã ứng tiền thật mà hệ thống im lặng.',
        );
        assert.deepStrictEqual(
            reimbursableIds, [cashExpenseId],
            'chỉ đúng một khoản đủ điều kiện hoàn, dù tài xế đã ứng tiền cho cả hai chuyến',
        );
    });

    it('B6 — Đường thoát duy nhất là điều phối duyệt tay ở màn "Chi phí tài xế"', async () => {
        const nonCashExpenseId = await getExpenseIdForShipment(1);

        await expenseService.approveExpense(nonCashExpenseId, COORD_ID);

        const { rows: [expense] } = await pool.query(
            'SELECT status, reimbursement_status FROM expenses WHERE id = $1',
            [nonCashExpenseId],
        );
        assert.strictEqual(expense.status, 'approved');
        assert.strictEqual(expense.reimbursement_status, 'pending');

        const { rows } = await pool.query(REIMBURSABLE_SQL, [DRIVER_ID]);
        assert.strictEqual(
            rows.length, 2,
            'sau khi duyệt tay thì khoản này mới hiện ra — nghĩa là toàn bộ việc hoàn tiền cho đơn '
            + 'non-cash phụ thuộc vào việc điều phối NHỚ duyệt, không có cơ chế nào nhắc',
        );
    });
});
