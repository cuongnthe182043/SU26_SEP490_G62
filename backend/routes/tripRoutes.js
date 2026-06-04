const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadTripComplete } = require('../middleware/uploadMiddleware');
const tripController = require('../controllers/tripController');

const driverOnly = [verifyToken, requireRole('driver')];

function handleUpload(middleware) {
    return (req, res, next) => {
        middleware(req, res, (err) => {
            if (err) return res.status(422).json({ error: err.message });
            next();
        });
    };
}

router.get('/stats',   driverOnly, tripController.getDriverStats);
router.get('/history', driverOnly, tripController.getOrderHistory);
router.get('/orders/:orderId', driverOnly, tripController.getOrderDetail);

router.get('/pool',                       driverOnly, tripController.getTripPool);
router.get('/pool-shipment/:shipmentId',  driverOnly, tripController.getAvailableShipmentDetail);
router.get('/pool/:orderId',              driverOnly, tripController.getAvailableOrderDetail);

router.get('/active', driverOnly, tripController.getActiveTrip);

router.post('/:id/claim',           driverOnly, tripController.claimTrip);
router.patch('/:id/status',         driverOnly, tripController.updateStatus);
router.post('/:id/cancel-delivery', driverOnly, tripController.cancelDelivery);
router.post('/:id/release',         driverOnly, tripController.releaseTrip);

router.post(
    '/:id/complete',
    driverOnly,
    handleUpload(uploadTripComplete.fields([
        { name: 'receipt', maxCount: 1 },
        { name: 'proof',   maxCount: 1 },
    ])),
    tripController.completeTrip,
);

module.exports = router;
