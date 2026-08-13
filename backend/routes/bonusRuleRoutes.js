const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const bonusRuleController = require('../controllers/bonusRuleController');

// Quy tắc thưởng — chỉ Manager được cấu hình. Accountant chỉ đọc để đối chiếu khi
// tính lương, mọi thao tác ghi đều bị chặn ở đây (UI kế toán cũng ẩn nút).
router.use(verifyToken);

const readOnly    = requireRole('manager', 'accountant');
const managerOnly = requireRole('manager');

router.get('/',      readOnly, bonusRuleController.getAll);
router.get('/:id',   readOnly, bonusRuleController.getOne);
router.post('/',     managerOnly, bonusRuleController.create);
router.put('/:id',   managerOnly, bonusRuleController.update);
router.delete('/:id', managerOnly, bonusRuleController.remove);

module.exports = router;
