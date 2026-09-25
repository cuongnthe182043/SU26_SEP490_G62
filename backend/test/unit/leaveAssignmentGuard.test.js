/**
 * L1 Unit Test — chốt chặn nghỉ phép trên MỌI đường ghi chủ chuyến
 *
 * Một hàm dùng chung leaveRepository.hasApprovedLeaveOn(driverId, date), so với NGÀY GIAO
 * của chuyến. Các đường được phủ: tài tự nhận (claimShipment), điều phối gán
 * (assignOrderShipmentsToDriver), điều chuyển/sự cố (reassignShipmentAfterIncident), tạo
 * đơn và sửa đơn có chọn BKS (orderService).
 *
 * Tầng repository chạy trên client giả trả kết quả theo mẫu câu SQL — đủ để chứng minh
 * guard nằm TRONG transaction, trước khi ghi lịch sử gán.
 */
jest.mock('../../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../config/logger', () => ({
    warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(),
}));
jest.mock('../../services/notificationGateway', () => ({
    broadcastToRole: jest.fn(), broadcastToUser: jest.fn(), notifyCreated: jest.fn(),
}));
jest.mock('../../services/roleNotificationService', () => ({
    notifyRoles: jest.fn().mockResolvedValue([]), notifyRolesSafe: jest.fn(),
}));
jest.mock('../../services/notificationService', () => ({
    createForUser: jest.fn().mockResolvedValue(undefined),
    createForUsers: jest.fn().mockResolvedValue([]),
    getUserIdsByRole: jest.fn().mockResolvedValue([]),
}));

// let: sau jest.resetModules() các module nạp một bản mock database MỚI — mỗi nhóm test
// phải lấy lại tham chiếu, cấu hình bản cũ là vô tác dụng.
let pool = require('../../config/database');

describe('leaveRepository.hasApprovedLeaveOn', () => {
    const leaveRepository = jest.requireActual('../../repositories/leaveRepository');

    beforeEach(() => jest.clearAllMocks());

    it('so với ngày giao đã truyền, kẹp về hôm nay nếu thiếu hoặc đã qua; chỉ đếm đơn approved', async () => {
        pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });

        await expect(leaveRepository.hasApprovedLeaveOn(7, '2099-01-02')).resolves.toBe(true);

        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/status = 'approved'/);
        expect(sql).toMatch(/GREATEST\(COALESCE\(\(\$2::timestamptz\)::date, CURRENT_DATE\), CURRENT_DATE\)/);
        expect(params).toEqual([7, '2099-01-02']);
    });

    it('không có ngày → truyền null (hôm nay), không nghỉ → false', async () => {
        pool.query.mockResolvedValue({ rows: [] });
        await expect(leaveRepository.hasApprovedLeaveOn(7)).resolves.toBe(false);
        expect(pool.query.mock.calls[0][1]).toEqual([7, null]);
    });

    it('chạy trên client của transaction khi được truyền vào', async () => {
        const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        await leaveRepository.hasApprovedLeaveOn(7, null, client);
        expect(client.query).toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();
    });
});

