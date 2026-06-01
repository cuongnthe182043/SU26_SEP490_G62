const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const paymentRoutes = require('./paymentRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/orders', orderRoutes);
router.use('/', paymentRoutes);

module.exports = router;
