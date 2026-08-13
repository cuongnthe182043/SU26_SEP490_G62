const express = require('express');
const vehicleManagementController = require('../controllers/vehicleManagementController');
const holidayController = require('../controllers/holidayController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(verifyToken);

// Quản lý xe / nhóm xe / bảo trì / vòng đời xe và danh mục ngày lễ là độc quyền
// Manager. Accountant chỉ được đọc để đối chiếu khi tính lương và tra cứu phương
// tiện — mọi thao tác ghi đều chặn tại đây (UI kế toán cũng ẩn nút tương ứng).
const canRead     = requireRole('manager', 'accountant');
const managerOnly = requireRole('manager');

router.get('/vehicle-groups', canRead, vehicleManagementController.listVehicleGroups);
router.post('/vehicle-groups', managerOnly, vehicleManagementController.createVehicleGroup);
router.get('/vehicle-groups/:id', canRead, vehicleManagementController.getVehicleGroupDetail);
router.put('/vehicle-groups/:id', managerOnly, vehicleManagementController.updateVehicleGroup);
router.delete('/vehicle-groups/:id', managerOnly, vehicleManagementController.deleteVehicleGroup);
router.post('/vehicle-groups/:id/restore', managerOnly, vehicleManagementController.restoreVehicleGroup);

router.get('/vehicles/driver-options', canRead, vehicleManagementController.listAssignableDrivers);
router.get('/vehicles', canRead, vehicleManagementController.listVehicles);
router.post('/vehicles', managerOnly, vehicleManagementController.createVehicle);
router.get('/vehicles/:id', canRead, vehicleManagementController.getVehicleDetail);
router.put('/vehicles/:id', managerOnly, vehicleManagementController.updateVehicle);
router.get('/holidays', canRead, holidayController.listHolidays);
router.post('/holidays', managerOnly, holidayController.createHoliday);
router.delete('/holidays/:date', managerOnly, holidayController.deleteHoliday);

router.get('/maintenance-requests', canRead, vehicleManagementController.listMaintenanceRequests);
router.post('/maintenance-requests/:id/approve', managerOnly, vehicleManagementController.approveMaintenanceRequest);
router.post('/maintenance-requests/:id/reject', managerOnly, vehicleManagementController.rejectMaintenanceRequest);
router.post('/vehicles/:id/send-to-maintenance', managerOnly, vehicleManagementController.sendVehicleToMaintenance);
router.post('/vehicles/:id/complete-maintenance', managerOnly, vehicleManagementController.completeMaintenance);
router.post('/vehicles/:id/verify-maintenance', managerOnly, vehicleManagementController.verifyMaintenance);
router.post('/vehicles/:id/reject-maintenance', managerOnly, vehicleManagementController.rejectMaintenance);
router.post('/vehicles/:id/mark-broken', managerOnly, vehicleManagementController.markVehicleAsBroken);
router.post('/vehicles/:id/restore', managerOnly, vehicleManagementController.restoreVehicle);
router.post('/vehicles/:id/retire', managerOnly, vehicleManagementController.retireVehicle);
router.patch('/vehicles/:id/status', managerOnly, vehicleManagementController.changeVehicleStatus);
router.patch('/vehicles/:id/driver-assignment', managerOnly, vehicleManagementController.setVehicleDriverAssignment);
router.get('/vehicles/:id/assignment-history', canRead, vehicleManagementController.getVehicleAssignmentHistory);
router.delete('/vehicles/:id', managerOnly, vehicleManagementController.softDeleteVehicle);

module.exports = router;
