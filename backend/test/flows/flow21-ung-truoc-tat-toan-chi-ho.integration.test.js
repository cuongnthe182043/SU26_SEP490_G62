/**
 * L2-FLOW-21 — Tiền khách ỨNG TRƯỚC cũng phải tất toán phần chi hộ (Có 3388).
 *
 * Bối cảnh: mọi đường tiền khách về đã được chuyển sang insertCustomerCashIn — hàm tự tách
 * "phần chi hộ (Có 3388)" khỏi "phần cước (Có 131)". Nhưng bút toán xác nhận TIỀN ỨNG TRƯỚC
 * (orderRepository.confirmPrepaid) vẫn ghi thẳng Có 131 toàn bộ.
 *
 * Bình thường không lộ, vì khách thường ứng trước khi chuyến chạy nên chưa có chi hộ nào.
 * Nhưng kế toán xác nhận tiền ứng SAU khi chuyến đã chạy và chi phí đã duyệt là chuyện có
 * thật (tiền về tài khoản muộn) — lúc đó 3388 đã ghi Nợ mà không bao giờ được ghi Có, còn
 * 131 bị ghi Có nhiều hơn phần cước thực sự.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let orderRepository;
let expenseRepository;

const COORD_ID = 2;
const ACCT_ID = 3;
const DRIVER_ID = 4;
const CUOC = 450000;
const CHI_HO = 50000;

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    orderRepository = require('../../repositories/orderRepository');
    expenseRepository = require('../../repositories/expenseRepository');

    await pool.query(`
        TRUNCATE financial_transactions, expenses, order_shipments, orders, customers,
                 shipment_assignment_history, vehicles, vehicle_groups, drivers, profiles,
                 roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (2,'coord@test.com','hash',2),(3,'acct@test.com','hash',3),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, role_id) VALUES
        (2,'Coordinator',2),(3,'Accountant',3),(4,'Tai Xe A',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1,'Xe 5m2',15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1,'51E-123.45',1,4,'active')`);
    await pool.query(`INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date) VALUES (4,1,1,'DL-1',CURRENT_DATE)`);
    await pool.query(`INSERT INTO customers (id, customer_type, full_name, phone) VALUES (1,'individual','Khach A','0900000001')`);

    // Đơn có khai tiền ứng trước nhưng CHƯA xác nhận (tiền chưa về) — đúng trạng thái
    // 'pending' mà luồng thật tạo ra.
    await pool.query(`
        INSERT INTO orders (id, customer_id, created_by, cargo_name, payment_type,
                            total_estimated_price, derived_status, prepaid_amount, prepaid_status)
        VALUES (1, 1, 2, 'Hang test', 'bank_transfer', ${CUOC}, 'completed', ${CUOC + CHI_HO}, 'pending')
    `);
    await pool.query(`
        INSERT INTO order_shipments (id, order_id, shipment_index, vehicle_group_id,
                                     estimated_price, actual_price, actual_distance_km, status)
        VALUES (1, 1, 1, 1, ${CUOC}, ${CUOC}, 30, 'completed')
    `);
    await pool.query(`
        INSERT INTO shipment_assignment_history (shipment_id, to_driver_id, to_vehicle_id, change_reason, changed_by)
        VALUES (1, 4, 1, 'self_claim', 4)
    `);
    // Tài ứng tiền cầu đường, coordinator duyệt → ghi Nợ 3388 / Có 334
    await pool.query(`
        INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, updated_by,
                              expense_type, amount, expense_date, status)
        VALUES (1, 1, 1, 4, 4, 'toll', ${CHI_HO}, CURRENT_DATE, 'pending')
    `);
    await expenseRepository.approveExpense(1, COORD_ID);
});

afterAll(async () => {
    await teardown();
});

const soDu3388 = async () => {
    const { rows: [r] } = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN debit_account='3388' THEN amount
                                 WHEN credit_account='3388' THEN -amount ELSE 0 END), 0)::numeric AS du
        FROM financial_transactions`);
    return Number(r.du);
};

const soDu131 = async () => {
    const { rows: [r] } = await pool.query(`
        SELECT COALESCE(SUM(CASE WHEN debit_account='131' THEN amount
                                 WHEN credit_account='131' THEN -amount ELSE 0 END), 0)::numeric AS du
        FROM financial_transactions`);
    return Number(r.du);
};

describe('L2-FLOW-21 — Tiền ứng trước phải tất toán phần chi hộ', () => {
    it('A — Duyệt chi phí chi hộ ghi Nợ 3388 (tiền lẽ ra đòi lại được của khách)', async () => {
        assert.strictEqual(await soDu3388(), CHI_HO, 'chi hộ đã duyệt phải nằm ở dư Nợ 3388');
    });

    it('B — Kế toán xác nhận tiền ứng trước (gồm cả phần chi hộ) thì 3388 phải về 0', async () => {
        await orderRepository.confirmPrepaid(1, ACCT_ID, { paymentMethod: 'bank_transfer' });

        assert.strictEqual(
            await soDu3388(), 0,
            'khách đã trả cả phần chi hộ ⇒ phải ghi Có 3388 tất toán, không được để treo vĩnh viễn',
        );
    });

    it('C — 131 chỉ được ghi Có đúng phần CƯỚC, không nuốt luôn phần chi hộ', async () => {
        // Doanh thu chưa ghi nhận trong test này nên 131 chỉ có vế Có. Ghi Có đúng phần cước
        // thì dư = -CUOC; nuốt cả chi hộ thì dư = -(CUOC + CHI_HO).
        assert.strictEqual(
            await soDu131(), -CUOC,
            'ghi Có 131 cả phần chi hộ sẽ làm phải thu khách âm giả tạo',
        );
    });

    it('D — Đơn NGOÀI (kế toán nhập tay) có cả tiền ứng trước lẫn chi hộ cũng không được treo 3388', async () => {
        // Luồng nhập đơn ngoài ghi bút toán tiền ứng NGAY lúc tạo đơn, trước khi ghi chi phí
        // — nên tại thời điểm đó chưa có chi hộ nào để tách. Nếu không tất toán bù lại thì
        // khoản chi hộ của đơn này treo trên 3388 vĩnh viễn, y hệt lỗi ở luồng ứng trước.
        const accountantOrderRepository = require('../../repositories/accountantOrderRepository');
        const truoc = await soDu3388();

        await accountantOrderRepository.createOrderWithShipments({
            customer_name: 'Khach Nhap Tay',
            customer_phone: '0909000222',
            created_by: ACCT_ID,
            prepaid_amount: CUOC + CHI_HO,
            completed_at: '2026-08-10',
            shipments: [{
                vehicle_plate: '51E-123.45',
                driver_name: 'Tai Xe A',
                pickup_addresses: ['Kho A'],
                delivery_addresses: ['Kho B'],
                cargo_fee: CUOC,
                expenses: [{ expense_type: 'toll', amount: CHI_HO, description: 'Phi cau duong' }],
                payment_type: 'bank_transfer',
                driver_payment_state: 'company_received',
            }],
        });

        assert.strictEqual(
            await soDu3388() - truoc, 0,
            'khách đã ứng đủ cả phần chi hộ ⇒ 3388 của đơn này phải về 0, không được treo',
        );
    });
});
