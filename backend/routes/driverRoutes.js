const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const driverController = require('../controllers/driverController');

router.use(verifyToken, requireRole('coordinator', 'admin'));

router.get('/', driverController.getAllDrivers);

module.exports = router;
