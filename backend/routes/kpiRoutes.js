const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const kpiController = require('../controllers/kpiController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',          driverOnly, kpiController.getMyKPI);
router.get('/leaderboard', driverOnly, kpiController.getLeaderboard);

module.exports = router;
