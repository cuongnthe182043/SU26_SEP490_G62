const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);
router.get('/roles', authController.getAllRoles);

// Protected routes
router.get('/me', verifyToken, authController.getCurrentUser);

// Protected route example: Only coordinator can access
// router.get('/coordinator-data', verifyToken, requireRole('coordinator'), authController.getCoordinatorData);

module.exports = router;
