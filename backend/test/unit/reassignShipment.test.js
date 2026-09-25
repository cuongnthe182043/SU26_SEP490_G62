/**
 * L1 Unit Test — điều chuyển chuyến (reassign)
 *
 * Hai tầng:
 *   - coordinatorService.reassignShipment: chọn xe (chỉ định > xe biên chế), chặn tài còn
 *     nợ phiếu thu — cùng quy ước với assignOrderShipments.
 *   - tripRepository.reassignShipmentAfterIncident: bộ guard xe/tài, chạy trên client giả
 *     trả kết quả theo từng câu SQL.
 */
jest.mock('../../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../config/logger', () => ({
    warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../repositories/orderRepository');
jest.mock('../../repositories/expenseRepository');
jest.mock('../../repositories/incidentRepository');
jest.mock('../../repositories/coordinatorRepository');
jest.mock('../../repositories/financialLedgerRepository');
jest.mock('../../repositories/leaveRepository');
jest.mock('../../repositories/driverRepository');
jest.mock('../../services/notificationService', () => ({ createForUser: jest.fn().mockResolvedValue(null) }));
jest.mock('../../services/notificationGateway', () => ({
    broadcastToRole: jest.fn(), broadcastToUser: jest.fn(), notifyCreated: jest.fn(),
}));

const pool = require('../../config/database');
const driverRepository = require('../../repositories/driverRepository');
const tripRepository = require('../../repositories/tripRepository');
const coordinatorService = require('../../services/coordinatorService');

describe('coordinatorService.reassignShipment — chọn xe', () => {
    const SHIPMENT = { id: 50, order_id: 7, owner_driver_id: 1, pickup_completed_at: null };

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(tripRepository, 'getTripById').mockResolvedValue(SHIPMENT);
        jest.spyOn(tripRepository, 'getPendingReceiptOrder').mockResolvedValue(null);
        jest.spyOn(tripRepository, 'reassignShipmentAfterIncident').mockResolvedValue(SHIPMENT);
        driverRepository.getAllDrivers.mockResolvedValue([
            { id: 2, full_name: 'Tài B', vehicle_id: 20, on_leave_today: false },
            { id: 3, full_name: 'Tài C', vehicle_id: null, on_leave_today: false },
        ]);
    });

    // Spy trên tripRepository thật — phải gỡ, nếu không nhóm test repository bên dưới sẽ
    // gọi trúng bản giả của reassignShipmentAfterIncident.
    afterEach(() => jest.restoreAllMocks());

    it('bỏ trống xe → dùng xe biên chế của tài thay thế', async () => {
        await coordinatorService.reassignShipment(50, { toDriverId: 2 }, 99);
        expect(tripRepository.reassignShipmentAfterIncident).toHaveBeenCalledWith(
            50, expect.objectContaining({ fromDriverId: 1, toDriverId: 2, toVehicleId: 20 }),
        );
    });

    it('chọn xe → dùng đúng xe đó, kể cả khác xe biên chế', async () => {
        await coordinatorService.reassignShipment(50, { toDriverId: 2, toVehicleId: '31' }, 99);
        expect(tripRepository.reassignShipmentAfterIncident).toHaveBeenCalledWith(
            50, expect.objectContaining({ toDriverId: 2, toVehicleId: 31 }),
        );
    });

    it('tài chưa có xe biên chế nhưng điều phối chọn xe → điều chuyển được', async () => {
        await coordinatorService.reassignShipment(50, { toDriverId: 3, toVehicleId: 31 }, 99);
        expect(tripRepository.reassignShipmentAfterIncident).toHaveBeenCalledWith(
            50, expect.objectContaining({ toDriverId: 3, toVehicleId: 31 }),
        );
    });

    it('tài chưa có xe biên chế và không chọn xe → báo rõ phải chọn xe', async () => {
        await expect(coordinatorService.reassignShipment(50, { toDriverId: 3 }, 99))
            .rejects.toThrow(/chưa có xe biên chế — vui lòng chọn xe/);
        expect(tripRepository.reassignShipmentAfterIncident).not.toHaveBeenCalled();
    });

    it('mã xe không hợp lệ bị từ chối', async () => {
        await expect(coordinatorService.reassignShipment(50, { toDriverId: 2, toVehicleId: 'abc' }, 99))
            .rejects.toThrow('Xe được chọn không hợp lệ');
    });

    it('tài thay thế còn nợ phiếu thu chuyến trước → 409, không điều chuyển', async () => {
        tripRepository.getPendingReceiptOrder.mockResolvedValue({ shipment_id: 41, order_id: 5 });
        await expect(coordinatorService.reassignShipment(50, { toDriverId: 2 }, 99))
            .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('chuyến #41') });
        expect(tripRepository.reassignShipmentAfterIncident).not.toHaveBeenCalled();
    });
});

