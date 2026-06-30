const { describe, it, mock, beforeEach } = require('node:test');
const assert = require('node:assert');
const debtService = require('../../services/debtService');
const debtRepository = require('../../repositories/debtRepository');
const notificationGateway = require('../../services/notificationGateway');
const pool = require('../../config/database');

describe('L1: Debt Service Unit Tests', () => {
    beforeEach(() => {
        mock.restoreAll();
    });

    describe('Block: getMyDebts()', () => {
        it('L1-DEBT-01: BC-TRUE - Calls repo with empty status', async () => {
            mock.method(debtRepository, 'getDriverDebts', async () => [{ id: 1 }]);
            const res = await debtService.getMyDebts(1);
            assert.strictEqual(res.length, 1);
            assert.deepStrictEqual(debtRepository.getDriverDebts.mock.calls[0].arguments, [1, { status: undefined }]);
        });

        it('L1-DEBT-02: BC-FALSE - Calls repo with explicit status', async () => {
            mock.method(debtRepository, 'getDriverDebts', async () => [{ id: 2 }]);
            await debtService.getMyDebts(1, { status: 'pending' });
            assert.deepStrictEqual(debtRepository.getDriverDebts.mock.calls[0].arguments, [1, { status: 'pending' }]);
        });
    });

    describe('Block: getMyDebtSummary()', () => {
        it('L1-DEBT-03: EP-Valid - Returns driver debt summary', async () => {
            mock.method(debtRepository, 'getDriverDebtSummary', async () => ({ total: 500 }));
            const res = await debtService.getMyDebtSummary(2);
            assert.strictEqual(res.total, 500);
            assert.strictEqual(debtRepository.getDriverDebtSummary.mock.calls[0].arguments[0], 2);
        });
    });

    describe('Block: getDebtPayments()', () => {
        it('L1-DEBT-04: EP-Valid - Returns debt payments history', async () => {
            mock.method(debtRepository, 'getDebtPayments', async () => [{ amount: 100 }]);
            const res = await debtService.getDebtPayments(1, 10);
            assert.strictEqual(res[0].amount, 100);
            assert.deepStrictEqual(debtRepository.getDebtPayments.mock.calls[0].arguments, [10, 1]);
        });
    });

    describe('Block: submitRepayment()', () => {
        it('L1-DEBT-05: BC-TRUE - Rejects if amount is invalid (<=0 or NaN)', async () => {
            await assert.rejects(
                () => debtService.submitRepayment(1, 10, { amount: -5 }, 'url'),
                { message: 'Số tiền phải lớn hơn 0' }
            );
        });

        it('L1-DEBT-06: BC-TRUE - Rejects if receiptUrl is missing', async () => {
            await assert.rejects(
                () => debtService.submitRepayment(1, 10, { amount: 500 }, ''),
                { message: 'Ảnh chứng từ là bắt buộc' }
            );
        });

        it('L1-DEBT-07: BC-TRUE - Rejects if paymentMethod is invalid', async () => {
            await assert.rejects(
                () => debtService.submitRepayment(1, 10, { amount: 500, paymentMethod: 'momo' }, 'url'),
                { message: 'Hình thức thanh toán không hợp lệ' }
            );
        });

        it('L1-DEBT-08: EP-Valid - Successfully submits repayment', async () => {
            mock.method(debtRepository, 'submitRepayment', async () => ({ id: 5 }));
            const res = await debtService.submitRepayment(1, 10, { amount: 500, paymentMethod: 'cash', notes: 'test' }, 'http://img');
            assert.strictEqual(res.id, 5);
            assert.deepStrictEqual(debtRepository.submitRepayment.mock.calls[0].arguments, [
                1, 10, { amount: 500, paymentMethod: 'cash', notes: 'test', receiptUrl: 'http://img' }
            ]);
        });
    });

    describe('Block: cancelRepayment()', () => {
        it('L1-DEBT-09: EP-Valid - Cancels repayment via repo', async () => {
            mock.method(debtRepository, 'cancelRepayment', async () => ({ id: 5, status: 'cancelled' }));
            const res = await debtService.cancelRepayment(1, 5);
            assert.strictEqual(res.status, 'cancelled');
        });
    });

    describe('Block: confirmRepayment()', () => {
        it('L1-DEBT-10: EP-Valid - Confirms repayment and broadcasts WS', async () => {
            mock.method(debtRepository, 'confirmRepayment', async () => ({ id: 5, driverId: 2, debtId: 10 }));
            mock.method(notificationGateway, 'broadcastToUser', () => {});
            
            const res = await debtService.confirmRepayment(5, 99);
            assert.strictEqual(res.id, 5);
            assert.strictEqual(notificationGateway.broadcastToUser.mock.calls.length, 1);
            assert.deepStrictEqual(notificationGateway.broadcastToUser.mock.calls[0].arguments, [
                2, { type: 'debt.updated', debtId: 10 }
            ]);
        });
    });

    describe('Block: rejectRepayment()', () => {
        it('L1-DEBT-11: EP-Valid - Rejects repayment and broadcasts WS', async () => {
            mock.method(debtRepository, 'rejectRepayment', async () => ({ id: 5, driverId: 3, debtId: 11 }));
            mock.method(notificationGateway, 'broadcastToUser', () => {});
            
            const res = await debtService.rejectRepayment(5, 99, 'Sai tien');
            assert.strictEqual(res.id, 5);
            assert.strictEqual(notificationGateway.broadcastToUser.mock.calls.length, 1);
            assert.deepStrictEqual(notificationGateway.broadcastToUser.mock.calls[0].arguments, [
                3, { type: 'debt.updated', debtId: 11 }
            ]);
        });
    });

    describe('Block: getPendingRepayments()', () => {
        it('L1-DEBT-12: EP-Valid - Queries pool for pending repayments', async () => {
            mock.method(pool, 'query', async () => ({ rows: [{ id: 1, amount: '500' }] }));
            const res = await debtService.getPendingRepayments();
            assert.strictEqual(res.length, 1);
            assert.strictEqual(res[0].id, 1);
        });
    });
});
