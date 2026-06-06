const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const leaveController = require('../controllers/leaveController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',        driverOnly, leaveController.getMyLeaves);
router.get('/summary',   driverOnly, leaveController.getSummary);
router.post('/',         driverOnly, leaveController.createLeave);
router.delete('/:id',    driverOnly, leaveController.deleteLeave);

module.exports = router;
