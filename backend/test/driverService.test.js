const { mock } = require('./helpers/nodeTestMock');
const assert = require('node:assert');

const vehicleManagementRepository = require('../repositories/vehicleManagementRepository');
const notificationService = require('../services/notificationService');
const notificationGateway = require('../services/notificationGateway');
const expenseAiValidator = require('../services/expenseAiValidator');
const driverService = require('../services/driverService');

describe('Driver Service', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('should require maintenance cost when driver completes maintenance', async () => {
        mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({
            id: 21,
            bill_pics: ['https://example.com/bill.jpg'],
        }));

        await assert.rejects(
            () => driverService.completeMaintenance(7, 11, {}),
            (err) => err.statusCode === 400 && err.message === 'cost must be greater than 0',
        );
    });

    // Tài xế up ảnh TRƯỚC khi nhập tiền thì lúc upload chưa có số tiền để đối chiếu →
    // phải chặn được ở bước hoàn tất, nếu không là vượt rào toàn bộ kiểm tra hóa đơn.
    it('should reject completion when claimed cost does not match the uploaded bills', async () => {
        mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({
            id: 21,
            bill_pics: ['https://example.com/bill.jpg'],
        }));
        mock.method(vehicleManagementRepository, 'completeMaintenanceRecordAndSetStatus', async () => ({}));
        mock.method(expenseAiValidator, 'readReceiptTotal', async () => 200_000);

        await assert.rejects(
            () => driverService.completeMaintenance(7, 11, { cost: 5_000_000 }),
            (err) => err.statusCode === 422 && err.invalidBill === true,
        );
        assert.strictEqual(vehicleManagementRepository.completeMaintenanceRecordAndSetStatus.mock.calls.length, 0);
    });

    it('should accept completion when claimed cost matches the sum of the uploaded bills', async () => {
        mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({
            id: 21,
            bill_pics: ['https://example.com/bill-1.jpg', 'https://example.com/bill-2.jpg'],
        }));
        mock.method(vehicleManagementRepository, 'completeMaintenanceRecordAndSetStatus', async () => ({}));
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({ id: 11, plate_number: '51A-12345', status: 'maintenance' }));
        mock.method(notificationGateway, 'broadcastToRole', () => {});
        mock.method(notificationService, 'getUserIdsByRole', async () => []);
        mock.method(notificationService, 'createForUsers', async () => []);
        mock.method(expenseAiValidator, 'readReceiptTotal', async () => 300_000);

        await driverService.completeMaintenance(7, 11, { cost: 600_000 });

        assert.strictEqual(vehicleManagementRepository.completeMaintenanceRecordAndSetStatus.mock.calls.length, 1);
    });

    // OCR lỗi/không đọc được → không chặn cứng tài xế; manager vẫn chốt cuối ở bước xác nhận.
    it('should fail open when no bill total can be read', async () => {
        mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({
            id: 21,
            bill_pics: ['https://example.com/bill.jpg'],
        }));
        mock.method(vehicleManagementRepository, 'completeMaintenanceRecordAndSetStatus', async () => ({}));
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({ id: 11, plate_number: '51A-12345', status: 'maintenance' }));
        mock.method(notificationGateway, 'broadcastToRole', () => {});
        mock.method(notificationService, 'getUserIdsByRole', async () => []);
        mock.method(notificationService, 'createForUsers', async () => []);
        mock.method(expenseAiValidator, 'readReceiptTotal', async () => null);

        await driverService.completeMaintenance(7, 11, { cost: 5_000_000 });

        assert.strictEqual(vehicleManagementRepository.completeMaintenanceRecordAndSetStatus.mock.calls.length, 1);
    });

    it('should persist maintenance cost when driver completes maintenance', async () => {
        mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({
            id: 21,
            bill_pics: ['https://example.com/bill.jpg'],
        }));
        mock.method(expenseAiValidator, 'readReceiptTotal', async () => 450_000);
        mock.method(vehicleManagementRepository, 'completeMaintenanceRecordAndSetStatus', async () => ({}));
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 11,
            plate_number: '51A-12345',
            status: 'maintenance',
        }));
        mock.method(notificationGateway, 'broadcastToRole', () => {});
        mock.method(notificationService, 'getUserIdsByRole', async () => [5, 8]);
        mock.method(notificationService, 'createForUsers', async () => []);

        const result = await driverService.completeMaintenance(7, 11, { cost: 450000 });

        assert.deepStrictEqual(result, { maintenanceRecordId: 21 });
        assert.strictEqual(vehicleManagementRepository.completeMaintenanceRecordAndSetStatus.mock.calls.length, 1);
        assert.strictEqual(
            vehicleManagementRepository.completeMaintenanceRecordAndSetStatus.mock.calls[0].arguments[0].cost,
            450000,
        );
        assert.strictEqual(notificationGateway.broadcastToRole.mock.calls.length, 3);
        assert.deepStrictEqual(notificationService.getUserIdsByRole.mock.calls[0].arguments, ['manager']);
        assert.deepStrictEqual(notificationService.createForUsers.mock.calls[0].arguments[0], [5, 8]);
        assert.strictEqual(
            notificationService.createForUsers.mock.calls[0].arguments[1].message,
            'Tài xế đã hoàn tất bảo dưỡng xe 51A-12345. Vui lòng kiểm tra hóa đơn và xác nhận.',
        );
    });
});
