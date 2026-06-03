const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes        = require('./authRoutes');
const tripRoutes        = require('./tripRoutes');
const profileRoutes     = require('./profileRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');
const orderRoutes = require('./orderRoutes');
const driverRoutes = require('./driverRoutes');
const adminRoutes = require('./adminRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/api/trips', tripRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/coordinator', coordinatorRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/drivers', driverRoutes);
router.use('/api/admin', adminRoutes);

module.exports = router;