describe('tripRepository — guard nghỉ phép trong transaction', () => {
    let tripRepository;
    let leaveRepository;

    beforeAll(() => {
        jest.resetModules();
        jest.doMock('../../repositories/leaveRepository');
        pool = require('../../config/database');
        leaveRepository = require('../../repositories/leaveRepository');
        tripRepository = require('../../repositories/tripRepository');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(false);
    });

    const ARRIVED = new Date('2099-03-04T00:00:00+07:00');

    // Client giả: trả kết quả theo mẫu SQL; mặc định mọi guard khác đều "rảnh".
    const makeClient = (routes) => {
        const calls = [];
        const client = {
            calls,
            release: jest.fn(),
            query: jest.fn(async (sql, params) => {
                const s = String(sql);
                calls.push(s);
                for (const [re, result] of routes) {
                    if (re.test(s)) return typeof result === 'function' ? result(params) : result;
                }
                return { rows: [], rowCount: 0 };
            }),
        };
        pool.connect.mockResolvedValue(client);
        return client;
    };
    const wroteAssignment = (client) => client.calls.some((s) => /INSERT INTO shipment_assignment_history/.test(s));

    describe('claimShipment (tài tự nhận)', () => {
        const routes = () => [
            [/FROM vehicles v\s+JOIN drivers d/, { rows: [{ id: 3, status: 'active', assigned_driver_id: 5, driver_vehicle_id: 3, vehicle_group_id: 1 }] }],
            [/WHERE os\.id = \$1\s+FOR UPDATE OF os/, { rows: [{ id: 100, order_id: 9, status: 'available', vehicle_group_id: 1, arrived_at: ARRIVED, owner_driver_id: null }] }],
        ];

        it('nghỉ đúng ngày giao → ON_LEAVE, ROLLBACK, không nhận chuyến', async () => {
            leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);
            const client = makeClient(routes());

            await expect(tripRepository.claimShipment(100, 5, 3)).rejects.toThrow('ON_LEAVE');

            expect(leaveRepository.hasApprovedLeaveOn).toHaveBeenCalledWith(5, ARRIVED, client);
            expect(client.calls).toContain('ROLLBACK');
            expect(client.calls.some((s) => /UPDATE order_shipments/.test(s))).toBe(false);
            expect(wroteAssignment(client)).toBe(false);
        });
    });

    describe('assignOrderShipmentsToDriver (điều phối gán)', () => {
        const routes = () => [
            [/WHERE os\.order_id = \$1\s+ORDER BY os\.shipment_index ASC\s+FOR UPDATE OF os/, {
                rows: [
                    { id: 11, shipment_index: 1, status: 'available', arrived_at: new Date('2099-03-03T00:00:00+07:00'), owner_driver_id: null },
                    { id: 12, shipment_index: 2, status: 'available', arrived_at: ARRIVED, owner_driver_id: null },
                ],
            }],
        ];

        it('nghỉ vào ngày giao của MỘT chuyến trong lượt → chặn cả lượt, báo đúng chuyến', async () => {
            leaveRepository.hasApprovedLeaveOn.mockImplementation(async (_d, date) => date === ARRIVED);
            const client = makeClient(routes());

            await expect(tripRepository.assignOrderShipmentsToDriver({
                orderId: 9, shipmentIds: [11, 12], driverId: 5, vehicleId: 3, coordinatorId: 1,
            })).rejects.toMatchObject({ message: 'DRIVER_ON_LEAVE', shipmentIndex: 2 });

            expect(client.calls).toContain('ROLLBACK');
            expect(wroteAssignment(client)).toBe(false);
        });

        it('mỗi chuyến được kiểm theo ngày giao của chính nó', async () => {
            makeClient(routes());
            await tripRepository.assignOrderShipmentsToDriver({
                orderId: 9, shipmentIds: [11, 12], driverId: 5, vehicleId: 3, coordinatorId: 1,
            }).catch(() => {}); // các bước sau không được mock đủ — ở đây chỉ đo lời gọi guard
            const dates = leaveRepository.hasApprovedLeaveOn.mock.calls.map((c) => c[1]);
            expect(dates).toEqual([new Date('2099-03-03T00:00:00+07:00'), ARRIVED]);
        });
    });

    describe('reassignShipmentAfterIncident (điều chuyển / sự cố)', () => {
        const routes = () => [
            [/FOR UPDATE OF os/, { rows: [{ id: 50, order_id: 7, status: 'transit', owner_driver_id: 1, vehicle_id: 10, arrived_at: ARRIVED }] }],
            [/FROM vehicles WHERE id/, { rows: [{ id: 31, plate_number: '29C-111.11', status: 'active' }] }],
        ];
        const run = () => tripRepository.reassignShipmentAfterIncident(50, {
            incidentId: null, fromDriverId: 1, toDriverId: 2, toVehicleId: 31, changedBy: 99,
        });

        it('kiểm cả hôm nay (null) lẫn ngày giao — chuyến đang chạy phải cầm lái ngay', async () => {
            makeClient(routes());
            await run();
            const dates = leaveRepository.hasApprovedLeaveOn.mock.calls.map((c) => [c[0], c[1]]);
            expect(dates).toEqual([[2, null], [2, ARRIVED]]);
        });

        it('nghỉ hôm nay → 409, không ghi lịch sử gán', async () => {
            leaveRepository.hasApprovedLeaveOn.mockImplementation(async (_d, date) => date === null);
            const client = makeClient(routes());
            await expect(run()).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('có đơn nghỉ') });
            expect(wroteAssignment(client)).toBe(false);
            expect(client.calls).toContain('ROLLBACK');
        });

        it('chỉ nghỉ đúng ngày giao → vẫn chặn 409', async () => {
            leaveRepository.hasApprovedLeaveOn.mockImplementation(async (_d, date) => date === ARRIVED);
            makeClient(routes());
            await expect(run()).rejects.toMatchObject({ statusCode: 409 });
        });
    });
});

