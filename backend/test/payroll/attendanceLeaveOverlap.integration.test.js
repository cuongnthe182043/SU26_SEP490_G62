/**
 * Ngày công khi ĐƠN NGHỈ và CHẤM CÔNG cùng trỏ vào một ngày lịch.
 *
 * Bug đã sửa: ba truy vấn đếm rời (đơn nghỉ không lương / absent_unexcused / half_day) được
 * cộng thẳng lại, nên một ngày có cả hai loại bản ghi bị trừ HAI công. Tài xế senior mất
 * 321.429đ mỗi ngày dính, và bảng lương rời trạng thái 'pending' rồi thì không sửa được nữa.
 *
 * Đường vào có thật: điều phối chấm 'absent_unexcused' trước, tài xế đăng ký nghỉ bù sau —
 * attendanceService chặn chiều xuôi nhưng leaveService không chặn chiều ngược.
 *
 * Quy tắc sau khi sửa — CHẤM CÔNG thắng ĐƠN NGHỈ:
 *   ngày lễ → 0 · absent_unexcused → 1 · half_day → 0.5
 *   present/holiday_worked → 0 · chỉ có đơn nghỉ không lương → 1
 *
 * Test này phủ CẢ các ca không được phép đổi hành vi, không chỉ ca vừa sửa.
 */
const assert = require('node:assert');
const { setupTestDb } = require('../helpers/testDb');

let pool;
let teardown;
let payrollRepository;
let accountantPayrollRepository;
let leaveService;

const DRIVER = 4;
const BASE = 9_000_000;          // senior — hire_date đủ xa
const MONTH = 7;
const YEAR = 2026;
const DAYS_IN_MONTH = 31;
const DAILY = BASE / 28;         // đơn giá 1 công — mẫu số 28 giữ nguyên, không đụng tới

// Đặt số công về đúng trạng thái muốn kiểm rồi đo — mỗi ca chạy trên nền sạch
const resetDays = async () => {
    await pool.query('DELETE FROM leave_requests WHERE driver_id = $1', [DRIVER]);
    await pool.query('DELETE FROM attendance_overrides WHERE driver_id = $1', [DRIVER]);
};
const addLeave = (date, type = 'unpaid') => pool.query(
    `INSERT INTO leave_requests (driver_id, leave_date, leave_type, status)
     VALUES ($1, $2, $3, 'approved')`, [DRIVER, date, type],
);
const addAttendance = (date, status) => pool.query(
    `INSERT INTO attendance_overrides (driver_id, work_date, status, marked_by)
     VALUES ($1, $2, $3, $1)`, [DRIVER, date, status],
);
const workDays = async () => {
    const est = await payrollRepository.getPayrollEstimate(DRIVER, { month: MONTH, year: YEAR });
    return Number(est.actual_working_days);
};

beforeAll(async () => {
    ({ pool, teardown } = await setupTestDb());
    payrollRepository = require('../../repositories/payrollRepository');
    accountantPayrollRepository = require('../../repositories/accountantPayrollRepository');
    leaveService = require('../../services/leaveService');

    await pool.query(`
        TRUNCATE financial_transactions, debt_payments, debts, payrolls, kpi_records,
                 company_holidays, attendance_overrides, leave_requests,
                 drivers, profiles, roles, accounts
        RESTART IDENTITY CASCADE
    `);
    await pool.query(`INSERT INTO roles (id, name) VALUES (1,'manager'),(2,'coordinator'),(3,'accountant'),(4,'driver')`);
    await pool.query(`INSERT INTO accounts (id, email, password_hash, role_id, is_active) VALUES (4,'d@t.com','h',4,TRUE)`);
    await pool.query(`INSERT INTO profiles (id, full_name, role_id) VALUES (4,'Driver A',4)`);
    await pool.query(`
        INSERT INTO drivers (profile_id, default_vehicle_group_id, license_number, hire_date, revenue_share_percent)
        VALUES (4, NULL, 'DL-1', '2020-01-01', 15)
    `);
});

afterAll(async () => { await teardown(); });

