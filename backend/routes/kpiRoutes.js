const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const kpiController = require('../controllers/kpiController');

// ─── Phân quyền ───────────────────────────────────────────────────────────────
// Driver     → chỉ xem KPI & leaderboard của bản thân
// Coordinator/Manager → xem tất cả driver, filter theo nhóm xe
// Accountant → xem KPI của 1 driver cụ thể (phục vụ tính lương)
// Manager    → riêng quyền đổi nhóm xe cố định của tài xế

const driverOnly     = [verifyToken, requireRole('driver')];
const staffOnly      = [verifyToken, requireRole('coordinator', 'manager')];
const financeStaff   = [verifyToken, requireRole('coordinator', 'manager', 'accountant')];
const managerOnly    = [verifyToken, requireRole('manager')];

// ─── Driver routes ────────────────────────────────────────────────────────────

router.get('/me',          driverOnly, kpiController.getMyKPI);
router.get('/leaderboard', driverOnly, kpiController.getLeaderboard);

// ─── Coordinator/Manager routes ───────────────────────────────────────────────

router.get('/all',                          staffOnly,    kpiController.getAllDriversKPI);
router.get('/leaderboard/group/:vehicleGroupId', staffOnly, kpiController.getLeaderboardByGroup);

// ─── Coordinator/Manager/Accountant: KPI của 1 driver cụ thể ─────────────────

router.get('/driver/:driverId', financeStaff, kpiController.getDriverKPIById);

// Sửa tay nhóm xe KPI cố định của tài xế — Body: { vehicleGroupId }
// Chỉ Manager được đổi; Coordinator/Accountant vẫn xem được nhóm hiện tại + lịch sử.
router.patch('/driver/:driverId/vehicle-group',         managerOnly, kpiController.setDriverDefaultVehicleGroup);
router.get  ('/driver/:driverId/vehicle-group/history', financeStaff, kpiController.getDriverGroupHistory);

module.exports = router;
