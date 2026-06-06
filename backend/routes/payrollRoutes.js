const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const payrollController = require('../controllers/payrollController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',        driverOnly, payrollController.getMyPayrolls);
router.get('/estimate',  driverOnly, payrollController.getEstimate);
router.post('/advance',  driverOnly, payrollController.requestAdvance);
router.get('/advance',   driverOnly, payrollController.getMyAdvances);

module.exports = router;
