const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert');

const vehicleManagementRepository = require('../repositories/vehicleManagementRepository');
const vehicleManagementService = require('../services/vehicleManagementService');

describe('Vehicle Management Service', () => {
    afterEach(() => {
        mock.restoreAll();
    });

    it('should allow unassigning driver from vehicle in maintenance status', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 10,
            plate_number: '51A-00001',
            vehicle_group_id: 2,
            brand: 'Isuzu',
            model: 'NQR',
            load_capacity_kg: 2000,
            manufacture_year: 2020,
            purchase_date: '2020-01-01',
            assigned_driver_id: 7,
            status: 'maintenance',
        }));
        mock.method(vehicleManagementRepository, 'updateVehicle', async () => ({}));
        mock.method(vehicleManagementRepository, 'listVehicleStatusHistory', async () => []);

        const vehicle = await vehicleManagementService.setVehicleDriverAssignment(10, { assigned_driver_id: null });

        assert.strictEqual(vehicle.assigned_driver_id, 7);
        assert.strictEqual(vehicleManagementRepository.updateVehicle.mock.calls.length, 1);
        assert.strictEqual(
            vehicleManagementRepository.updateVehicle.mock.calls[0].arguments[1].assigned_driver_id,
            null,
        );
    });

    it('should reject assigning a driver to a broken vehicle', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 10,
            plate_number: '51A-00001',
            vehicle_group_id: 2,
            brand: 'Isuzu',
            model: 'NQR',
            load_capacity_kg: 2000,
            manufacture_year: 2020,
            purchase_date: '2020-01-01',
            assigned_driver_id: null,
            status: 'broken',
        }));

        await assert.rejects(
            () => vehicleManagementService.setVehicleDriverAssignment(10, { assigned_driver_id: 7 }),
            (err) => err.statusCode === 409 && err.message === 'Cannot assign a driver when vehicle status is broken',
        );
    });

    it('should reject assigning a driver with unverified maintenance to another vehicle', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 12,
            plate_number: '51A-00002',
            vehicle_group_id: 2,
            brand: 'Hino',
            model: 'XZU',
            load_capacity_kg: 1800,
            manufacture_year: 2021,
            purchase_date: '2021-03-01',
            assigned_driver_id: null,
            status: 'active',
        }));
        mock.method(vehicleManagementRepository, 'getDriverById', async () => ({
            id: 7,
            vehicle_id: null,
            active_shipment_count: 0,
            unverified_maintenance_count: 1,
        }));

        await assert.rejects(
            () => vehicleManagementService.setVehicleDriverAssignment(12, { assigned_driver_id: 7 }),
            (err) => err.statusCode === 409 && err.message === 'Assigned driver has an unverified maintenance record and cannot be assigned yet',
        );
    });

    it('should reject assigning a driver with active shipments to a vehicle', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 14,
            plate_number: '51A-00003',
            vehicle_group_id: 2,
            brand: 'Hyundai',
            model: 'Mighty',
            load_capacity_kg: 1500,
            manufacture_year: 2022,
            purchase_date: '2022-05-01',
            assigned_driver_id: null,
            status: 'active',
        }));
        mock.method(vehicleManagementRepository, 'getDriverById', async () => ({
            id: 9,
            vehicle_id: null,
            active_shipment_count: 2,
            unverified_maintenance_count: 0,
        }));

        await assert.rejects(
            () => vehicleManagementService.setVehicleDriverAssignment(14, { assigned_driver_id: 9 }),
            (err) => err.statusCode === 409 && err.message === 'Assigned driver must not have active shipments',
        );
    });

    it('should list drivers with assignment blockers from shipments and maintenance verification', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 15,
            assigned_driver_id: 3,
            status: 'active',
        }));
        mock.method(vehicleManagementRepository, 'listDriverOptions', async () => ([
            {
                id: 3,
                current_vehicle_id: 15,
                active_shipment_count: 0,
                unverified_maintenance_count: 1,
            },
            {
                id: 4,
                current_vehicle_id: null,
                active_shipment_count: 1,
                unverified_maintenance_count: 0,
            },
            {
                id: 5,
                current_vehicle_id: null,
                active_shipment_count: 0,
                unverified_maintenance_count: 0,
            },
        ]));

        const drivers = await vehicleManagementService.listAssignableDrivers(15);

        assert.strictEqual(drivers[0].is_assignable, true);
        assert.strictEqual(drivers[0].has_unverified_maintenance, true);
        assert.strictEqual(drivers[1].is_assignable, false);
        assert.strictEqual(drivers[1].has_active_shipment, true);
        assert.strictEqual(drivers[2].is_assignable, true);
    });

    it('should block pending-maintenance drivers from new vehicle assignment options', async () => {
        mock.method(vehicleManagementRepository, 'listDriverOptions', async () => ([
            {
                id: 3,
                current_vehicle_id: null,
                active_shipment_count: 0,
                unverified_maintenance_count: 1,
            },
        ]));

        const drivers = await vehicleManagementService.listAssignableDrivers();

        assert.strictEqual(drivers[0].is_assignable, false);
        assert.strictEqual(drivers[0].has_unverified_maintenance, true);
    });

    it('should allow sending a broken vehicle to maintenance when breakdown is still open', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 18,
            plate_number: '51A-00018',
            vehicle_group_id: 2,
            assigned_driver_id: 7,
            active_failure_id: 44,
            status: 'broken',
        }));
        mock.method(vehicleManagementRepository, 'getDriverById', async () => ({
            id: 7,
            vehicle_id: 18,
            active_shipment_count: 0,
            unverified_maintenance_count: 0,
        }));
        mock.method(vehicleManagementRepository, 'moveBrokenVehicleToMaintenance', async () => ({}));
        mock.method(vehicleManagementRepository, 'listVehicleStatusHistory', async () => []);

        await vehicleManagementService.sendVehicleToMaintenance(18, 3, {
            maintenance_type: 'repair',
            description: 'Repair after breakdown',
            maintenance_date: '2026-06-12',
            performed_by: 7,
        });

        assert.strictEqual(vehicleManagementRepository.moveBrokenVehicleToMaintenance.mock.calls.length, 1);
    });

    it('should reject sending a broken vehicle to maintenance when no open breakdown incident exists', async () => {
        mock.method(vehicleManagementRepository, 'getVehicleById', async () => ({
            id: 19,
            plate_number: '51A-00019',
            vehicle_group_id: 2,
            assigned_driver_id: 7,
            active_failure_id: null,
            status: 'broken',
        }));
        mock.method(vehicleManagementRepository, 'getDriverById', async () => ({
            id: 7,
            vehicle_id: 19,
            active_shipment_count: 0,
            unverified_maintenance_count: 0,
        }));

        await assert.rejects(
            () => vehicleManagementService.sendVehicleToMaintenance(19, 3, {
                maintenance_type: 'repair',
                description: 'Repair after breakdown',
                maintenance_date: '2026-06-12',
                performed_by: 7,
            }),
            (err) => err.statusCode === 409 && err.message === 'Cannot send broken vehicle to maintenance without an open breakdown incident',
        );
    });
});
