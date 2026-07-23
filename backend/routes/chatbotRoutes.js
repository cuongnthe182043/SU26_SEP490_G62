const express = require('express');
const chatbotController = require('../controllers/chatbotController');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Mọi user đã đăng nhập đều truy cập được; service tự phân quyền dữ liệu theo role
// (driver chỉ thấy dữ liệu của mình, coordinator không thấy tài chính...).
router.use(verifyToken);

router.get('/status', chatbotController.getStatus);
router.post('/ask', chatbotController.ask);

module.exports = router;
