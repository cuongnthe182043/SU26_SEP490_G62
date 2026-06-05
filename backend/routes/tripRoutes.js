const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { uploadProof, uploadPaymentReceipt } = require('../middleware/uploadMiddleware');
const tripController    = require('../controllers/tripController');
const paymentController = require('../controllers/paymentController');

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

router.post('/:id/claim',   driverOnly, tripController.claimTrip);
router.patch('/:id/status', driverOnly, tripController.updateStatus);
router.post('/:id/release', driverOnly, tripController.releaseTrip);

router.post(
    '/:id/complete',
    driverOnly,
    handleUpload(uploadProof.single('proof')),
    tripController.completeTrip,
);

// TH2: Ghi nhận khách trả tiền mặt cho driver → tạo driver debt
router.post(
    '/:id/payment',
    driverOnly,
    handleUpload(uploadPaymentReceipt.single('receipt')),
    paymentController.recordCashPayment,
);
router.get('/:id/payments', driverOnly, paymentController.getShipmentPayments);

// Multi-Stop: xem + xác nhận từng stop (BR-011)
router.get('/:id/stops', driverOnly, tripController.getShipmentStops);
router.patch('/:id/stops/:stopId/arrive',   driverOnly, tripController.arriveAtStop);
router.patch('/:id/stops/:stopId/complete', driverOnly, tripController.completeStop);

module.exports = router;
