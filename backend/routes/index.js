const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes    = require('./authRoutes');
const tripRoutes    = require('./tripRoutes');
const profileRoutes = require('./profileRoutes');

// Register route modules
router.use('/auth', authRoutes);
router.use('/api/trips', tripRoutes);
router.use('/api/profile', profileRoutes);

module.exports = router;
