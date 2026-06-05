const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const accountantRoutes = require('./accountant/accountantRoutes');
const tripRoutes    = require('./tripRoutes');
const profileRoutes = require('./profileRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/accountant', accountantRoutes);
router.use('/api/trips', tripRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/coordinator', coordinatorRoutes);

module.exports = router;
