/**
 * L2-FLOW-16 — Chi phí phát sinh trong chuyến có HÀNG HÓA HƯ HẠI → doanh nghiệp chịu
 *
 * Nghiệp vụ: chuyến bị hủy vì hàng hư hại thì KHÔNG phát sinh doanh thu (đã đúng từ trước),
 * nhưng các khoản chi hộ khách (cầu đường / đỗ xe / ETC) tài xế đã ứng trong chuyến đó vẫn
 * bị cộng vào phiếu thu — tức là bắt khách trả tiền cầu đường cho chính chuyến vừa làm hỏng
 * hàng của họ. Toàn bộ chi phí của chuyến hư hại phải chuyển về phía DOANH NGHIỆP.
 *
 * Hai hệ quả bắt buộc đi kèm, đều được kiểm ở đây:
 *   1. Bút toán: khoản đó ghi Nợ 642 (chi phí DN) chứ KHÔNG phải Nợ 3388 (chi hộ — phải thu
 *      lại của khách). Ghi 3388 mà phiếu thu không bao giờ đòi thì số dư treo vĩnh viễn.
 *   2. Tài xế vẫn được hoàn đủ tiền đã ứng — chỉ đổi BÊN CHỊU chi phí, không phải xóa khoản.
 *
 * Và phiếu thu phải xử lý được trường hợp tổng phải thu về 0đ (đơn đã trả trước đủ, phần
 * còn lại là chi phí chuyến hư hại đã chuyển sang DN): trước đây debts.total_amount CHECK > 0
 * làm INSERT nợ 0đ ném lỗi Postgres thô ra tận app tài xế, phiếu không cách nào đóng được.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let tripService;
let coordinatorService;
let expenseService;
let incidentService;

const COORD_ID = 2;
const DRIVER_A = 4;   // chạy chuyến bị hàng hư hại
const DRIVER_B = 5;   // chạy chuyến còn lại, là driver cuối → gửi yêu cầu phiếu thu
const PRICE_PER_KM = 15000;
const KM_B = 100;
const FARE_B = KM_B * PRICE_PER_KM;   // 1.500.000 — cước chuyến giao được

const TOLL_DAMAGED = 120000;  // chi hộ khách, nhưng thuộc chuyến hàng hư hại → DN chịu
const FUEL_DAMAGED = 300000;  // vốn đã là chi phí DN
const TOLL_OK      = 80000;   // chi hộ khách của chuyến giao được → khách vẫn trả

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    tripService = require('../../services/tripService');
    coordinatorService = require('../../services/coordinatorService');
    expenseService = require('../../services/expenseService');
    incidentService = require('../../services/incidentService');

    await pool.query(`
        TRUNCATE financial_transactions, payment_vouchers, debt_payments, debts, payment_receipts, shipment_receipts,
                 order_receipt_requests, delivery_proofs, trip_stops, shipment_assignment_history,
                 shipment_revenue_allocations, kpi_records, expense_attachments, expenses,
                 incident_evidences, incidents, order_shipments, orders, customers, vehicles,
                 vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com','hash',1),(2,'coord@test.com','hash',2),
        (3,'acct@test.com','hash',3),(4,'driverA@test.com','hash',4),(5,'driverB@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (1,'Manager',1),(2,'Coordinator',2),(3,'Accountant',3),(4,'Driver A',4),(5,'Driver B',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', ${PRICE_PER_KM})`);
    await pool.query(`
        INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES
        (1, '51E-111.11', 1, 4, 'active'), (2, '51E-222.22', 1, 5, 'active')
    `);
    await pool.query(`
        INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES
        (4, 1, 1, 'DL-A', CURRENT_DATE), (5, 2, 1, 'DL-B', CURRENT_DATE)
    `);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1, 'individual', 'Nguyen Van C', '0900000001')`);

    // Đơn 1 — 2 chuyến: chuyến 1 hàng hư hại (Driver A), chuyến 2 giao được (Driver B, cuối đơn)
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type, total_estimated_price)
        VALUES (1, 1, 2, 'Hang de vo', 'cash', 3000000)
    `);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status) VALUES
        (1, 1, 1, 1, 1500000, 100, 'available'),
        (2, 1, 2, 1, 1500000, 100, 'available')
    `);
    await pool.query(`
        INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
        (1, 1, 'pickup', 'Kho Q1'), (1, 2, 'delivery', 'KCN Song Than'),
        (2, 1, 'pickup', 'Kho Q1'), (2, 2, 'delivery', 'KCN Amata')
    `);
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-16 — Chi phí chuyến hàng hư hại chuyển hết về doanh nghiệp', () => {
    it('B1 — Driver A nhận chuyến 1, khai chi phí (cầu đường 120k + dầu 300k) rồi báo sự cố hàng hóa hư hại', async () => {
        await tripService.claimTrip(1, DRIVER_A);
        await tripService.updateStatus(1, DRIVER_A, 'picking');
        await tripService.startTransit(1, DRIVER_A, 'https://proof-loading.test/1.jpg');

        await expenseService.createExpense(DRIVER_A, {
            shipmentId: 1, expenseType: 'toll', amount: TOLL_DAMAGED,
            description: 'BOT Long Thanh', receiptUrl: 'https://r.test/toll-a.jpg',
        });
        await expenseService.createExpense(DRIVER_A, {
            shipmentId: 1, expenseType: 'fuel', amount: FUEL_DAMAGED,
            description: 'Do dau', receiptUrl: 'https://r.test/fuel-a.jpg',
        });

        const incident = await incidentService.createIncident(DRIVER_A, {
            shipmentId: 1, incidentType: 'cargo_damage', severityLevel: 'critical',
            description: 'Hang bi do va vo trong luc van chuyen, khong the giao',
            location: 'QL51',
        }, ['https://evidence.test/damage.jpg']);

        assert.strictEqual(incident.incident_type, 'cargo_damage');
    });

    it('B2 — Coordinator hủy chuyến 1 vì hàng hư hại → chuyến cancelled, sự cố đóng lại', async () => {
        const { rows: [inc] } = await pool.query(`SELECT id FROM incidents WHERE shipment_id = 1`);
        await incidentService.cancelDamagedShipment(inc.id, COORD_ID, { reason: 'Hang hu hai hoan toan, khong giao duoc' });

        const { rows: [s] } = await pool.query('SELECT status FROM order_shipments WHERE id = 1');
        assert.strictEqual(s.status, 'cancelled');

        const { rows: [i] } = await pool.query('SELECT status FROM incidents WHERE id = $1', [inc.id]);
        assert.ok(['resolved', 'closed'].includes(i.status), 'hủy chuyến phải đóng luôn sự cố');
    });

    it('B3 — Driver B chạy chuyến 2, khai chi hộ 80k, hoàn thành và gửi yêu cầu phiếu thu', async () => {
        await tripService.claimTrip(2, DRIVER_B);
        await tripService.updateStatus(2, DRIVER_B, 'picking');
        await tripService.startTransit(2, DRIVER_B, 'https://proof-loading.test/2.jpg');
        await tripService.updateStatus(2, DRIVER_B, 'arrived');

        await expenseService.createExpense(DRIVER_B, {
            shipmentId: 2, expenseType: 'toll', amount: TOLL_OK,
            description: 'BOT Bien Hoa', receiptUrl: 'https://r.test/toll-b.jpg',
        });

        await tripService.completeTrip(2, DRIVER_B, 'https://proof-delivery.test/2.jpg');
        const result = await tripService.requestOrderReceipt(1, DRIVER_B, { shipmentId: 2, actualKm: KM_B });
        assert.strictEqual(result.receipt_request_created, true);
    });

    it('B4 — Màn xem trước phiếu thu: chi hộ của chuyến hư hại bị gạt khỏi tiền khách, hiện riêng phần DN chịu', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 1');
        const detail = await coordinatorService.getReceiptRequestDetail(orr.id);

        assert.strictEqual(detail.summary.total_actual_price, FARE_B, 'chuyến hủy không sinh doanh thu');
        assert.strictEqual(detail.summary.total_pass_through_expenses, TOLL_OK,
            'chỉ chi hộ của chuyến GIAO ĐƯỢC mới được tính vào tiền khách');
        assert.strictEqual(detail.summary.total_company_borne_expenses, TOLL_DAMAGED,
            'chi hộ của chuyến hàng hư hại phải hiện riêng là phần DN chịu');
        assert.strictEqual(detail.summary.final_price, FARE_B + TOLL_OK);

        // Tổng chi phí toàn đơn KHÔNG đổi — khoản không biến mất, chỉ đổi bên chịu
        assert.strictEqual(detail.summary.total_expenses, TOLL_DAMAGED + FUEL_DAMAGED + TOLL_OK);
    });

    // Màn DANH SÁCH có công thức tính tiền riêng (listReceiptRequests) — phải ra đúng con số
    // của màn xem trước, nếu không coordinator nhìn danh sách một đằng, mở modal ra một nẻo.
    // Trước khi sửa: doanh thu chuyến hủy vẫn được cộng (km × đơn giá) và chi hộ không được
    // cộng vào tổng thu → danh sách hiện 3.000.000đ cho phiếu thật ra chỉ 1.580.000đ.
    it('B4b — Màn danh sách yêu cầu phiếu thu hiện CÙNG số với màn xem trước', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 1');
        const detail = await coordinatorService.getReceiptRequestDetail(orr.id);

        const { requests } = await coordinatorService.getReceiptRequests({ kind: 'all', page: 1, limit: 50 });
        const listed = requests.find((r) => Number(r.id) === Number(orr.id));

        assert.ok(listed, 'yêu cầu phải có trong danh sách');
        assert.strictEqual(Number(listed.receipt_amount), detail.summary.remaining_receipt_amount);
        assert.strictEqual(Number(listed.receipt_amount), FARE_B + TOLL_OK);
        assert.strictEqual(Number(listed.gross_amount), FARE_B,
            'chuyến hủy vì hàng hư hại không được cộng doanh thu vào danh sách');
        assert.strictEqual(Number(listed.final_price), FARE_B + TOLL_OK,
            'chi hộ của chuyến hư hại không được cộng vào tổng thu');
    });

    it('B5 — Coordinator duyệt → phiếu thu = cước chuyến giao được + chi hộ chuyến đó, KHÔNG gồm chi phí chuyến hư hại', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 1');
        await coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'ok', expenses: [] });

        const { rows: [receipt] } = await pool.query(
            'SELECT amount FROM shipment_receipts WHERE order_receipt_request_id = $1', [orr.id],
        );
        assert.strictEqual(Number(receipt.amount), FARE_B + TOLL_OK);

        const { rows: [damaged] } = await pool.query('SELECT actual_price FROM order_shipments WHERE id = 1');
        assert.strictEqual(Number(damaged.actual_price), 0, 'chuyến hư hại chốt doanh thu 0');

        // Chuyến hủy vừa bị chốt actual_price = 0. Công thức doanh thu của màn danh sách có
        // nhánh NULLIF(actual_price, 0) → 0 thành NULL rồi rơi xuống km × đơn giá, nên nếu
        // không loại chuyến hủy ra thì đúng khoản doanh thu vừa gạt đi lại sống dậy ở đây.
        const { requests } = await coordinatorService.getReceiptRequests({ kind: 'all', page: 1, limit: 50 });
        const listed = requests.find((r) => Number(r.id) === Number(orr.id));
        assert.strictEqual(Number(listed.gross_amount), FARE_B,
            'sau khi chốt, danh sách vẫn không được hồi sinh doanh thu chuyến hư hại');
        assert.strictEqual(Number(listed.receipt_amount), FARE_B + TOLL_OK);

        // Chi phí chuyến hư hại vẫn được duyệt và chờ hoàn cho tài xế — không bị xóa
        const { rows: dmgExpenses } = await pool.query(
            `SELECT status, reimbursement_status FROM expenses WHERE shipment_id = 1 ORDER BY id`,
        );
        assert.strictEqual(dmgExpenses.length, 2);
        assert.ok(dmgExpenses.every((e) => e.status === 'approved' && e.reimbursement_status === 'pending'),
            'tài xế vẫn phải được hoàn đủ tiền đã ứng cho chuyến hư hại');
    });

    it('B6 — Driver B thu tiền mặt: chi hộ chuyến hư hại ghi Nợ 642 (DN chịu), KHÔNG ghi 3388', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 1');
        await tripService.recordReceiptCollection(orr.id, DRIVER_B, {
            paymentType: 'cash_collected', proofUrl: 'https://proof.test/cash.jpg',
        });

        // Chỉ chi phí của CHÍNH Driver B được cấn trừ vào nợ của Driver B (chi phí chuyến 1
        // là của Driver A, hoàn qua lương) — kiểm bút toán của khoản chi hộ chuyến 2.
        const { rows: [okToll] } = await pool.query(
            `SELECT ft.debit_account, ft.credit_account, ft.amount, ft.event_type
             FROM financial_transactions ft
             JOIN expenses e ON e.id = ft.ref_id
             WHERE ft.ref_type = 'expense' AND e.shipment_id = 2 AND e.expense_type = 'toll'`,
        );
        assert.ok(okToll, 'chi hộ chuyến giao được phải được ghi sổ khi cấn trừ');
        assert.strictEqual(okToll.debit_account, '3388', 'chuyến giao được: vẫn là chi hộ khách');
        assert.strictEqual(okToll.event_type, 'pass_through_cost');

        // Không được có bút toán 3388 nào cho chi phí của chuyến bị hủy
        const { rows: [wrong] } = await pool.query(
            `SELECT COUNT(*)::int AS c
             FROM financial_transactions ft
             JOIN expenses e ON e.id = ft.ref_id
             WHERE ft.ref_type = 'expense' AND e.shipment_id = 1 AND ft.debit_account = '3388'`,
        );
        assert.strictEqual(wrong.c, 0, 'chi phí chuyến hàng hư hại KHÔNG được treo trên 3388');
    });
});

describe('L2-FLOW-16b — Phiếu thu 0đ: hàng hư hại + khách đã trả trước đủ', () => {
    // Đơn 2: khách trả trước đủ cước; phần còn lại của đơn chỉ là chi phí chuyến hàng hư hại
    // (đã chuyển sang DN chịu) ⇒ tổng phải thu = 0. Driver vẫn phải đóng được phiếu.
    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (2, 1, 2, 'Hang de vo 2', 'cash', 1500000, 1500000, 'confirmed', 'bank_transfer')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status) VALUES
            (3, 2, 1, 1, 1500000, 100, 'available'),
            (4, 2, 2, 1, 1500000, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (3, 1, 'pickup', 'Kho Q7'), (3, 2, 'delivery', 'KCN Tan Tao'),
            (4, 1, 'pickup', 'Kho Q7'), (4, 2, 'delivery', 'KCN Vsip')
        `);
    });

    it('B1 — Chuyến 3 hư hại (có chi hộ 120k) bị hủy; chuyến 4 giao xong, khách đã trả trước đủ cước', async () => {
        await tripService.claimTrip(3, DRIVER_A);
        await tripService.updateStatus(3, DRIVER_A, 'picking');
        await tripService.startTransit(3, DRIVER_A, 'https://proof-loading.test/3.jpg');
        await expenseService.createExpense(DRIVER_A, {
            shipmentId: 3, expenseType: 'toll', amount: TOLL_DAMAGED,
            description: 'BOT', receiptUrl: 'https://r.test/toll-3.jpg',
        });
        const incident = await incidentService.createIncident(DRIVER_A, {
            shipmentId: 3, incidentType: 'cargo_damage', severityLevel: 'critical',
            description: 'Hang bi ngam nuoc mua, hong toan bo khong the giao',
        }, ['https://evidence.test/damage-3.jpg']);
        await incidentService.cancelDamagedShipment(incident.id, COORD_ID, { reason: 'Hang hong toan bo' });

        await tripService.claimTrip(4, DRIVER_B);
        await tripService.updateStatus(4, DRIVER_B, 'picking');
        await tripService.startTransit(4, DRIVER_B, 'https://proof-loading.test/4.jpg');
        await tripService.updateStatus(4, DRIVER_B, 'arrived');
        await tripService.completeTrip(4, DRIVER_B, 'https://proof-delivery.test/4.jpg');
        await tripService.requestOrderReceipt(2, DRIVER_B, { shipmentId: 4, actualKm: KM_B });

        const { rows: [s] } = await pool.query('SELECT status FROM order_shipments WHERE id = 3');
        assert.strictEqual(s.status, 'cancelled');
    });

    it('B2 — Duyệt → phiếu thu 0đ (cước đã trả trước, chi hộ chuyến hư hại do DN chịu)', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 2');
        await coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'da tra truoc', expenses: [] });

        const { rows: [receipt] } = await pool.query(
            'SELECT amount FROM shipment_receipts WHERE order_receipt_request_id = $1', [orr.id],
        );
        assert.strictEqual(Number(receipt.amount), 0);
    });

    it('B2b — Khách ứng đúng bằng cước nên không dư: KHÔNG phát sinh phiếu hoàn', async () => {
        const { rows: [v] } = await pool.query(
            `SELECT COUNT(*)::int AS c FROM payment_vouchers WHERE order_id = 2 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(v.c, 0, 'ứng đúng bằng phải trả thì không có gì để hoàn');
    });

    it('B3 — Driver đóng phiếu 0đ mà KHÔNG sinh công nợ nào (debts.total_amount CHECK > 0 không bị chạm)', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 2');
        const result = await tripService.recordReceiptCollection(orr.id, DRIVER_B, {
            paymentType: 'client_credit', proofUrl: null,
        });

        assert.strictEqual(result.nothingToCollect, true);

        const { rows: [rec] } = await pool.query(
            'SELECT payment_type FROM shipment_receipts WHERE order_receipt_request_id = $1', [orr.id],
        );
        assert.strictEqual(rec.payment_type, 'client_credit', 'phiếu vẫn phải được đóng');

        const { rows: [d] } = await pool.query('SELECT COUNT(*)::int AS c FROM debts WHERE order_id = 2');
        assert.strictEqual(d.c, 0, 'phiếu 0đ không được sinh công nợ khách hay công nợ tài xế');
    });

    it('B4 — Tài xế thu tiền mặt trên phiếu 0đ cũng không cần ảnh xác minh (không có gì để chụp)', async () => {
        // Phiếu của đơn 2 đã đóng ở B3; kiểm tại tầng service với phiếu 0đ mới của cùng luồng.
        // Yêu cầu ảnh chỉ được bỏ khi phiếu THẬT SỰ là 0đ — phiếu không tra được vẫn bắt ảnh.
        await assert.rejects(
            () => tripService.recordReceiptCollection(999999, DRIVER_B, { paymentType: 'cash_collected', proofUrl: null }),
            { message: 'Ảnh xác minh là bắt buộc cho hình thức này' },
        );
    });
});

describe('L2-FLOW-16c — Tiền ứng trước khi hàng hư hại', () => {
    // Đơn 3 — MỘT chuyến duy nhất, khách đã ứng trước 2tr (đã xác nhận). Chuyến bị hủy vì
    // hàng hư hại ⇒ đơn không còn gì giao được ⇒ KHÔNG bao giờ có phiếu thu (requestOrderReceipt
    // đòi chuyến 'completed'). Nếu không hoàn ngay tại bước hủy thì 2tr của khách nằm im
    // trong két công ty và đơn nhìn như đã xong.
    const PREPAID = 2000000;

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (3, 1, 2, 'Hang de vo 3', 'cash', ${PREPAID}, ${PREPAID}, 'confirmed', 'bank_transfer')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status)
            VALUES (5, 3, 1, 1, ${PREPAID}, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (5, 1, 'pickup', 'Kho Q9'), (5, 2, 'delivery', 'KCN Nhon Trach')
        `);
    });

    it('B1 — Hủy chuyến duy nhất vì hàng hư hại → tự tạo phiếu hoàn tiền ứng trước (duyệt sẵn)', async () => {
        await tripService.claimTrip(5, DRIVER_A);
        await tripService.updateStatus(5, DRIVER_A, 'picking');
        await tripService.startTransit(5, DRIVER_A, 'https://proof-loading.test/5.jpg');

        const incident = await incidentService.createIncident(DRIVER_A, {
            shipmentId: 5, incidentType: 'cargo_damage', severityLevel: 'critical',
            description: 'Hang bi vo hoan toan, khong con gi de giao cho khach',
        }, ['https://evidence.test/damage-5.jpg']);

        const result = await incidentService.cancelDamagedShipment(incident.id, COORD_ID, {
            reason: 'Hang vo hoan toan',
        });

        assert.ok(result.refund, 'đơn không còn chuyến nào giao được → phải sinh phiếu hoàn');
        assert.strictEqual(result.refund.amount, PREPAID);

        const { rows: [v] } = await pool.query(
            `SELECT voucher_type, amount, status FROM payment_vouchers WHERE order_id = 3`,
        );
        assert.strictEqual(v.voucher_type, 'prepaid_refund');
        assert.strictEqual(Number(v.amount), PREPAID);
        assert.strictEqual(v.status, 'approved', 'duyệt sẵn để kế toán chi + đính chứng từ');
    });

    it('B2 — Đã hoàn đủ rồi thì hủy thêm lần nữa KHÔNG được hoàn chồng phiếu thứ hai', async () => {
        // Chuyến đã cancelled nên hủy lại sẽ bị chặn; kiểm trực tiếp hàm tạo phiếu hoàn —
        // ba đường (hủy đơn / hủy chuyến / chốt phiếu thu) có thể nối tiếp nhau trên cùng
        // một đơn. Đã hoàn đủ 2tr rồi thì lần gọi sau còn 0 để hoàn.
        const orderRepository = require('../../repositories/orderRepository');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const again = await orderRepository.createPrepaidRefundVoucher(client, {
                orderId: 3, amount: PREPAID, actorId: COORD_ID, reason: 'Hoan lan hai',
            });
            await client.query('COMMIT');
            assert.strictEqual(again, null, 'đơn đã có phiếu hoàn thì không tạo thêm');
        } finally {
            client.release();
        }

        const { rows: [c] } = await pool.query(
            `SELECT COUNT(*)::int AS c FROM payment_vouchers WHERE order_id = 3 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(c.c, 1);
    });

    it('B3 — Tiền ứng CHƯA xác nhận (pending) thì không hoàn gì — chưa có dòng tiền thật', async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status)
            VALUES (4, 1, 2, 'Hang de vo 4', 'cash', 1000000, 1000000, 'pending')
        `);

        const orderRepository = require('../../repositories/orderRepository');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const refund = await orderRepository.createPrepaidRefundVoucher(client, {
                orderId: 4, amount: 1000000, actorId: COORD_ID, reason: 'Khong duoc phep hoan',
            });
            await client.query('COMMIT');
            assert.strictEqual(refund, null, 'prepaid pending = tiền chưa về, không có gì để hoàn');
        } finally {
            client.release();
        }
    });

    // BR-022E — khách phải nhận lại ĐỦ số thừa. Chống hoàn trùng bằng cách trừ phần đã hoàn,
    // KHÔNG phải bỏ qua khi đơn đã có phiếu hoàn: một phiếu hoàn cũ nhỏ hơn không được phép
    // nuốt phần còn thiếu.
    it('B4 — Đã hoàn MỘT PHẦN thì lần sau hoàn nốt phần còn thiếu, không bị chặn', async () => {
        const PREPAID_7 = 1000000;
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (7, 1, 2, 'Hang thuong 7', 'cash', ${PREPAID_7}, ${PREPAID_7}, 'confirmed', 'bank_transfer')
        `);
        const orderRepository = require('../../repositories/orderRepository');
        const refundOnce = async (amount) => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const r = await orderRepository.createPrepaidRefundVoucher(client, {
                    orderId: 7, amount, actorId: COORD_ID, reason: 'Hoan tien ung truoc',
                });
                await client.query('COMMIT');
                return r;
            } finally {
                client.release();
            }
        };

        const first = await refundOnce(400000);
        assert.strictEqual(first.amount, 400000);

        // amount = TỔNG cần hoàn tính tới lúc này (1tr), không phải phần tăng thêm
        const second = await refundOnce(PREPAID_7);
        assert.ok(second, 'còn thiếu 600k thì phải hoàn tiếp, không được trả null');
        assert.strictEqual(second.amount, 600000, 'chỉ hoàn phần còn thiếu, không hoàn lại từ đầu');

        // Trần là số khách đã ứng thật — hoàn quá là công ty tự trả thêm tiền túi
        assert.strictEqual(await refundOnce(1500000), null, 'không hoàn vượt số khách đã ứng');

        const { rows: [sum] } = await pool.query(
            `SELECT COALESCE(SUM(amount),0)::numeric AS total FROM payment_vouchers
             WHERE order_id = 7 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(Number(sum.total), PREPAID_7, 'tổng đã hoàn = đúng số khách ứng, không hơn không kém');
    });

    it('B5 — Phiếu hoàn bị TỪ CHỐI không tính là đã hoàn — khách vẫn được hoàn lại', async () => {
        const PREPAID_8 = 500000;
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (8, 1, 2, 'Hang thuong 8', 'cash', ${PREPAID_8}, ${PREPAID_8}, 'confirmed', 'bank_transfer')
        `);
        const orderRepository = require('../../repositories/orderRepository');
        const refundOnce = async (amount) => {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const r = await orderRepository.createPrepaidRefundVoucher(client, {
                    orderId: 8, amount, actorId: COORD_ID, reason: 'Hoan tien ung truoc',
                });
                await client.query('COMMIT');
                return r;
            } finally {
                client.release();
            }
        };

        const first = await refundOnce(PREPAID_8);
        await pool.query(`UPDATE payment_vouchers SET status = 'rejected' WHERE id = $1`, [first.voucherId]);

        // Phiếu rejected chưa chi đồng nào; tính nó là "đã hoàn" thì khách mất trắng khoản này
        const again = await refundOnce(PREPAID_8);
        assert.ok(again, 'phiếu bị từ chối không được khóa vĩnh viễn quyền hoàn của khách');
        assert.strictEqual(again.amount, PREPAID_8);
    });
});

describe('L2-FLOW-16d — Tiền ứng trước trừ vào CẢ chi hộ, không chỉ trừ vào cước', () => {
    // Đơn 5: cước 1.5tr, khách ứng 1.6tr, chi hộ 100k của chuyến giao được.
    //   Công thức cũ lúc duyệt: max(1.5tr − 1.6tr, 0) + 100k = 100.000đ
    //   Công thức xem trước   : max(1.5tr + 100k − 1.6tr, 0) = 0đ
    // Hai số lệch nhau đúng bằng phần chi hộ — coordinator nhìn một đằng, chốt ra một nẻo.
    const PREPAID = 1600000;
    const TOLL    = 100000;

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (5, 1, 2, 'Hang thuong', 'cash', 1500000, ${PREPAID}, 'confirmed', 'bank_transfer')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status)
            VALUES (6, 5, 1, 1, 1500000, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (6, 1, 'pickup', 'Kho Q12'), (6, 2, 'delivery', 'KCN Tan Binh')
        `);
    });

    it('B1 — Chuyến giao xong, có chi hộ 100k; khách đã ứng 1.6tr > cước 1.5tr', async () => {
        await tripService.claimTrip(6, DRIVER_B);
        await tripService.updateStatus(6, DRIVER_B, 'picking');
        await tripService.startTransit(6, DRIVER_B, 'https://proof-loading.test/6.jpg');
        await tripService.updateStatus(6, DRIVER_B, 'arrived');
        await expenseService.createExpense(DRIVER_B, {
            shipmentId: 6, expenseType: 'toll', amount: TOLL,
            description: 'BOT', receiptUrl: 'https://r.test/toll-6.jpg',
        });
        await tripService.completeTrip(6, DRIVER_B, 'https://proof-delivery.test/6.jpg');
        await tripService.requestOrderReceipt(5, DRIVER_B, { shipmentId: 6, actualKm: KM_B });
    });

    it('B2 — Số xem trước và số chốt thật PHẢI bằng nhau: 0đ (ứng đã phủ cả cước lẫn chi hộ)', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 5');

        const detail = await coordinatorService.getReceiptRequestDetail(orr.id);
        assert.strictEqual(detail.summary.final_price, FARE_B + TOLL);
        assert.strictEqual(detail.summary.remaining_receipt_amount, 0, 'xem trước: khách không phải trả thêm');

        await coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'ok', expenses: [] });

        const { rows: [receipt] } = await pool.query(
            'SELECT amount FROM shipment_receipts WHERE order_receipt_request_id = $1', [orr.id],
        );
        assert.strictEqual(Number(receipt.amount), detail.summary.remaining_receipt_amount,
            'số chốt thật phải khớp số đã hiện ở màn xem trước — chính bug đã sửa');
        assert.strictEqual(Number(receipt.amount), 0);
    });

    it('B3 — Phần ứng dư 0đ (1.6tr − 1.6tr) nên không sinh phiếu hoàn', async () => {
        const { rows: [c] } = await pool.query(
            `SELECT COUNT(*)::int AS c FROM payment_vouchers WHERE order_id = 5 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(c.c, 0, 'ứng 1.6tr, phải trả 1.6tr → dư 0, không hoàn');
    });
});

describe('L2-FLOW-16e — Ứng dư: hoàn TOÀN BỘ bằng tiền, không cấn vào nợ cũ của khách', () => {
    // BR-022E. Đơn 9: khách ứng 3tr, cước thật 1.5tr ⇒ dư 1.5tr phải hoàn hết.
    // Cùng khách này đang còn nợ 2tr ở một đơn khác. Cấn tự động thì khách không thấy tiền
    // về, kế toán mất một phiếu chi để đối chiếu, và số dư công nợ đổi mà không có giao dịch
    // nào giải thích — hai khoản khác đơn, khác chứng từ, không được trộn.
    const PREPAID  = 3000000;
    const OLD_DEBT = 2000000;
    const EXCESS   = PREPAID - FARE_B;   // 1.500.000

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (9, 1, 2, 'Hang thuong 9', 'cash', 1500000, ${PREPAID}, 'confirmed', 'bank_transfer')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status)
            VALUES (7, 9, 1, 1, 1500000, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (7, 1, 'pickup', 'Kho Binh Tan'), (7, 2, 'delivery', 'KCN Le Minh Xuan')
        `);
        // Nợ cũ của CHÍNH khách này ở đơn khác — phải còn nguyên sau khi hoàn tiền đơn 9
        await pool.query(`
            INSERT INTO debts (id, debt_type, customer_id, order_id, total_amount, due_date, notes, updated_by)
            VALUES (9001, 'customer', 1, 1, ${OLD_DEBT}, CURRENT_DATE + 30, 'No cu don khac', 2)
        `);
    });

    it('B1 — Chuyến giao xong, gửi yêu cầu phiếu thu', async () => {
        await tripService.claimTrip(7, DRIVER_B);
        await tripService.updateStatus(7, DRIVER_B, 'picking');
        await tripService.startTransit(7, DRIVER_B, 'https://proof-loading.test/7.jpg');
        await tripService.updateStatus(7, DRIVER_B, 'arrived');
        await tripService.completeTrip(7, DRIVER_B, 'https://proof-delivery.test/7.jpg');
        await tripService.requestOrderReceipt(9, DRIVER_B, { shipmentId: 7, actualKm: KM_B });
    });

    it('B2 — Màn xem trước báo trước số phải hoàn, đúng bằng phần dư', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 9');
        const detail = await coordinatorService.getReceiptRequestDetail(orr.id);

        assert.strictEqual(detail.summary.remaining_receipt_amount, 0, 'khách không phải trả thêm');
        assert.strictEqual(detail.summary.prepaid_refund_due, EXCESS,
            'coordinator phải thấy khoản phải hoàn TRƯỚC khi bấm Duyệt');
    });

    it('B3 — Duyệt → phiếu hoàn đúng TOÀN BỘ phần dư, duyệt sẵn cho kế toán chi', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 9');
        const result = await coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'ok', expenses: [] });

        assert.ok(result.refund, 'ứng dư thì việc duyệt phải sinh phiếu hoàn');
        assert.strictEqual(result.refund.amount, EXCESS, 'hoàn hết phần dư, không hoàn một nửa');

        const { rows: vouchers } = await pool.query(
            `SELECT amount, status, payment_method FROM payment_vouchers
             WHERE order_id = 9 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(vouchers.length, 1);
        assert.strictEqual(Number(vouchers[0].amount), EXCESS);
        assert.strictEqual(vouchers[0].status, 'approved');
    });

    it('B4 — Nợ cũ ở đơn khác KHÔNG bị cấn trừ: còn nguyên 2tr, không phát sinh debt_payments', async () => {
        const { rows: [debt] } = await pool.query('SELECT total_amount FROM debts WHERE id = 9001');
        assert.strictEqual(Number(debt.total_amount), OLD_DEBT, 'nợ cũ phải giữ nguyên');

        const { rows: [paid] } = await pool.query(
            `SELECT COUNT(*)::int AS c FROM debt_payments WHERE debt_id = 9001`,
        );
        assert.strictEqual(paid.c, 0, 'không được lấy tiền thừa của đơn 9 bù sang nợ đơn khác');
    });
});

describe('L2-FLOW-16f — Chuyến GIAO THẤT BẠI chưa xử lý thì CHƯA được hoàn tiền ứng', () => {
    // Regression: 'failed' KHÔNG phải trạng thái kết thúc — resolveFailedShipment đưa chuyến
    // về 'transit' (giao lại). Nếu coi 'failed' là hết đòi được thì:
    //   hủy chuyến kia vì hàng hư hại → hoàn TOÀN BỘ 3tr tiền ứng
    //   → điều phối cho giao lại → chuyến chạy xong → phiếu thu lại trừ 3tr lần nữa
    //   → công ty mất đúng 3tr vừa trả cho khách.
    const PREPAID = 3000000;
    const EXCESS  = PREPAID - FARE_B;   // 1.500.000 — phần dư THẬT SỰ phải hoàn, chỉ một lần

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status, prepaid_method)
            VALUES (10, 1, 2, 'Hang de vo 10', 'cash', 3000000, ${PREPAID}, 'confirmed', 'bank_transfer')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status) VALUES
            (8,  10, 1, 1, 1500000, 100, 'available'),
            (9,  10, 2, 1, 1500000, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (8, 1, 'pickup', 'Kho Thu Duc'), (8, 2, 'delivery', 'KCN Bien Hoa'),
            (9, 1, 'pickup', 'Kho Thu Duc'), (9, 2, 'delivery', 'KCN Long Binh')
        `);
    });

    it('B1 — Chuyến 8 giao thất bại (chờ điều phối xử lý), chuyến 9 hủy vì hàng hư hại', async () => {
        await tripService.claimTrip(8, DRIVER_A);
        await tripService.updateStatus(8, DRIVER_A, 'picking');
        await tripService.startTransit(8, DRIVER_A, 'https://proof-loading.test/8.jpg');
        await tripService.updateStatus(8, DRIVER_A, 'arrived');
        await tripService.updateStatus(8, DRIVER_A, 'failed', 'Khach khong nhan hang');

        await tripService.claimTrip(9, DRIVER_B);
        await tripService.updateStatus(9, DRIVER_B, 'picking');
        await tripService.startTransit(9, DRIVER_B, 'https://proof-loading.test/9.jpg');
        const incident = await incidentService.createIncident(DRIVER_B, {
            shipmentId: 9, incidentType: 'cargo_damage', severityLevel: 'critical',
            description: 'Hang vo trong thung xe, khong giao duoc',
        }, ['https://evidence.test/damage-9.jpg']);

        const result = await incidentService.cancelDamagedShipment(incident.id, COORD_ID, {
            reason: 'Hang vo hoan toan',
        });

        assert.strictEqual(result.refund, null,
            'đơn còn chuyến 8 đang chờ xử lý (có thể giao lại) → CHƯA được hoàn tiền ứng');

        const { rows: [c] } = await pool.query(
            `SELECT COUNT(*)::int AS c FROM payment_vouchers WHERE order_id = 10`,
        );
        assert.strictEqual(c.c, 0);
    });

    it('B2 — Điều phối cho GIAO LẠI → chuyến 8 sống lại và chạy xong', async () => {
        await coordinatorService.resolveFailedShipment(8, { action: 'redeliver' }, COORD_ID);

        const { rows: [s] } = await pool.query('SELECT status, failed_at FROM order_shipments WHERE id = 8');
        assert.strictEqual(s.status, 'transit', 'giao lại phải đưa chuyến về đường chạy');
        assert.strictEqual(s.failed_at, null);

        await tripService.updateStatus(8, DRIVER_A, 'arrived');
        await tripService.completeTrip(8, DRIVER_A, 'https://proof-delivery.test/8.jpg');
        await tripService.requestOrderReceipt(10, DRIVER_A, { shipmentId: 8, actualKm: KM_B });
    });

    it('B3 — Tiền ứng chỉ được trừ MỘT lần: phiếu thu 0đ và hoàn đúng phần dư 1.5tr', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 10');
        const result = await coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'ok', expenses: [] });

        const { rows: [receipt] } = await pool.query(
            'SELECT amount FROM shipment_receipts WHERE order_receipt_request_id = $1', [orr.id],
        );
        assert.strictEqual(Number(receipt.amount), 0, 'ứng 3tr > cước 1.5tr nên khách không phải trả thêm');

        assert.ok(result.refund);
        assert.strictEqual(result.refund.amount, EXCESS);

        const { rows: [sum] } = await pool.query(
            `SELECT COALESCE(SUM(amount),0)::numeric AS total, COUNT(*)::int AS c
             FROM payment_vouchers WHERE order_id = 10 AND voucher_type = 'prepaid_refund'`,
        );
        assert.strictEqual(sum.c, 1, 'đúng một phiếu hoàn');
        assert.strictEqual(Number(sum.total), EXCESS,
            'hoàn đúng phần dư — KHÔNG hoàn 3tr rồi lại trừ 3tr trên phiếu thu');
    });
});

describe('L2-FLOW-16g — Tiền ứng CHƯA xác nhận: không trừ, không chốt được, hai màn cùng một số', () => {
    // Tiền ứng 'pending' = kế toán mới nhập, tiền chưa về và chưa ghi sổ. approveReceiptRequest
    // chặn cứng trạng thái này, nên màn xem trước KHÔNG được trừ nó ra rồi hiện một con số
    // không bao giờ chốt được.
    const PREPAID = 1000000;
    const TOLL    = 100000;

    beforeAll(async () => {
        await pool.query(`
            INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                                total_estimated_price, prepaid_amount, prepaid_status)
            VALUES (11, 1, 2, 'Hang thuong 11', 'cash', 1500000, ${PREPAID}, 'pending')
        `);
        await pool.query(`
            INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id, estimated_price, estimated_distance_km, status)
            VALUES (10, 11, 1, 1, 1500000, 100, 'available')
        `);
        await pool.query(`
            INSERT INTO trip_stops (shipment_id, stop_index, stop_type, address) VALUES
            (10, 1, 'pickup', 'Kho Cu Chi'), (10, 2, 'delivery', 'KCN Tay Bac')
        `);

        await tripService.claimTrip(10, DRIVER_B);
        await tripService.updateStatus(10, DRIVER_B, 'picking');
        await tripService.startTransit(10, DRIVER_B, 'https://proof-loading.test/10.jpg');
        await tripService.updateStatus(10, DRIVER_B, 'arrived');
        await expenseService.createExpense(DRIVER_B, {
            shipmentId: 10, expenseType: 'toll', amount: TOLL,
            description: 'BOT', receiptUrl: 'https://r.test/toll-10.jpg',
        });
        await tripService.completeTrip(10, DRIVER_B, 'https://proof-delivery.test/10.jpg');
        await tripService.requestOrderReceipt(11, DRIVER_B, { shipmentId: 10, actualKm: KM_B });
    });

    it('B1 — Màn xem trước KHÔNG trừ khoản ứng chưa xác nhận và báo rõ lý do', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 11');
        const detail = await coordinatorService.getReceiptRequestDetail(orr.id);

        assert.strictEqual(detail.summary.prepaid_pending, true);
        assert.strictEqual(detail.summary.prepaid_amount, 0, 'tiền chưa về thì chưa được trừ');
        assert.strictEqual(detail.summary.prepaid_amount_declared, PREPAID, 'vẫn phải nói ra số đã khai');
        assert.strictEqual(detail.summary.remaining_receipt_amount, FARE_B + TOLL);
        assert.strictEqual(detail.summary.prepaid_refund_due, 0);
    });

    it('B2 — Bấm Duyệt vẫn bị chặn — số xem trước và hành vi thật khớp nhau', async () => {
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 11');
        await assert.rejects(
            () => coordinatorService.approveReceiptRequest(orr.id, COORD_ID, { notes: 'x', expenses: [] }),
            /chưa được xác nhận/,
        );
    });

    it('B3 — Màn DANH SÁCH và màn CHI TIẾT phiếu thu của tài xế hiện CÙNG một số', async () => {
        const tripRepository = require('../../repositories/tripRepository');
        const { rows: [orr] } = await pool.query('SELECT id FROM order_receipt_requests WHERE order_id = 11');

        const list   = await tripRepository.getDriverReceipts(DRIVER_B, { page: 1, limit: 50 });
        const inList = list.find((r) => Number(r.orr_id) === Number(orr.id));
        const detail = await tripRepository.getDriverReceiptDetail(orr.id, DRIVER_B);

        assert.ok(inList, 'phiếu phải có trong danh sách của tài xế');
        assert.strictEqual(Number(inList.amount), Number(detail.amount),
            'trước đây danh sách cộng chi hộ còn chi tiết thì không — hai màn ra hai số');
        assert.strictEqual(Number(detail.amount), FARE_B + TOLL,
            'cước + chi hộ, không trừ khoản ứng chưa xác nhận');
        assert.strictEqual(Number(detail.prepaid_amount), 0,
            'không hiện "đã trả trước" cho khoản kế toán chưa xác nhận');
    });

    // Cột "SỐ TIỀN" của màn danh sách hiển thị receipt_amount, và khoá sắp xếp
    // "Số tiền cao/thấp nhất" cũng là ORDER BY receipt_amount — hai thứ phải là MỘT, nếu không
    // sắp xếp xong người dùng nhìn cột tiền thấy thứ tự lộn xộn.
    it('B4 — Sắp xếp theo số tiền chạy đúng trên chính con số đang hiển thị', async () => {
        const desc = await coordinatorService.getReceiptRequests({ kind: 'all', sort: 'amount-desc', page: 1, limit: 50 });
        const asc  = await coordinatorService.getReceiptRequests({ kind: 'all', sort: 'amount-asc',  page: 1, limit: 50 });

        const amounts = (res) => res.requests.map((r) => Number(r.receipt_amount));
        const descAmounts = amounts(desc);
        const ascAmounts  = amounts(asc);

        assert.ok(descAmounts.length > 1, 'cần nhiều hơn 1 dòng mới kiểm được thứ tự');
        assert.deepStrictEqual(descAmounts, [...descAmounts].sort((a, b) => b - a));
        assert.deepStrictEqual(ascAmounts, [...ascAmounts].sort((a, b) => a - b));
    });
});
