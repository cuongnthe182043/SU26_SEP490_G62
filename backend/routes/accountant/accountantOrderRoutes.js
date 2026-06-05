const express = require('express');
const router = express.Router();

const accountantOrderController = require('../../controllers/accountant/accountantOrderController');

router.get('/', accountantOrderController.getOrders);
router.post('/', accountantOrderController.createOrder);
router.post('/import', accountantOrderController.importOrders);
router.get('/:id/payments', accountantOrderController.getPayments);
router.post('/:id/payments', accountantOrderController.createPayment);

module.exports = router;
