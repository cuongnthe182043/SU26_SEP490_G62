const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const incidentService = require('../../services/incidentService');
const incidentRepository = require('../../repositories/incidentRepository');
const tripRepository = require('../../repositories/tripRepository');
const notificationService = require('../../services/notificationService');

describe('L1: Incident Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: createIncident()', () => {
        it('L1-INC-01: BC-TRUE - Fails if type invalid', async () => {
            await assert.rejects(
                () => incidentService.createIncident(1, { incidentType: 'invalid', description: 'test test test' }),
                { message: 'Loại sự cố không hợp lệ' }
            );
        });

        it('L1-INC-02: BC-TRUE - Fails if driver does not own shipment', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 2, status: 'transit' }));
            await assert.rejects(
                () => incidentService.createIncident(1, { shipmentId: 1, incidentType: 'other', description: 'test test test' }),
                { message: 'Bạn không có quyền báo sự cố cho chuyến này' }
            );
        });

        it('L1-INC-03: EP-Valid - Creates incident successfully', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1, status: 'transit' }));
            mock.method(incidentRepository, 'getIncidentsByShipment', async () => []);
            mock.method(incidentRepository, 'createIncident', async () => ({ id: 5 }));
            mock.method(incidentRepository, 'addIncidentEvidence', async () => {});
            mock.method(incidentRepository, 'getCoordinatorIds', async () => [99]);
            mock.method(incidentRepository, 'getIncidentById', async () => ({ id: 5 }));
            mock.method(notificationService, 'createForUsers', async () => {});
            mock.method(notificationService, 'createForUser', async () => {});

            await incidentService.createIncident(1, { shipmentId: 1, incidentType: 'other', description: 'valid description' }, ['url']);
            
            assert.strictEqual(incidentRepository.createIncident.mock.calls.length, 1);
            assert.strictEqual(notificationService.createForUsers.mock.calls.length, 1);
        });
    });

    describe('Block: getMyCounts() & getMyIncidents()', () => {
        it('L1-INC-04: EP-Valid - Returns driver incident counts', async () => {
            const pool = require('../../config/database');
            mock.method(pool, 'query', async () => ({ rows: [{ open_count: 1, closed_count: 0 }] }));
            const res = await incidentService.getMyCounts(1);
            assert.strictEqual(res.open_count, 1);
        });

        it('L1-INC-05: EP-Valid - Returns driver incidents list', async () => {
            mock.method(incidentRepository, 'getIncidentsByDriver', async () => ({ rows: [{ id: 5 }], total: 1 }));
            const res = await incidentService.getMyIncidents(1, 1, 20);
            assert.strictEqual(res.incidents.length, 1);
        });
    });

    describe('Block: getIncidentDetail() & getShipmentIncidents()', () => {
        it('L1-INC-06: BC-TRUE - Fails if driver does not own incident', async () => {
            mock.method(incidentRepository, 'getIncidentById', async () => ({ reported_by: 2 }));
            await assert.rejects(
                () => incidentService.getIncidentDetail(1, 1),
                { message: 'Bạn không có quyền xem sự cố này' }
            );
        });

        it('L1-INC-07: EP-Valid - Returns shipment incidents', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1 }));
            mock.method(incidentRepository, 'getIncidentsByShipment', async () => [{ id: 5 }]);
            const res = await incidentService.getShipmentIncidents(1, 1);
            assert.strictEqual(res.length, 1);
        });
    });

    describe('Block: updateMyIncident()', () => {
        it('L1-INC-08: BC-TRUE - Fails if not in open status', async () => {
            mock.method(incidentRepository, 'getIncidentById', async () => ({ reported_by: 1, status: 'resolved' }));
            await assert.rejects(
                () => incidentService.updateMyIncident(1, 1, { description: 'test test test' }),
                { message: 'Chỉ có thể chỉnh sửa sự cố đang ở trạng thái "Đang chờ"' }
            );
        });

        it('L1-INC-09: EP-Valid - Updates incident successfully', async () => {
            mock.method(incidentRepository, 'getIncidentById', async () => ({ reported_by: 1, status: 'open', shipment_id: 1 }));
            mock.method(incidentRepository, 'updateIncident', async () => true);
            mock.method(incidentRepository, 'getCoordinatorIds', async () => [99]);
            mock.method(notificationService, 'createForUsers', async () => {});

            await incidentService.updateMyIncident(1, 1, { description: 'valid desc' });
            assert.strictEqual(incidentRepository.updateIncident.mock.calls.length, 1);
        });
    });

    describe('Block: updateIncidentStatus()', () => {
        it('L1-INC-10: EP-Valid - Coordinator updates status and notifies driver', async () => {
            mock.method(incidentRepository, 'getIncidentById', async () => ({ reported_by: 1 }));
            mock.method(incidentRepository, 'updateIncidentStatus', async () => true);
            mock.method(notificationService, 'createForUser', async () => {});

            await incidentService.updateIncidentStatus(1, 99, { status: 'resolved', resolution: 'done' });
            assert.strictEqual(incidentRepository.updateIncidentStatus.mock.calls.length, 1);
            assert.strictEqual(notificationService.createForUser.mock.calls.length, 1);
        });
    });
});
