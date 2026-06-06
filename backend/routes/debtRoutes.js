const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const debtController = require('../controllers/debtController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',           driverOnly, debtController.getMyDebts);
router.get('/summary',      driverOnly, debtController.getMyDebtSummary);
router.get('/:id/payments', driverOnly, debtController.getDebtPayments);

module.exports = router;
