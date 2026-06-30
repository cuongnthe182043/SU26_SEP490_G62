const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const kpiService = require('../../services/kpiService');
const kpiRepository = require('../../repositories/kpiRepository');

describe('L1: KPI Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: getMyKPI()', () => {
        it('L1-KPI-01: BC-TRUE - Fails if month is invalid', async () => {
            await assert.rejects(
                () => kpiService.getMyKPI(1, { month: 13, year: 2024 }),
                { message: 'Tháng không hợp lệ (1-12)' }
            );
        });

        it('L1-KPI-02: BC-TRUE - Fails if year is invalid', async () => {
            await assert.rejects(
                () => kpiService.getMyKPI(1, { month: 10, year: 2019 }),
                { message: 'Năm không hợp lệ (tối thiểu 2020)' }
            );
        });

        it('L1-KPI-03: EP-Valid - Returns KPI data', async () => {
            mock.method(kpiRepository, 'getDriverKPI', async () => ({ completed_shipments: 10 }));
            const res = await kpiService.getMyKPI(1, { month: 10, year: 2024 });
            assert.strictEqual(res.completed_shipments, 10);
        });
    });

    describe('Block: getLeaderboard()', () => {
        it('L1-KPI-04: BC-TRUE - Fails if driver has no vehicle group', async () => {
            mock.method(kpiRepository, 'getDriverVehicleGroupId', async () => null);
            await assert.rejects(
                () => kpiService.getLeaderboard(1),
                { message: 'Driver chưa được gán xe — không thể xem bảng xếp hạng' }
            );
        });

        it('L1-KPI-05: EP-Valid - Returns leaderboard and group info', async () => {
            mock.method(kpiRepository, 'getDriverVehicleGroupId', async () => ({ vehicle_group_id: 5, vehicle_group_name: 'Truck 5T' }));
            mock.method(kpiRepository, 'getLeaderboard', async () => [{ driver_id: 1, total_in_group: 20 }]);
            
            const res = await kpiService.getLeaderboard(1, { month: 10, year: 2024 });
            assert.strictEqual(res.vehicle_group_name, 'Truck 5T');
            assert.strictEqual(res.total_in_group, 20);
            assert.strictEqual(res.leaderboard.length, 1);
        });
    });

    describe('Block: getAllDriversKPI()', () => {
        it('L1-KPI-06: EP-Valid - Calls repo with default current month/year', async () => {
            mock.method(kpiRepository, 'getAllDriversKPI', async () => []);
            await kpiService.getAllDriversKPI();
            const args = kpiRepository.getAllDriversKPI.mock.calls[0].arguments[0];
            assert.ok(args.month >= 1 && args.month <= 12);
            assert.ok(args.year >= 2024);
        });
    });

    describe('Block: getDriverKPIById()', () => {
        it('L1-KPI-07: BC-TRUE - Fails if driverId is missing', async () => {
            await assert.rejects(
                () => kpiService.getDriverKPIById(null),
                { message: 'Driver ID là bắt buộc' }
            );
        });

        it('L1-KPI-08: EP-Valid - Returns driver KPI', async () => {
            mock.method(kpiRepository, 'getDriverKPIById', async () => ({ total_revenue: 5000 }));
            const res = await kpiService.getDriverKPIById(2, { month: 10, year: 2024 });
            assert.strictEqual(res.total_revenue, 5000);
        });
    });

    describe('Block: recalculateAfterCompletion()', () => {
        it('L1-KPI-09: EP-Valid - Fire and forget recalculation', async () => {
            let called = false;
            mock.method(kpiRepository, 'recalculateDriverKPI', async () => { called = true; });
            // Cannot await because it's fire-and-forget
            kpiService.recalculateAfterCompletion(1, new Date('2024-10-15T00:00:00Z'));
            // Yield event loop
            await new Promise(setImmediate);
            assert.strictEqual(called, true);
        });
    });
});
