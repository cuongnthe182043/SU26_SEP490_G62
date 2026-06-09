import { debtService } from '@/services/debt-service';
import { apiClient }   from '@/lib/api-client';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('debtService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getSummary', () => {
        it('gọi đúng endpoint', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                open_count: '1',
                total_remaining: '1000000',
                overdue_remaining: '0',
            });

            const result = await debtService.getSummary();

            expect(mockApi.get).toHaveBeenCalledWith('/api/debts/summary');
            expect(result.total_remaining).toBe('1000000');
        });
    });

    describe('getMyDebts', () => {
        it('gọi không có filter status', async () => {
            mockApi.get = jest.fn().mockResolvedValue({ debts: [] });
            await debtService.getMyDebts();
            expect(mockApi.get).toHaveBeenCalledWith('/api/debts/me');
        });

        it('gọi có filter status=unpaid', async () => {
            mockApi.get = jest.fn().mockResolvedValue({ debts: [] });
            await debtService.getMyDebts('unpaid');
            expect(mockApi.get).toHaveBeenCalledWith('/api/debts/me?status=unpaid');
        });
    });

    describe('cancelRepayment', () => {
        it('gọi đúng endpoint DELETE', async () => {
            mockApi.delete = jest.fn().mockResolvedValue({ message: 'OK' });
            await debtService.cancelRepayment(42);
            expect(mockApi.delete).toHaveBeenCalledWith('/api/debts/repayments/42');
        });
    });
});
