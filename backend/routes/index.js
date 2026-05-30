const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');

// Register route modules
router.use('/auth', authRoutes);

module.exports = router;
