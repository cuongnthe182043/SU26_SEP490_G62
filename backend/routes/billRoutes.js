const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadBill } = require('../middleware/uploadMiddleware');
const billController = require('../controllers/billController');

const driverOnly = [verifyToken, requireRole('driver')];

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

router.get('/me',      driverOnly, billController.getMyBills);
router.get('/summary', driverOnly, billController.getSummary);
router.get('/:id',     driverOnly, billController.getMyBill);
router.post('/',       driverOnly, handleUpload(uploadBill.single('receipt')), billController.createBill);

module.exports = router;
