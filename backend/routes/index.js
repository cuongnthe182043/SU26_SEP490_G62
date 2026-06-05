const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const accountantRoutes = require('./accountant/accountantRoutes');
const tripRoutes = require('./tripRoutes');
const profileRoutes = require('./profileRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');
const orderRoutes = require('./orderRoutes');
const driverRoutes = require('./driverRoutes');
const adminRoutes = require('./adminRoutes');
const expenseRoutes = require('./expenseRoutes');
const incidentRoutes = require('./incidentRoutes');
const notificationRoutes = require('./notificationRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/accountant', accountantRoutes);
router.use('/api/trips', tripRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/coordinator', coordinatorRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/drivers', driverRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/expenses', expenseRoutes);
router.use('/api/incidents', incidentRoutes);
router.use('/api/notifications', notificationRoutes);

module.exports = router;