describe('coordinatorService.assignOrderShipments — báo lỗi nghỉ phép', () => {
    let coordinatorService;
    let tripRepository;
    let driverRepository;

    beforeAll(() => {
        jest.resetModules();
        jest.doMock('../../repositories/driverRepository');
        jest.doMock('../../repositories/tripRepository');
        coordinatorService = require('../../services/coordinatorService');
        tripRepository = require('../../repositories/tripRepository');
        driverRepository = require('../../repositories/driverRepository');
    });

    it('DRIVER_ON_LEAVE → câu báo có tên tài và số thứ tự chuyến', async () => {
        driverRepository.getDriverForAssignment.mockResolvedValue({ id: 5, full_name: 'Tài A', default_vehicle_id: 3 });
        tripRepository.getPendingReceiptOrder.mockResolvedValue(null);
        tripRepository.assignOrderShipmentsToDriver.mockRejectedValue(
            Object.assign(new Error('DRIVER_ON_LEAVE'), { shipmentIndex: 2 }),
        );

        await expect(coordinatorService.assignOrderShipments(9, { shipmentIds: [11, 12], driverId: 5 }, 1))
            .rejects.toThrow('Tài xế Tài A có đơn nghỉ vào ngày giao của chuyến 2 — không thể gán chuyến');
    });
});

describe('orderService — tạo/sửa đơn có chọn BKS', () => {
    let orderService;
    let orderRepository;
    let leaveRepository;
    let client;

    beforeAll(() => {
        jest.resetModules();
        jest.doMock('../../repositories/orderRepository');
        jest.doMock('../../repositories/leaveRepository');
        pool = require('../../config/database');
        orderService = require('../../services/orderService');
        orderRepository = require('../../repositories/orderRepository');
        leaveRepository = require('../../repositories/leaveRepository');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }), release: jest.fn() };
        pool.connect.mockResolvedValue(client);
        orderRepository.getDefaultVehicleGroupId.mockResolvedValue(1);
        orderRepository.getVehicleGroupById.mockResolvedValue({ id: 1, price_per_km: 10000 });
        orderRepository.getVehicleByPlate.mockResolvedValue({
            id: 3, plate_number: '29A-123.45', vehicle_group_id: 1, assigned_driver_id: 7, vehicle_status: 'active',
        });
        orderRepository.validateVehicleShipmentAssignment.mockResolvedValue(undefined);
    });

    const trips = [{ plate: '29A-123.45', vehicle_group_id: 1, distance: 10 }];

    it('createOrder: tài của xe nghỉ đúng ngày giao → chặn, không tạo đơn', async () => {
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);

        await expect(orderService.createOrder(1, {
            date: '2099-05-06', pickup_address: 'A', delivery_address: 'B',
            customer_name: 'Khách', customer_phone: '0912345678', trips,
        })).rejects.toThrow('Tài xế của xe 29A-123.45 có đơn nghỉ vào ngày giao hàng 06/05/2099');

        expect(leaveRepository.hasApprovedLeaveOn).toHaveBeenCalledWith(7, '2099-05-06', client);
        expect(orderRepository.createOrderWithMultipleShipments).not.toHaveBeenCalled();
    });

    const existing = (over = {}) => ({
        id: 5, status: 'claimed', vehicle_group_id: 1, owner_driver_id: 7, vehicle_id: 3,
        plate_number: '29A-123.45', arrived_date: '2099-05-06', ...over,
    });

    it('updateOrder: giữ tài, DỜI ngày giao vào ngày tài nghỉ → chặn', async () => {
        orderRepository.getExistingShipmentIds.mockResolvedValue([existing()]);
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);

        await expect(orderService.updateOrder(900, { date: '2099-05-08', trips }))
            .rejects.toThrow('có đơn nghỉ vào ngày giao hàng 08/05/2099');
        expect(leaveRepository.hasApprovedLeaveOn).toHaveBeenCalledWith(7, '2099-05-08', client);
    });

    it('updateOrder: giữ nguyên tài lẫn ngày (vd. chỉ sửa ghi chú) → không kiểm nghỉ phép', async () => {
        orderRepository.getExistingShipmentIds.mockResolvedValue([existing()]);
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);

        // Các bước sau vòng lặp không được mock đủ — chỉ đo là guard không bị gọi.
        await orderService.updateOrder(900, { date: '2099-05-06', trips }).catch(() => {});
        expect(leaveRepository.hasApprovedLeaveOn).not.toHaveBeenCalled();
    });

    it('updateOrder: đổi sang xe của tài khác → kiểm theo ngày giao cũ khi không gửi ngày mới', async () => {
        orderRepository.getExistingShipmentIds.mockResolvedValue([existing({ owner_driver_id: 8, vehicle_id: 4 })]);
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);

        await expect(orderService.updateOrder(900, { trips })).rejects.toThrow('06/05/2099');
        expect(leaveRepository.hasApprovedLeaveOn).toHaveBeenCalledWith(7, '2099-05-06', client);
    });

    it('updateOrder: chuyến đã hoàn thành → không kiểm dù đổi ngày', async () => {
        orderRepository.getExistingShipmentIds.mockResolvedValue([existing({ status: 'completed' })]);
        leaveRepository.hasApprovedLeaveOn.mockResolvedValue(true);

        await orderService.updateOrder(900, { date: '2099-05-08', trips }).catch(() => {});
        expect(leaveRepository.hasApprovedLeaveOn).not.toHaveBeenCalled();
    });
});
