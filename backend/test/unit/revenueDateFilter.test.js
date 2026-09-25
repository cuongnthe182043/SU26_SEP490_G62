/**
 * L1 Unit Test — lọc ngày ở màn Doanh thu (accountantOrderRepository.getAllOrders)
 *
 * Khoảng ngày lọc theo NGÀY HOÀN THÀNH của đơn (chuyến cuối chạy xong), không phải ngày
 * tạo đơn — đơn import lùi phải rơi vào đúng kỳ chạy. Xuất Excel dùng lại getAllOrders
 * nên cùng được phủ.
 */
jest.mock('../../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../config/logger', () => ({
    warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
}));

const pool = require('../../config/database');
const accountantOrderRepository = require('../../repositories/accountantOrderRepository');

const HOAN_THANH = 'COALESCE(ship_agg.completed_at, o.created_at)';

beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockImplementation(async (sql) => (
        /COUNT\(DISTINCT o\.id\)/.test(sql) ? { rows: [{ count: '0' }] } : { rows: [] }
    ));
});

const whereOf = (sql) => sql.slice(sql.lastIndexOf('WHERE o.derived_status'));

it('dateFrom/dateTo lọc theo ngày hoàn thành, đủ cả ngày cuối, không còn theo ngày tạo', async () => {
    await accountantOrderRepository.getAllOrders({ dateFrom: '2026-08-01', dateTo: '2026-08-31' }, 1, 20);

    for (const [sql, params] of pool.query.mock.calls) {
        const where = whereOf(sql);
        expect(where).toContain(`${HOAN_THANH} >= $1::date`);
        expect(where).toContain(`${HOAN_THANH} < ($2::date + INTERVAL '1 day')`);
        expect(where).not.toMatch(/o\.created_at (>=|<) \$/);
        expect(params.slice(0, 2)).toEqual(['2026-08-01', '2026-08-31']);
    }
});

it('không chọn ngày thì không thêm điều kiện ngày', async () => {
    await accountantOrderRepository.getAllOrders({}, 1, 20);
    const [sql] = pool.query.mock.calls[0];
    expect(whereOf(sql)).not.toContain(HOAN_THANH);
});

it.each([
    ['newest', `ORDER BY ${HOAN_THANH} DESC, o.id DESC`],
    ['oldest', `ORDER BY ${HOAN_THANH} ASC, o.id ASC`],
    [undefined, `ORDER BY ${HOAN_THANH} DESC, o.id DESC`],
])('sắp xếp %s theo ngày hoàn thành, khoá phụ o.id để phân trang ổn định', async (sort, expected) => {
    await accountantOrderRepository.getAllOrders({ sort }, 1, 20);
    const selectSql = pool.query.mock.calls.map((c) => c[0]).find((s) => /ORDER BY/.test(s));
    expect(selectSql.replace(/\s+/g, ' ')).toContain(expected);
});
