/**
 * L2-FLOW-15 — Lương tháng dài ngày (29/30/31 ngày lịch), driver đi làm ĐỦ, không nghỉ.
 *
 * Bug nghiệp vụ đã sửa: công thức lương cứng là (base_salary / 28) × actual_working_days,
 * nhưng actual_working_days trước đây bị CHẶN TRẦN ở 28 (Math.min(28, ...)) — nghĩa là dù
 * tháng có 31 ngày và driver đi làm đủ cả 31 ngày, họ vẫn chỉ nhận đúng 1 lương cứng, không
 * hơn. DN yêu cầu đổi: đi làm dư ngày (29, 30, 31) so với quota 28 công thì phải được trả
 * thêm đúng phần dư đó — bỏ trần, actual_working_days = daysInMonth - unpaidDays (không cap).
 *
 * Kịch bản: driver senior (base 9.000.000), tháng 7/2026 (31 ngày lịch), KHÔNG nghỉ ngày
 * nào → actual_working_days phải = 31 (không phải 28), pro_rated_base phải VƯỢT base_salary
 * đúng 3 ngày công dư ra, và net_salary (cột GENERATED trong DB) phải phản ánh đúng khoản dư
 * đó — khớp cả ở màn ước tính (payrollRepository) lẫn khi chốt lương chính thức
 * (accountantPayrollRepository).
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let payrollRepository;
let accountantPayrollRepository;

const DRIVER_ID = 4;
const BASE_SALARY = 9_000_000; // senior — thâm niên >= 12 tháng
const MONTH = 7;               // tháng 7 — 31 ngày lịch
const YEAR = 2026;
const DAYS_IN_MONTH = 31;
// payrollRepository (màn ước tính) không Math.round proRatedBase — giữ nguyên số thập
// phân rồi .toFixed(2) ở tầng trả về API.
const ESTIMATE_PRO_RATED_BASE = Number(((BASE_SALARY / 28) * DAYS_IN_MONTH).toFixed(2));
// accountantPayrollRepository (chốt lương chính thức) Math.round proRatedBase về số nguyên
// trước khi lưu DB — hai nơi lệch nhau vài xu, chấp nhận được, không phải bug.
const FINAL_PRO_RATED_BASE = Math.round((BASE_SALARY / 28) * DAYS_IN_MONTH); // 9.964.286
const PHONE_ALLOWANCE = 200_000;
const BHXH_EMPLOYEE = Math.round(5_310_000 * 0.105); // 557.550
const EXPECTED_NET_SALARY = BASE_SALARY + PHONE_ALLOWANCE - BHXH_EMPLOYEE
    - (BASE_SALARY - FINAL_PRO_RATED_BASE); // = 9.606.736

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    payrollRepository = require('../../repositories/payrollRepository');
    accountantPayrollRepository = require('../../repositories/accountantPayrollRepository');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payrolls, kpi_records,
                 attendance_overrides, leave_requests, drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`
        INSERT INTO accounts (id, email, password_hash, role_id, is_active) VALUES
        (4,'driver1@test.com','hash',4, TRUE)
    `);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (4,'Driver A',4)`);
    // hire_date đủ xa để thâm niên >= 12 tháng tính tới cuối kỳ (base 9.000.000)
    await pool.query(`
        INSERT INTO drivers (profile_id, default_vehicle_group_id, license_number, hire_date, revenue_share_percent)
        VALUES (4, NULL, 'DL-1', '2020-01-01', 15)
    `);
    // Không leave_requests, không attendance_overrides → 0 ngày nghỉ trong tháng 7/2026
});

afterAll(async () => {
    await teardown();
});

describe('L2-FLOW-15 — Đi làm đủ cả tháng dài ngày (31 ngày): lương cứng phải trả dư, không cap ở 28', () => {
    it('B1 — Màn ước tính (payrollRepository.getPayrollEstimate): actual_working_days = 31, pro_rated_base vượt base_salary', async () => {
        const estimate = await payrollRepository.getPayrollEstimate(DRIVER_ID, { month: MONTH, year: YEAR });

        assert.strictEqual(estimate.actual_working_days, DAYS_IN_MONTH, 'đi làm đủ cả tháng 31 ngày, không cap ở 28');
        assert.strictEqual(Number(estimate.pro_rated_base), ESTIMATE_PRO_RATED_BASE);
        assert.ok(Number(estimate.pro_rated_base) > BASE_SALARY, 'phải được trả DƯ so với lương cứng vì đi dư 3 ngày công');
        // absence_penalty = base_salary - pro_rated_base → ÂM khi được trả thêm (không phải bị phạt)
        assert.strictEqual(Number(estimate.absence_penalty), Number((BASE_SALARY - ESTIMATE_PRO_RATED_BASE).toFixed(2)));
        assert.ok(Number(estimate.absence_penalty) < 0);
    });

    it('B2 — Chốt lương chính thức (accountantPayrollRepository.calculateAndUpsertPayrolls): net_salary trong DB phản ánh đúng khoản dư', async () => {
        await accountantPayrollRepository.calculateAndUpsertPayrolls(MONTH, YEAR);

        const { rows: [payroll] } = await pool.query(
            `SELECT base_salary, absence_penalty, gross_salary, net_salary
             FROM payrolls WHERE driver_id = $1 AND payroll_month = $2 AND payroll_year = $3`,
            [DRIVER_ID, MONTH, YEAR],
        );

        assert.ok(payroll, 'phải tạo được bản ghi payroll cho driver');
        assert.strictEqual(Number(payroll.base_salary), BASE_SALARY);
        assert.strictEqual(Number(payroll.absence_penalty), BASE_SALARY - FINAL_PRO_RATED_BASE);

        // net_salary là cột GENERATED: base_salary + other_bonus(phụ cấp ĐT) − BHXH − absence_penalty.
        // absence_penalty âm nên phép trừ hoá thành cộng — đúng cơ chế, không cần đổi schema DB.
        assert.strictEqual(
            Number(payroll.net_salary),
            EXPECTED_NET_SALARY,
            `net_salary (${payroll.net_salary}) phải phản ánh khoản dư ngày công, không bị cap ở base_salary (${BASE_SALARY})`,
        );
        assert.ok(Number(payroll.net_salary) > BASE_SALARY + PHONE_ALLOWANCE - BHXH_EMPLOYEE, 'phải cao hơn mức không có ngày dư');
    });
});