describe('Ngày công — đơn nghỉ chồng chấm công', () => {
    describe('Ca ĐÃ SỬA — một ngày lịch chỉ được trừ tối đa một công', () => {
        it('nghỉ không lương + absent_unexcused cùng ngày → trừ 1 công (trước đây trừ 2)', async () => {
            await resetDays();
            await addLeave('2026-07-15');
            await addAttendance('2026-07-15', 'absent_unexcused');

            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 1);
        });

        it('nghỉ không lương + half_day cùng ngày → trừ 0.5 công (trước đây trừ 1.5)', async () => {
            await resetDays();
            await addLeave('2026-07-20');
            await addAttendance('2026-07-20', 'half_day');

            // half_day nghĩa là tài xế CÓ đi làm nửa ngày — chấm công thắng đơn nghỉ
            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 0.5);
        });

        it('bảng lương CHỐT ra đúng số ngày công với màn ước tính', async () => {
            await resetDays();
            await addLeave('2026-07-15');
            await addAttendance('2026-07-15', 'absent_unexcused');

            await accountantPayrollRepository.calculateAndUpsertPayrolls(MONTH, YEAR);
            const { rows: [p] } = await pool.query(
                'SELECT absence_penalty FROM payrolls WHERE driver_id = $1', [DRIVER],
            );
            // absence_penalty = base − proRatedBase; proRatedBase = DAILY × 30 > base nên ÂM
            const expected = Math.round(BASE - Math.round(DAILY * (DAYS_IN_MONTH - 1)));
            assert.strictEqual(Math.round(Number(p.absence_penalty)), expected);
        });
    });

    describe('Ca KHÔNG ĐƯỢC ĐỔI — giữ nguyên hành vi cũ', () => {
        it('chỉ có đơn nghỉ không lương → trừ 1 công', async () => {
            await resetDays();
            await addLeave('2026-07-10');
            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 1);
        });

        it('chỉ có absent_unexcused → trừ 1 công', async () => {
            await resetDays();
            await addAttendance('2026-07-11', 'absent_unexcused');
            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 1);
        });

        it('chỉ có half_day → trừ 0.5 công', async () => {
            await resetDays();
            await addAttendance('2026-07-12', 'half_day');
            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 0.5);
        });

        it('đơn nghỉ + ghi đè "present" → KHÔNG trừ công', async () => {
            await resetDays();
            await addLeave('2026-07-13');
            await addAttendance('2026-07-13', 'present');
            assert.strictEqual(await workDays(), DAYS_IN_MONTH);
        });

        it('nghỉ CÓ LƯƠNG không trừ công', async () => {
            await resetDays();
            await addLeave('2026-07-14', 'paid');
            assert.strictEqual(await workDays(), DAYS_IN_MONTH);
        });

        it('không nghỉ ngày nào → đủ 31 công, vẫn được trả dư so với quota 28', async () => {
            await resetDays();
            assert.strictEqual(await workDays(), DAYS_IN_MONTH);

            const est = await payrollRepository.getPayrollEstimate(DRIVER, { month: MONTH, year: YEAR });
            assert.ok(Number(est.pro_rated_base) > BASE, 'cơ chế trả dư ngày công phải còn nguyên');
        });

        it('ngày lễ được miễn trừ dù có cả đơn nghỉ lẫn chấm vắng', async () => {
            await resetDays();
            await pool.query(`INSERT INTO company_holidays (holiday_date, name) VALUES ('2026-07-16', 'Ngay le test')`);
            await addLeave('2026-07-16');
            await addAttendance('2026-07-16', 'absent_unexcused');

            assert.strictEqual(await workDays(), DAYS_IN_MONTH);
            await pool.query(`DELETE FROM company_holidays WHERE holiday_date = '2026-07-16'`);
        });

        it('nhiều ngày rời nhau vẫn cộng dồn đúng', async () => {
            await resetDays();
            await addLeave('2026-07-05');                       // 1
            await addAttendance('2026-07-06', 'absent_unexcused'); // 1
            await addAttendance('2026-07-07', 'half_day');        // 0.5
            assert.strictEqual(await workDays(), DAYS_IN_MONTH - 2.5);
        });
    });

    describe('Chặn ở đầu vào — không tạo được dữ liệu mâu thuẫn nữa', () => {
        it('đã chấm vắng thì không đăng ký nghỉ chồng lên được', async () => {
            await resetDays();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            await addAttendance(today, 'absent_unexcused');

            await assert.rejects(
                () => leaveService.createLeave(DRIVER, { leaveDate: today, leaveType: 'unpaid', reason: 'xin nghi bu' }),
                /đã được chấm công/,
            );
        });

        it('ghi đè "present" thì VẪN đăng ký nghỉ được — hai thứ không mâu thuẫn', async () => {
            await resetDays();
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            await addAttendance(today, 'present');

            const leave = await leaveService.createLeave(DRIVER, {
                leaveDate: today, leaveType: 'unpaid', reason: 'xin nghi',
            });
            assert.strictEqual(leave.status, 'approved');
        });
    });
});
