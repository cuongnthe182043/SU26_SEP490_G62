const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const cashCollectionController = require('../controllers/cashCollectionController');

const driverOnly = [verifyToken, requireRole('driver')];

router.get('/me',      driverOnly, cashCollectionController.getMyCollections);
router.get('/summary', driverOnly, cashCollectionController.getSummary);
router.get('/:id',     driverOnly, cashCollectionController.getMyCollection);
router.post('/',       driverOnly, cashCollectionController.createCollection);

module.exports = router;
