/**
 * L2-FLOW-18 — Card "Đã thu về" (màn Doanh thu kế toán + Dashboard manager) phải là
 * TIỀN THỰC đã về công ty.
 *
 * Bug đã sửa: trước đây tính bằng phép trừ
 *      đã thu về = (cước + chi hộ) − công nợ còn lại
 * Cách này coi phần chi hộ mà TÀI TỰ GIỮ LẠI là "đã thu". Ví dụ đơn 350k = 300k cước
 * + 50k chi hộ tài ứng tiền túi: khách trả tiền mặt cho tài, tài giữ 50k bù khoản đã ứng
 * và còn nợ công ty 300k. Công ty chưa nhận đồng nào, nhưng công thức cũ ra
 * 350 − 300 = 50k "đã thu về".
 *
 * Sau khi sửa: đếm thẳng dòng tiền vào — tiền ứng trước đã xác nhận + các khoản tất toán
 * công nợ (loại dòng tài tự cấn trừ chi hộ) + khách chuyển khoản thẳng đã được kế toán
 * xác nhận.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let financeRepo;

const DRIVER_ID = 4;
const ACCT_ID = 3;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    financeRepo = require('../../repositories/accountantFinanceRepository');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payment_receipts,
                 shipment_receipts, order_receipt_requests, expenses, trip_stops,
                 shipment_assignment_history, order_shipments, orders, customers,
                 vehicles, vehicle_groups, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (3,'acct@test.com','hash',3),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (3,'Accountant',3),(4,'Driver A',4)`);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1, '51E-123.45', 1, 4, 'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4, 1, 1, 'DL-1', CURRENT_DATE)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1, 'individual', 'Khach A', '0900000001')`);
});

afterAll(async () => {
    await teardown();
});

// Dựng 1 đơn đã hoàn thành: cước `fare`, chi hộ `passThrough` do tài ứng tiền túi.
const seedCompletedOrder = async ({ orderId, fare, passThrough, prepaid = 0, prepaidStatus = 'none' }) => {
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                            total_estimated_price, derived_status, prepaid_amount, prepaid_status)
        VALUES ($1, 1, 3, 'Hang test', 'cash', $2, 'completed', $3, $4)
    `, [orderId, fare, prepaid, prepaidStatus]);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id,
                                     estimated_price, actual_price, actual_distance_km, status)
        VALUES ($1, $1, 1, 1, $2, $2, 20, 'completed')
    `, [orderId, fare]);
    await pool.query(`
        INSERT INTO shipment_assignment_history (shipment_id, to_driver_id, to_vehicle_id, change_reason, changed_by)
        VALUES ($1, 4, 1, 'self_claim', 4)
    `, [orderId]);
    if (passThrough > 0) {
        await pool.query(`
            INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, updated_by, expense_type,
                                  amount, expense_date, status, reimbursement_status)
            VALUES ($1, $1, 1, 4, 4, 'toll', $2, CURRENT_DATE, 'approved', 'pending')
        `, [orderId, passThrough]);
    }
};

// Tài bấm "khách trả tiền mặt": ghi nợ tài = TOÀN BỘ tiền thu, rồi tự cấn trừ khoản chi
// hộ tài đã ứng (đúng như recordReceiptCollection làm).
const driverCollectsCash = async ({ orderId, totalCollected, offsetExpense }) => {
    const { rows: [debt] } = await pool.query(`
        INSERT INTO debts (debt_type, driver_id, order_id, shipment_id, total_amount, notes, updated_by)
        VALUES ('driver', 4, $1, $1, $2, 'Tài xế đã thu tiền mặt từ khách', 4)
        RETURNING id
    `, [orderId, totalCollected]);
    if (offsetExpense > 0) {
        await pool.query(`
            INSERT INTO debt_payments (debt_id, amount, payment_method, status,
                                       confirmed_at, confirmed_by, created_by, notes)
            VALUES ($1, $2, 'offset', 'confirmed', NOW(), 4, 4, 'Cấn trừ chi phí tài đã ứng')
        `, [debt.id, offsetExpense]);
        await pool.query(`UPDATE expenses SET reimbursement_status = 'offset_debt' WHERE shipment_id = $1`, [orderId]);
    }
    return debt.id;
};

describe('L2-FLOW-18 — "Đã thu về" phải là tiền thực về công ty', () => {
    it('A — Tài giữ hết tiền, mới chỉ tự cấn trừ chi hộ: công ty CHƯA nhận đồng nào ⇒ đã thu về = 0', async () => {
        // Đơn 350k = 300k cước + 50k chi hộ. Khách trả tiền mặt 350k cho tài.
        // Tài giữ 50k bù khoản đã ứng, còn nợ công ty 300k.
        await seedCompletedOrder({ orderId: 1, fare: 300000, passThrough: 50000 });
        await driverCollectsCash({ orderId: 1, totalCollected: 350000, offsetExpense: 50000 });

        const stats = await financeRepo.getFinanceStats();

        assert.strictEqual(stats.total_gross_revenue, 300000, 'tổng doanh thu = cước, không gồm chi hộ');
        assert.strictEqual(
            stats.total_collected, 0,
            'tài chưa nộp đồng nào về công ty ⇒ đã thu về phải là 0, không phải 50k tiền chi hộ tài tự giữ',
        );
        assert.strictEqual(stats.total_receivables, 300000, 'công ty còn phải thu đúng phần tài đang giữ');
    });

    it('B — Tài nộp tiền về công ty: đã thu về = đúng số tiền nộp', async () => {
        const { rows: [debt] } = await pool.query(`SELECT id FROM debts WHERE order_id = 1 AND debt_type = 'driver'`);
        await pool.query(`
            INSERT INTO debt_payments (debt_id, amount, payment_method, status,
                                       confirmed_at, confirmed_by, created_by, notes)
            VALUES ($1, 300000, 'cash', 'confirmed', NOW(), 3, 4, 'Tài nộp tiền mặt về công ty')
        `, [debt.id]);

        const stats = await financeRepo.getFinanceStats();

        assert.strictEqual(stats.total_collected, 300000, 'tiền tài nộp về mới là tiền thực thu');
        assert.strictEqual(stats.total_receivables, 0, 'nộp đủ thì hết nợ');
    });

    it('C — Cấn trừ công nợ vào lương (kế toán ghi) VẪN tính là thu hồi được', async () => {
        // Khác hẳn cấn trừ chi hộ: ở đây công ty giữ lại lương thay vì chi ra ⇒ thu hồi thật.
        await seedCompletedOrder({ orderId: 2, fare: 200000, passThrough: 0 });
        const debtId = await driverCollectsCash({ orderId: 2, totalCollected: 200000, offsetExpense: 0 });
        await pool.query(`
            INSERT INTO debt_payments (debt_id, amount, payment_method, status,
                                       confirmed_at, confirmed_by, created_by, notes)
            VALUES ($1, 200000, 'offset', 'confirmed', NOW(), $2, $2, 'Cấn trừ công nợ vào lương')
        `, [debtId, ACCT_ID]);

        const stats = await financeRepo.getFinanceStats();

        // 300k của đơn 1 + 200k khấu trừ lương của đơn 2
        assert.strictEqual(
            stats.total_collected, 500000,
            'cấn trừ vào lương do kế toán ghi phải được tính, chỉ loại dòng tài tự cấn trừ chi hộ',
        );
    });

    it('D — Khách chuyển khoản thẳng, kế toán đã xác nhận tiền về: cộng vào đã thu về', async () => {
        await seedCompletedOrder({ orderId: 3, fare: 400000, passThrough: 0 });
        await pool.query(`
            INSERT INTO financial_transactions (event_type, debit_account, credit_account, amount,
                                                description, ref_type, ref_id, actor_id)
            VALUES ('bank_receipt', '1121', '131', 400000, 'Kế toán xác nhận chuyển khoản', 'shipment', 3, $1)
        `, [ACCT_ID]);

        const stats = await financeRepo.getFinanceStats();

        assert.strictEqual(stats.total_collected, 900000, '500k trước + 400k khách chuyển khoản đã xác nhận');
    });

    it('E — Tiền ứng trước ĐÃ xác nhận thì tính, còn "pending" (tiền chưa về) thì không', async () => {
        await seedCompletedOrder({ orderId: 4, fare: 100000, passThrough: 0, prepaid: 100000, prepaidStatus: 'pending' });
        const afterPending = await financeRepo.getFinanceStats();
        assert.strictEqual(afterPending.total_collected, 900000, 'ứng trước chưa xác nhận = tiền chưa về, không được tính');

        await pool.query(`UPDATE orders SET prepaid_status = 'confirmed' WHERE id = 4`);
        const afterConfirmed = await financeRepo.getFinanceStats();
        assert.strictEqual(afterConfirmed.total_collected, 1000000, 'xác nhận xong thì cộng vào đã thu về');
    });
});
