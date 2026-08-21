/**
 * assignOrderShipments — gán tài xế + xe cho chuyến SAU KHI đơn đã tạo.
 *
 * Vì sao có file này: luồng gán vừa đổi hai luật nghiệp vụ lớn và cả hai đều không thể
 * nhìn ra từ chữ ký hàm:
 *
 *   1. XE TÁCH KHỎI TÀI. vehicleId là xe chạy chuyến này, không bắt buộc là xe biên chế
 *      (drivers.vehicle_id). Bỏ trống thì mới lấy xe biên chế. Chọn sai thứ tự ưu tiên ở
 *      đây nghĩa là điều phối chọn xe A mà hệ thống ghi xe B — sai lịch sử điều xe, sai
 *      cả chỗ chấm công/nhiên liệu sau này.
 *   2. NHÓM XE KHÔNG CÒN CHẶN. Trước đây tài chỉ nhận được chuyến cùng nhóm xe; giờ gán
 *      chéo nhóm là hợp lệ, đổi lại cước phải bám os.vehicle_group_id.
 *
 * Test ở đây chốt phần LOGIC ĐIỀU PHỐI thuần JS của tầng service: chọn xe nào, chặn khi
 * nào, và dịch mã lỗi của tầng repository ra câu tiếng Việt nào. Phần cần khoá DB (guard
 * giao dịch, thứ tự ưu tiên đơn giá trong SQL) nằm ở test integration.
 */
const assert = require('node:assert');

const tripRepository = require('../../repositories/tripRepository');
const driverRepository = require('../../repositories/driverRepository');
const notificationService = require('../../services/notificationService');
const notificationGateway = require('../../services/notificationGateway');
const coordinatorService = require('../../services/coordinatorService');

const DRIVER_CO_XE = {
    id: 4, full_name: 'Tai A',
    default_vehicle_id: 11, default_vehicle_group_id: 1, default_plate_number: '51E-100.01',
};
const DRIVER_KHONG_XE = {
    id: 7, full_name: 'Tai D',
    default_vehicle_id: null, default_vehicle_group_id: null, default_plate_number: null,
};

/** Ghi lại tham số mà tầng service truyền xuống repository. */
let capturedAssign;

const mockRepositories = ({ driver = DRIVER_CO_XE, pendingReceipt = null, assignError = null } = {}) => {
    capturedAssign = null;

    jest.spyOn(driverRepository, 'getDriverForAssignment').mockResolvedValue(driver);
    jest.spyOn(tripRepository, 'getPendingReceiptOrder').mockResolvedValue(pendingReceipt);
    jest.spyOn(tripRepository, 'assignOrderShipmentsToDriver').mockImplementation(async (args) => {
        capturedAssign = args;
        if (assignError) throw assignError;
        return { assignedShipmentIds: args.shipmentIds, activatedShipmentId: args.shipmentIds[0] };
    });

    // Báo tin không phải thứ đang kiểm ở đây, nhưng service await chúng nên phải câm lại.
    jest.spyOn(notificationService, 'createForUser').mockResolvedValue(undefined);
    jest.spyOn(notificationGateway, 'broadcastToUser').mockImplementation(() => {});
};

const goiGan = (payload) => coordinatorService.assignOrderShipments(100, payload, 2);

afterEach(() => jest.restoreAllMocks());

