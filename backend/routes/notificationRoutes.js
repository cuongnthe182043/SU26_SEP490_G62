const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.use(verifyToken);

router.get('/', notificationController.listMyNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.get('/:id', notificationController.getOne);
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;
