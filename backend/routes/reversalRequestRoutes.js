const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/reversalRequestController');

router.use(verifyToken);

// AI CŨNG được gửi yêu cầu — kể cả tài xế. Đó là điểm mấu chốt của tầng này: người
// phát hiện ra cái sai thường không phải người có quyền sửa. Quyền chỉ chặn ở khâu
// duyệt, và reversalService còn kiểm lại vai lần nữa theo từng loại thao tác.
router.get   ('/kinds',        ctrl.listKinds);
router.get   ('/mine',         ctrl.listMine);
router.post  ('/',             ctrl.create);
router.delete('/:id',          ctrl.cancelOwn);

// Duyệt / từ chối: chỉ quản lý và kế toán. Vai cụ thể cho từng loại thao tác được
// reversalService kiểm tiếp — vd khôi phục xe chỉ manager, kế toán không đụng được.
const approverOnly = requireRole('manager', 'accountant');
router.get  ('/pending',       approverOnly, ctrl.listPending);
router.patch('/:id/approve',   approverOnly, ctrl.approve);
router.patch('/:id/reject',    approverOnly, ctrl.reject);

module.exports = router;
