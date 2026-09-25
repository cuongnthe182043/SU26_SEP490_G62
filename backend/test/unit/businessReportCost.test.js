/**
 * L1 Unit Test — chi phí vận hành trong Báo cáo kinh doanh (managerReportRepository)
 *
 * Hai lỗi đã có:
 *   1. Phiếu hoàn ứng tài xế (driver_reimbursement) bị cộng vào "chi phí văn phòng" của
 *      tháng chi hoàn — trong khi bản thân khoản chi đã nằm trong "chi phí xe" theo ngày
 *      chi. Một hoá đơn đếm hai lần, lần hai rơi sang kỳ sau.
 *   2. "Chi phí xe" loại chi phí THEO LOẠI (chỉ lấy fuel/repair/...), nên cầu đường của
 *      chuyến huỷ/giao thất bại — khoản doanh nghiệp chịu — biến mất khỏi báo cáo.
 */
jest.mock('../../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../config/logger', () => ({
    warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
}));

const pool = require('../../config/database');
const repo = require('../../repositories/managerReportRepository');

const flat = (s) => String(s).replace(/\s+/g, ' ');

beforeEach(() => {
    jest.clearAllMocks();
    // Mọi query trả một dòng số 0 là đủ để getBusinessReport chạy hết
    pool.query.mockResolvedValue({ rows: [{ amount: 0, cost: 0, driver_count: 0, revenue: 0 }] });
});

const costQueries = async () => {
    await repo.getBusinessReport({ year: 2026, month: 9 });
    const sqls = pool.query.mock.calls.map(([sql, params]) => ({ sql: flat(sql), params }));
    return {
        vehicle: sqls.find((q) => /FROM expenses e LEFT JOIN order_shipments os/.test(q.sql)),
        office: sqls.find((q) => /FROM payment_vouchers/.test(q.sql)),
    };
};

it('phiếu hoàn ứng tài xế KHÔNG tính vào chi phí văn phòng (tránh đếm hai lần, lệch kỳ)', async () => {
    const { office } = await costQueries();
    expect(office.sql).toMatch(/voucher_type NOT IN \('prepaid_refund', 'collect_on_behalf_return', 'driver_reimbursement'\)/);
});

it('chi phí xe loại chi hộ khách theo quy tắc chung, không theo danh sách loại cố định', async () => {
    const { vehicle } = await costQueries();
    expect(vehicle.sql).toContain(
        "NOT COALESCE(e.expense_type IN ('toll','parking','etc') AND os.status NOT IN ('cancelled','failed'), FALSE)",
    );
    // Không còn lọc cứng theo loại — cầu đường của chuyến huỷ phải lọt vào được
    expect(vehicle.sql).not.toMatch(/expense_type IN \('fuel','repair'/);
});

it('chi phí xe và phiếu chi vẫn lọc đúng tháng của kỳ', async () => {
    const { vehicle, office } = await costQueries();
    expect(vehicle.params).toEqual([2026, 9]);
    expect(vehicle.sql).toMatch(/e\.expense_date >= make_date\(\$1, \$2, 1\)/);
    expect(vehicle.sql).toMatch(/e\.expense_date < \(make_date\(\$1, \$2, 1\) \+ INTERVAL '1 month'\)/);
    expect(office.params).toEqual([2026, 9]);
});