describe('assignOrderShipments — chọn xe', () => {
    it('KHÔNG truyền vehicle_id: dùng xe biên chế của tài (giữ nguyên thói quen cũ)', async () => {
        mockRepositories();

        await goiGan({ shipmentIds: [501], driverId: 4 });

        assert.strictEqual(capturedAssign.vehicleId, 11, 'phải rơi về drivers.vehicle_id');
        assert.strictEqual(capturedAssign.driverId, 4);
    });

    it('CÓ truyền vehicle_id: dùng đúng xe đó, KHÔNG rơi về xe biên chế', async () => {
        mockRepositories();

        // 99 là xe khác hẳn xe biên chế 11 — và có thể thuộc nhóm xe khác, vẫn hợp lệ.
        await goiGan({ shipmentIds: [501], driverId: 4, vehicleId: 99 });

        assert.strictEqual(capturedAssign.vehicleId, 99,
            'xe điều phối chỉ định phải thắng xe biên chế — đây chính là việc tách xe khỏi tài');
    });

    it('tài KHÔNG có xe biên chế mà điều phối cũng không chọn xe: báo lỗi rõ ràng', async () => {
        mockRepositories({ driver: DRIVER_KHONG_XE });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 7 }),
            /vui lòng chọn xe/i,
            'không được để guard tầng DB ném VEHICLE_NOT_FOUND khó hiểu',
        );
    });

    it('tài KHÔNG có xe biên chế nhưng điều phối chọn xe: gán được bình thường', async () => {
        mockRepositories({ driver: DRIVER_KHONG_XE });

        await goiGan({ shipmentIds: [501], driverId: 7, vehicleId: 99 });

        assert.strictEqual(capturedAssign.vehicleId, 99);
    });

    it('vehicle_id rác (chuỗi rỗng / số âm) không được lặng lẽ thành xe biên chế', async () => {
        mockRepositories();
        // Chuỗi rỗng = "ô chọn xe để trống" → coi như không chọn, rơi về xe biên chế.
        await goiGan({ shipmentIds: [501], driverId: 4, vehicleId: '' });
        assert.strictEqual(capturedAssign.vehicleId, 11);

        // Còn số âm là dữ liệu hỏng thật — phải chặn, không được đoán.
        mockRepositories();
        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4, vehicleId: -3 }),
            /không hợp lệ/i,
        );
    });
});

describe('assignOrderShipments — điều kiện sẵn sàng', () => {
    it('tài khoản tài xế đã khóa: không gán được', async () => {
        mockRepositories({ driver: null });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4 }),
            /không tồn tại hoặc tài khoản đã bị khóa/i,
        );
    });

    it('tài còn nợ phiếu thu chuyến trước: chặn, không cho nhận việc mới', async () => {
        mockRepositories({ pendingReceipt: { shipment_id: 400, order_id: 90 } });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4 }),
            /chưa nhập km thực tế/i,
        );
    });

    it('xe không sẵn sàng: dịch mã lỗi kèm biển số và trạng thái thật của xe', async () => {
        const err = new Error('VEHICLE_UNAVAILABLE');
        err.plateNumber = '51E-100.09';
        err.vehicleStatus = 'broken';
        mockRepositories({ assignError: err });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4, vehicleId: 99 }),
            (e) => e.message.includes('51E-100.09') && e.message.includes('broken'),
        );
    });

    it('xe đang bảo trì: dịch mã lỗi kèm biển số', async () => {
        const err = new Error('VEHICLE_MAINTENANCE');
        err.plateNumber = '51E-100.09';
        mockRepositories({ assignError: err });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4, vehicleId: 99 }),
            /51E-100\.09 đang trong bảo trì/i,
        );
    });

    it('tài đang phụ trách bảo trì xe khác: chặn', async () => {
        mockRepositories({ assignError: new Error('DRIVER_MAINTENANCE') });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4 }),
            /phụ trách bảo trì/i,
        );
    });

    it('xe đang vướng chuyến của đơn khác: nói rõ đơn nào', async () => {
        const err = new Error('VEHICLE_BUSY_OTHER_ORDER');
        err.conflictingOrderId = 777;
        err.plateNumber = '51E-100.09';
        mockRepositories({ assignError: err });

        await assert.rejects(
            () => goiGan({ shipmentIds: [501], driverId: 4, vehicleId: 99 }),
            (e) => e.message.includes('777') && e.message.includes('51E-100.09'),
        );
    });

    it('KHÔNG còn lỗi "khác nhóm xe": gán chéo nhóm là hợp lệ', async () => {
        mockRepositories();

        await goiGan({ shipmentIds: [501, 502], driverId: 4, vehicleId: 99 });

        // Không ném lỗi, và lệnh gán vẫn xuống tới tầng DB với đủ chuyến.
        assert.deepStrictEqual(capturedAssign.shipmentIds, [501, 502]);
    });
});

describe('assignOrderShipments — kiểm tra đầu vào', () => {
    it('không chọn chuyến nào: chặn trước khi chạm DB', async () => {
        mockRepositories();

        await assert.rejects(() => goiGan({ shipmentIds: [], driverId: 4 }), /ít nhất 1 chuyến/i);
        assert.strictEqual(capturedAssign, null, 'không được gọi xuống repository khi đầu vào đã sai');
    });

    it('chuyến trùng id: khử trùng trước khi gửi xuống', async () => {
        mockRepositories();

        await goiGan({ shipmentIds: [501, 501, 502], driverId: 4 });

        assert.deepStrictEqual(capturedAssign.shipmentIds, [501, 502]);
    });
});