describe('tripRepository.reassignShipmentAfterIncident — guard xe/tài', () => {
    // Client giả: mỗi câu SQL trả kết quả theo mẫu nhận diện. Mặc định mọi guard đều "rảnh".
    const makeClient = (overrides = {}) => {
        const calls = [];
        const client = {
            calls,
            release: jest.fn(),
            query: jest.fn(async (sql, params) => {
                const s = String(sql);
                calls.push({ sql: s, params });
                if (/pg_advisory_xact_lock/.test(s)) return { rows: [] };
                if (/FOR UPDATE OF os/.test(s)) {
                    return { rows: [overrides.shipment ?? { id: 50, order_id: 7, status: 'claimed', owner_driver_id: 1, vehicle_id: 10 }] };
                }
                if (/FROM vehicles WHERE id/.test(s)) {
                    return { rows: overrides.vehicle === null ? [] : [overrides.vehicle ?? { id: 31, plate_number: '29C-111.11', status: 'active' }] };
                }
                if (/sc\.vehicle_id = \$1/.test(s)) return { rows: overrides.vehicleBusy ? [overrides.vehicleBusy] : [] };
                if (/sc\.owner_driver_id = \$1/.test(s)) return { rows: overrides.driverBusy ? [overrides.driverBusy] : [] };
                if (/maintenance_records/.test(s) && /WHERE vehicle_id = \$1/.test(s)) return { rows: overrides.vehicleMaint ? [{ id: 1 }] : [] };
                if (/maintenance_records/.test(s)) return { rows: [] };
                return { rows: [{ id: 1 }], rowCount: 1 };
            }),
        };
        return client;
    };

    const run = (client, extra = {}) => tripRepository.reassignShipmentAfterIncident(50, {
        incidentId: null, fromDriverId: 1, toDriverId: 2, toVehicleId: 31, changedBy: 99,
        changeReason: 'manual_reassign', ...extra,
    });

    it('xe không phải xe biên chế của tài vẫn điều chuyển được, ghi lịch sử gán', async () => {
        const client = makeClient();
        pool.connect.mockResolvedValue(client);
        await run(client);
        expect(client.calls.some((c) => /INSERT INTO shipment_assignment_history|assignment_history/i.test(c.sql))).toBe(true);
        expect(client.calls.some((c) => c.sql === 'COMMIT')).toBe(true);
        // Không còn JOIN drivers để ép xe biên chế
        expect(client.calls.some((c) => /JOIN drivers d ON d\.profile_id = \$2 AND d\.vehicle_id = v\.id/.test(c.sql))).toBe(false);
    });

    it('khoá advisory tài + xe TRƯỚC khi khoá dòng chuyến (cùng thứ tự với luồng gán)', async () => {
        const client = makeClient();
        pool.connect.mockResolvedValue(client);
        await run(client);
        const idxLock = client.calls.findIndex((c) => /pg_advisory_xact_lock/.test(c.sql));
        const idxRow = client.calls.findIndex((c) => /FOR UPDATE OF os/.test(c.sql));
        expect(idxLock).toBeGreaterThan(-1);
        expect(idxLock).toBeLessThan(idxRow);
    });

    it('xe đang vướng chuyến đơn khác → 409, kèm mã chuyến/đơn, ROLLBACK', async () => {
        const client = makeClient({ vehicleBusy: { id: 88, order_id: 9 } });
        pool.connect.mockResolvedValue(client);
        await expect(run(client)).rejects.toMatchObject({
            statusCode: 409, message: expect.stringContaining('chuyến #88 (đơn #9)'),
        });
        expect(client.calls.some((c) => c.sql === 'ROLLBACK')).toBe(true);
    });

    it('guard bận xét cả chuyến failed và chuyến gán trước ở ĐƠN KHÁC', async () => {
        const client = makeClient();
        pool.connect.mockResolvedValue(client);
        await run(client);
        const busyQueries = client.calls.filter((c) => /sc\.(vehicle_id|owner_driver_id) = \$1/.test(c.sql));
        expect(busyQueries).toHaveLength(2);
        for (const q of busyQueries) {
            expect(q.params[1]).toContain('failed');
            expect(q.sql).toMatch(/os\.status = 'available' AND os\.order_id <> \$4/);
            expect(q.params[3]).toBe(7);
        }
    });

    it('tài thay thế vướng chuyến khác → 409', async () => {
        const client = makeClient({ driverBusy: { id: 77, order_id: 3 } });
        pool.connect.mockResolvedValue(client);
        await expect(run(client)).rejects.toMatchObject({
            statusCode: 409, message: expect.stringContaining('chuyến #77 (đơn #3)'),
        });
    });

    it('xe không active hoặc đang bảo trì → 409', async () => {
        let client = makeClient({ vehicle: { id: 31, plate_number: '29C-111.11', status: 'inactive' } });
        pool.connect.mockResolvedValue(client);
        await expect(run(client)).rejects.toMatchObject({ statusCode: 409 });

        client = makeClient({ vehicleMaint: true });
        pool.connect.mockResolvedValue(client);
        await expect(run(client)).rejects.toThrow(/đang trong bảo trì/);
    });

    it('xe không tồn tại → báo lỗi', async () => {
        const client = makeClient({ vehicle: null });
        pool.connect.mockResolvedValue(client);
        await expect(run(client)).rejects.toThrow('Xe thay thế không tồn tại');
    });
});
