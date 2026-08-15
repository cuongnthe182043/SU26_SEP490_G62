const { mock } = require('../helpers/nodeTestMock');
const assert = require('node:assert');

const kpiService = require('../../services/kpiService');

const accountantOrderService = require('../../services/accountantOrderService');

/**
 * Gộp việc tính lại KPI khi import hàng loạt.
 *
 * recalculateDriverKPI KHÔNG cộng dồn — mỗi lần gọi là quét lại toàn bộ chuyến hoàn
 * thành của tài xế trong cả tháng rồi ghi đè. Nên với cùng một (tài xế, tháng), gọi 1
 * lần hay 500 lần đều ra đúng con số ấy.
 *
 * Trước đây import 500 dòng chạy đúng 500 lượt quét NỐI TIẾP nhau, mỗi lượt lại nặng
 * thêm vì bảng vừa phình. Pool cắt query ở 15s, Cloud Run cắt request ở 300s — mẻ lớn
 * đụng trần trước khi cộng xong, và doanh thu không bao giờ tới bảng lương. Đó là lý
 * do "import ít thì được, import nhiều thì tài xế không thấy doanh thu".
 */
describe('accountantOrderService.flushKpiRecalc()', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    const thuThapLoiGoi = () => {
        const calls = [];
        mock.method(kpiService, 'recalculateAfterCompletion', async (driverId, at) => {
            calls.push([driverId, at.getFullYear(), at.getMonth() + 1]);
        });
        return calls;
    };

    it('500 dòng cùng một tài xế trong cùng tháng chỉ tính KPI đúng MỘT lần', async () => {
        const calls = thuThapLoiGoi();

        const triggers = Array.from({ length: 500 }, () => ({
            driverId: 7,
            completedAt: '2026-07-15T00:00:00.000Z',
        }));
        await accountantOrderService.flushKpiRecalc(triggers);

        assert.deepStrictEqual(calls, [[7, 2026, 7]]);
    });

    it('tách theo từng tài xế và từng tháng, không gộp nhầm', async () => {
        const calls = thuThapLoiGoi();

        await accountantOrderService.flushKpiRecalc([
            { driverId: 1, completedAt: '2026-07-02T00:00:00.000Z' },
            { driverId: 1, completedAt: '2026-07-28T00:00:00.000Z' },  // trùng tài+tháng
            { driverId: 1, completedAt: '2026-08-03T00:00:00.000Z' },  // khác tháng
            { driverId: 2, completedAt: '2026-07-09T00:00:00.000Z' },  // khác tài
        ]);

        assert.deepStrictEqual(
            calls.map((c) => c.join('/')).sort(),
            ['1/2026/7', '1/2026/8', '2/2026/7'],
        );
    });

    it('bỏ qua trigger không có driverId', async () => {
        const calls = thuThapLoiGoi();

        await accountantOrderService.flushKpiRecalc([
            { driverId: null, completedAt: '2026-07-02T00:00:00.000Z' },
            { driverId: undefined, completedAt: '2026-07-02T00:00:00.000Z' },
        ]);

        assert.deepStrictEqual(calls, []);
    });

    it('mẻ rỗng thì không gọi gì cả', async () => {
        const calls = thuThapLoiGoi();

        await accountantOrderService.flushKpiRecalc([]);
        await accountantOrderService.flushKpiRecalc();

        assert.deepStrictEqual(calls, []);
    });

    it('createOrder có collectKpiInto thì HOÃN lại, không tính ngay', async () => {
        const calls = thuThapLoiGoi();
        const accountantOrderRepository = require('../../repositories/accountantOrderRepository');
        const accountantLookupRepository = require('../../repositories/accountantLookupRepository');
        mock.method(accountantLookupRepository, 'invalidateLookupCache', () => {});
        mock.method(accountantOrderRepository, 'createOrderWithShipments', async () => ({
            id: 1,
            kpiTriggers: [{ driverId: 9, completedAt: '2026-07-15T00:00:00.000Z' }],
        }));

        const gom = [];
        await accountantOrderService.createOrder(
            { created_by: 1, suppress_notifications: true },
            { collectKpiInto: gom },
        );

        assert.deepStrictEqual(calls, [], 'chưa được tính lúc tạo đơn');
        assert.deepStrictEqual(gom, [{ driverId: 9, completedAt: '2026-07-15T00:00:00.000Z' }]);

        await accountantOrderService.flushKpiRecalc(gom);
        assert.deepStrictEqual(calls, [[9, 2026, 7]]);
    });
});
