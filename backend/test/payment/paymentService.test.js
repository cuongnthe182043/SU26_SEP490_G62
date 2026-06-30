const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const paymentService = require('../../services/paymentService');
const paymentRepository = require('../../repositories/paymentRepository');
const tripRepository = require('../../repositories/tripRepository');

describe('L1: Payment Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: recordDriverCashPayment()', () => {
        it('L1-PAY-01: BC-TRUE - Rejects if receiptUrl missing', async () => {
            await assert.rejects(
                () => paymentService.recordDriverCashPayment(1, 1, { amount: 500 }, ''),
                { message: 'Ảnh biên lai thanh toán là bắt buộc (BR-018)' }
            );
        });

        it('L1-PAY-02: BC-TRUE - Rejects if amount is invalid', async () => {
            await assert.rejects(
                () => paymentService.recordDriverCashPayment(1, 1, { amount: -500 }, 'url'),
                { message: 'Số tiền phải lớn hơn 0' }
            );
        });

        it('L1-PAY-03: BC-TRUE - Rejects if driver not owner', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 2, status: 'transit' }));
            await assert.rejects(
                () => paymentService.recordDriverCashPayment(1, 1, { amount: 500 }, 'url'),
                { message: 'Bạn không có quyền ghi nhận thanh toán cho chuyến này' }
            );
        });

        it('L1-PAY-04: BC-TRUE - Rejects if shipment status invalid', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1, status: 'available' }));
            await assert.rejects(
                () => paymentService.recordDriverCashPayment(1, 1, { amount: 500 }, 'url'),
                { message: 'Chỉ có thể ghi nhận thanh toán khi chuyến đang thực hiện hoặc đã giao' }
            );
        });

        it('L1-PAY-05: BC-TRUE - Rejects if order payment type is bank_transfer', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1, status: 'transit' }));
            mock.method(paymentRepository, 'getShipmentFinancialSummary', async () => ({ order_payment_type: 'bank_transfer' }));
            
            await assert.rejects(
                () => paymentService.recordDriverCashPayment(1, 1, { amount: 500 }, 'url'),
                { message: /Đơn hàng này khách thanh toán chuyển khoản/ }
            );
        });

        it('L1-PAY-06: EP-Valid - Records payment successfully', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1, status: 'completed', order_id: 10 }));
            mock.method(paymentRepository, 'getShipmentFinancialSummary', async () => ({ order_payment_type: 'cash' }));
            mock.method(paymentRepository, 'getPendingReceiptShell', async () => null);
            mock.method(paymentRepository, 'recordCashPayment', async () => ({ payment: { id: 5 } }));
            mock.method(paymentRepository, 'addPaymentReceipt', async () => {});
            mock.method(paymentRepository, 'createDriverDebt', async () => {});

            const res = await paymentService.recordDriverCashPayment(1, 1, { amount: 500, notes: 'n' }, 'url');
            assert.strictEqual(res.payment.id, 5);
            assert.strictEqual(paymentRepository.addPaymentReceipt.mock.calls.length, 1);
            assert.strictEqual(paymentRepository.createDriverDebt.mock.calls.length, 1);
        });
    });

    describe('Block: getShipmentPayments() & getShipmentPaymentSummary()', () => {
        it('L1-PAY-07: BC-TRUE - Rejects if driver not owner (Payments)', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 2 }));
            await assert.rejects(
                () => paymentService.getShipmentPayments(1, 1),
                { message: 'Bạn không có quyền xem thanh toán của chuyến này' }
            );
        });

        it('L1-PAY-08: EP-Valid - Returns payments', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1 }));
            mock.method(paymentRepository, 'getShipmentPayments', async () => [{ id: 5 }]);
            const res = await paymentService.getShipmentPayments(1, 1);
            assert.strictEqual(res.length, 1);
        });

        it('L1-PAY-09: EP-Valid - Returns financial summary', async () => {
            mock.method(tripRepository, 'getTripById', async () => ({ owner_driver_id: 1 }));
            mock.method(paymentRepository, 'getShipmentFinancialSummary', async () => ({ total: 1000 }));
            const res = await paymentService.getShipmentPaymentSummary(1, 1);
            assert.strictEqual(res.total, 1000);
        });
    });

    describe('Block: updateCashPayment()', () => {
        it('L1-PAY-10: BC-TRUE - Rejects if payment not collected by driver', async () => {
            mock.method(paymentRepository, 'getPaymentById', async () => ({ shipment_id: 1, collected_by: 2 }));
            await assert.rejects(
                () => paymentService.updateCashPayment(1, 1, 5, { newAmount: 500 }),
                { message: 'Bạn không có quyền sửa ghi nhận này' }
            );
        });

        it('L1-PAY-11: EP-Valid - Updates cash payment amount and URL', async () => {
            mock.method(paymentRepository, 'getPaymentById', async () => ({ shipment_id: 1, collected_by: 1 }));
            mock.method(paymentRepository, 'updateShipmentPayment', async () => {});
            mock.method(paymentRepository, 'replacePaymentReceipts', async () => {});

            const res = await paymentService.updateCashPayment(1, 1, 5, { newAmount: 800, newReceiptUrl: 'new_url' });
            assert.ok(res.payment);
            assert.strictEqual(paymentRepository.replacePaymentReceipts.mock.calls.length, 1);
        });
    });
});
