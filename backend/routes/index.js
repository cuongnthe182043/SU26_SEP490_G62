const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes    = require('./authRoutes');
const tripRoutes    = require('./tripRoutes');
const profileRoutes = require('./profileRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/api/trips', tripRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/coordinator', coordinatorRoutes);

module.exports = router;
