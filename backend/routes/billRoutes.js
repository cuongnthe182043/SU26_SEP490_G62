const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const billController = require('../controllers/billController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',      driverOnly, billController.getMyBills);
router.get('/summary', driverOnly, billController.getSummary);
router.get('/:id',     driverOnly, billController.getMyBill);
router.post('/',       driverOnly, billController.createBill);

module.exports = router;
