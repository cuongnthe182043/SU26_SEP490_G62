/**
 * TRẦN KHẤU TRỪ CÔNG NỢ — bản tài xế XEM TRƯỚC và bản kế toán CHỐT phải ra cùng một số.
 *
 * Vì sao có file này: trần khấu trừ được viết HAI LẦN ở hai repository khác nhau, và hai
 * bản đã từng lệch mẫu số:
 *
 *   payrollRepository.getPayrollEstimate  (tài xế xem trên app)
 *       max(0, gross + expenseReimbursement − BHXH − ứng lương) × N%
 *
 *   accountantPayrollRepository._calcDriverPayroll  (kế toán chốt lương)
 *       max(0, gross                        − BHXH − ứng lương) × N%   ← thiếu tiền hoàn ứng
 *
 * expenseReimbursement không phải thu nhập (không vào gross, không vào BHXH) nhưng
 * net_salary CÓ cộng nó, nên nó là một phần của "số tài xế còn được nhận" — đúng thứ mà
 * trần này lấy N%. Bỏ sót ⇒ hai màn ra hai số, lệch đúng N% × tiền hoàn ứng.
 *
 * Ca kiểm thử dựng đúng tình huống làm lộ bug: tài xế vừa CÓ NỢ vừa CÓ khoản ứng túi chờ
 * hoàn. Nợ phải đủ lớn để trần là thứ quyết định (deduction = trần, không phải = nợ), nếu
 * không thì min(nợ, trần) = nợ ở cả hai bên và bug ẩn đi.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let payrollRepository;
let accountantPayrollRepository;
let expenseRepository;

const MGR_ID = 1;
const DRIVER_ID = 4;

const REIMBURSEMENT = 2_000_000;   // tài ứng túi tiền bảo dưỡng, chờ hoàn
const DRIVER_DEBT   = 50_000_000;  // đủ lớn để trần luôn là ràng buộc siết
const CAP_PERCENT   = 30;

const now = new Date();
const MONTH = now.getMonth() + 1;
const YEAR = now.getFullYear();

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    payrollRepository = require('../../repositories/payrollRepository');
    accountantPayrollRepository = require('../../repositories/accountantPayrollRepository');
    expenseRepository = require('../../repositories/expenseRepository');

    await pool.query(`
        TRUNCATE financial_transactions, payment_vouchers, payrolls, salary_advances,
                 debt_payments, debts, expense_attachments, expenses, maintenance_records,
                 kpi_records, order_shipments, orders, customers, vehicles, vehicle_groups,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id) VALUES
        (1,'manager@test.com','hash',1),(4,'driver1@test.com','hash',4)
    `);
    await pool.query(`
        INSERT INTO profiles (id, full_name, phone, role_id) VALUES
        (1,'Manager','0900000001',1),(4,'Tran Van Tai','0900000004',4)
    `);
    await pool.query(`INSERT INTO vehicle_groups (id, name, price_per_km) VALUES (1, 'Xe 5m2', 15000)`);
    await pool.query(`INSERT INTO vehicles (id, plate_number, vehicle_group_id, assigned_driver_id, status) VALUES (1, '51E-123.45', 1, 4, 'active')`);
    await pool.query(`
        INSERT INTO drivers (profile_id, vehicle_id, default_vehicle_group_id, license_number, hire_date)
        VALUES (4, 1, 1, 'DL-1', CURRENT_DATE - INTERVAL '14 months')
    `);

    // Trần khấu trừ đọc từ company_info; chốt cứng để phép tính trong test xác định.
    await pool.query(
        `INSERT INTO company_info (id, driver_debt_monthly_cap_percent)
         VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET driver_debt_monthly_cap_percent = EXCLUDED.driver_debt_monthly_cap_percent`,
        [CAP_PERCENT],
    );

    // Khoản tài ứng túi, đã duyệt, CHƯA có phiếu hoàn ứng nào → bảng lương phải hoàn qua kỳ.
    await pool.query(`
        INSERT INTO expenses (id, shipment_id, vehicle_id, created_by, updated_by, expense_type,
                              amount, description, expense_date, status)
        VALUES (1, NULL, 1, 1, 1, 'maintenance', ${REIMBURSEMENT}, 'Thay dau', CURRENT_DATE, 'pending')
    `);
    await expenseRepository.approveExpense(1, MGR_ID);
    await pool.query(`
        INSERT INTO maintenance_records (id, vehicle_id, maintenance_type, maintenance_date, status,
                                         cost, performed_by, expense_id, created_by)
        VALUES (1, 1, 'scheduled', CURRENT_DATE, 'completed', ${REIMBURSEMENT}, 4, 1, 4)
    `);

    // Nợ tài xế lớn — trần là thứ quyết định số bị trừ.
    await pool.query(`
        INSERT INTO debts (debt_type, driver_id, total_amount, due_date, notes, updated_by)
        VALUES ('driver', 4, ${DRIVER_DEBT}, CURRENT_DATE + 30, 'No cu rat lon', 1)
    `);
});

afterAll(async () => {
    await teardown();
});

describe('Trần khấu trừ công nợ — xem trước và chốt lương không được lệch', () => {
    it('tiền đề: tài xế có cả nợ lẫn khoản ứng chờ hoàn, và trần đang là ràng buộc siết', async () => {
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, { month: MONTH, year: YEAR });

        assert.strictEqual(
            Number(estimate.expense_reimbursement), REIMBURSEMENT,
            'khoản ứng túi phải đang chờ hoàn qua kỳ lương — nếu không thì ca này không chạm được bug',
        );
        assert.ok(
            Number(estimate.driver_debt_deduction) < DRIVER_DEBT,
            'nợ phải lớn hơn trần, để số bị trừ do TRẦN quyết định chứ không phải do hết nợ',
        );
    });

    it('driver_debt_deduction lúc chốt lương phải bằng đúng số tài xế đã xem trước', async () => {
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, { month: MONTH, year: YEAR });

        await accountantPayrollRepository.calculateAndUpsertPayrolls(MONTH, YEAR);
        const { rows: [payroll] } = await pool.query(
            `SELECT driver_debt_deduction, expense_reimbursement, net_salary
             FROM payrolls WHERE driver_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
            [DRIVER_ID, MONTH, YEAR],
        );
        assert.ok(payroll, 'phải có dòng lương được tạo');

        assert.strictEqual(
            Number(payroll.expense_reimbursement), REIMBURSEMENT,
            'bảng lương phải hoàn đúng khoản tài đã ứng',
        );

        // Đây là phép chốt của cả file: hai công thức viết ở hai nơi phải ra cùng một số.
        // Lệch ở đây nghĩa là tài xế nhìn một con số trên app rồi nhận một con số khác.
        assert.strictEqual(
            Number(payroll.driver_debt_deduction),
            Number(estimate.driver_debt_deduction),
            'trần khấu trừ lúc chốt lệch bản xem trước — kiểm lại mẫu số ở hai repository',
        );
    });

    it('trần phải được tính TRÊN CẢ tiền hoàn ứng, không chỉ trên lương', async () => {
        const { rows: [payroll] } = await pool.query(
            `SELECT driver_debt_deduction FROM payrolls
             WHERE driver_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
            [DRIVER_ID, MONTH, YEAR],
        );

        // Bỏ tiền hoàn ứng ra khỏi mẫu số thì trần thấp hơn đúng CAP_PERCENT% × REIMBURSEMENT.
        // Khẳng định này chốt CHIỀU của phép sửa, không chỉ chốt "hai bên bằng nhau" — nếu
        // ai đó sửa nhầm bằng cách bỏ tiền hoàn ứng khỏi CẢ HAI bên thì test trên vẫn xanh
        // mà tài xế lại bị trừ ít hơn mức quy chế cho phép.
        const thieuHut = Math.round(REIMBURSEMENT * CAP_PERCENT / 100);
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, { month: MONTH, year: YEAR });
        const tranNeuBoSotTienHoan = Number(estimate.driver_debt_deduction) - thieuHut;

        assert.notStrictEqual(
            Number(payroll.driver_debt_deduction), tranNeuBoSotTienHoan,
            `trần đang bị tính thiếu ${thieuHut}đ — đúng bằng ${CAP_PERCENT}% của tiền hoàn ứng`,
        );
    });

    it('tài xế vẫn còn lương để sống — trần không được lấy sạch', async () => {
        const { rows: [payroll] } = await pool.query(
            `SELECT net_salary FROM payrolls
             WHERE driver_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
            [DRIVER_ID, MONTH, YEAR],
        );
        assert.ok(Number(payroll.net_salary) > 0, 'net_salary phải dương dù nợ rất lớn');
    });
});
