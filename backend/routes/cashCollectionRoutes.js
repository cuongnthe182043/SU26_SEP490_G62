const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole }         = require('../middleware/authMiddleware');
const { uploadCashCollectionReceipt }      = require('../middleware/uploadMiddleware');
const cashCollectionController             = require('../controllers/cashCollectionController');

const driverOnly = [verifyToken, requireRole('driver')];

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

router.get('/me',      driverOnly, cashCollectionController.getMyCollections);
router.get('/summary', driverOnly, cashCollectionController.getSummary);
router.get('/:id',     driverOnly, cashCollectionController.getMyCollection);
router.post('/',       driverOnly, handleUpload(uploadCashCollectionReceipt.single('receipt')), cashCollectionController.createCollection);

module.exports = router;
