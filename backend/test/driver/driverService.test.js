const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const driverService = require('../../services/driverService');
const driverRepository = require('../../repositories/driverRepository');
const vehicleManagementRepository = require('../../repositories/vehicleManagementRepository');
const notificationService = require('../../services/notificationService');
const notificationGateway = require('../../services/notificationGateway');

describe('L1: Driver Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: getAllDrivers() & listMaintenanceForDriver()', () => {
        it('L1-DRV-01: EP-Valid - Returns all drivers', async () => {
            mock.method(driverRepository, 'getAllDrivers', async () => [{ id: 1 }]);
            const res = await driverService.getAllDrivers();
            assert.strictEqual(res.length, 1);
        });

        it('L1-DRV-02: EP-Valid - Returns maintenance list', async () => {
            mock.method(vehicleManagementRepository, 'getMaintenanceRecordsForDriver', async () => [{ id: 5 }]);
            const res = await driverService.listMaintenanceForDriver(2);
            assert.strictEqual(res.length, 1);
        });
    });

    describe('Block: uploadMaintenanceBill()', () => {
        it('L1-DRV-03: BC-TRUE - Rejects if vehicleId invalid', async () => {
            await assert.rejects(
                () => driverService.uploadMaintenanceBill(1, -5, 'url'),
                { message: 'vehicle_id must be a positive integer', statusCode: 400 }
            );
        });

        it('L1-DRV-04: BC-TRUE - Rejects if billUrl missing', async () => {
            await assert.rejects(
                () => driverService.uploadMaintenanceBill(1, 2, ''),
                { message: 'Bill image is required', statusCode: 400 }
            );
        });

        it('L1-DRV-05: BC-TRUE - Rejects if no open maintenance record', async () => {
            mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => null);
            await assert.rejects(
                () => driverService.uploadMaintenanceBill(1, 2, 'url'),
                { message: 'Open maintenance record for this driver and vehicle was not found', statusCode: 404 }
            );
        });

        it('L1-DRV-06: EP-Valid - Uploads bill successfully', async () => {
            mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({ id: 5, bill_pics: ['old.jpg'] }));
            mock.method(vehicleManagementRepository, 'updateMaintenanceBillPics', async () => {});

            const res = await driverService.uploadMaintenanceBill(1, 2, 'new.jpg');
            assert.strictEqual(res.maintenanceRecordId, 5);
            assert.deepStrictEqual(res.bill_pics, ['old.jpg', 'new.jpg']);
        });
    });

    describe('Block: updateMaintenanceCost()', () => {
        it('L1-DRV-07: BC-TRUE - Rejects if cost is negative', async () => {
            await assert.rejects(
                () => driverService.updateMaintenanceCost(1, 2, -100),
                { message: 'cost must be a non-negative number', statusCode: 400 }
            );
        });

        it('L1-DRV-08: EP-Valid - Updates cost successfully', async () => {
            mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({ id: 5 }));
            mock.method(vehicleManagementRepository, 'updateMaintenanceCost', async () => {});

            const res = await driverService.updateMaintenanceCost(1, 2, 500);
            assert.strictEqual(res.cost, 500);
        });
    });

    describe('Block: completeMaintenance()', () => {
        it('L1-DRV-09: BC-TRUE - Rejects if no bills uploaded', async () => {
            mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({ id: 5, bill_pics: [] }));
            await assert.rejects(
                () => driverService.completeMaintenance(1, 2, { cost: 500 }),
                { message: 'At least one maintenance bill image is required before completion', statusCode: 400 }
            );
        });

        it('L1-DRV-10: EP-Valid - Completes and notifies manager', async () => {
            mock.method(vehicleManagementRepository, 'getActiveMaintenanceRecordForDriver', async () => ({ id: 5, bill_pics: ['1.jpg'], created_by: 99 }));
            mock.method(vehicleManagementRepository, 'completeMaintenanceRecordAndSetStatus', async () => {});
            mock.method(notificationGateway, 'broadcastToRole', () => {});
            mock.method(notificationService, 'createForUser', async () => {});

            const res = await driverService.completeMaintenance(1, 2, { cost: 500 });
            
            assert.strictEqual(res.maintenanceRecordId, 5);
            assert.strictEqual(notificationGateway.broadcastToRole.mock.calls.length, 1);
            assert.strictEqual(notificationGateway.broadcastToRole.mock.calls[0].arguments[0], 'manager');
            assert.strictEqual(notificationService.createForUser.mock.calls.length, 1);
        });
    });
});
