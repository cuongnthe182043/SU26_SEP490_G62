import { payrollService } from '@/services/payroll-service';
import { apiClient }      from '@/lib/api-client';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('payrollService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getMyPayrolls', () => {
        it('G62-FE-55: getMyPayrolls() → GET /api/payroll/me trả về payrolls', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                payrolls: [{ id: 1, net_salary: '8000000', status: 'paid' }],
            });

            const result = await payrollService.getMyPayrolls();

            expect(mockApi.get).toHaveBeenCalledWith('/api/payroll/me');
            expect(result.payrolls[0].net_salary).toBe('8000000');
        });
    });

    describe('getEstimate', () => {
        it('G62-FE-56: getEstimate(6,2026) → GET /api/payroll/estimate?month=6&year=2026', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                estimated_net: '7500000',
                base_salary:   '5000000',
            });

            const result = await payrollService.getEstimate(6, 2026);

            expect(mockApi.get).toHaveBeenCalledWith('/api/payroll/estimate?month=6&year=2026');
            expect(result.estimated_net).toBe('7500000');
        });
    });

    describe('getAdvances', () => {
        it('G62-FE-57: getAdvances() → GET /api/payroll/advance danh sách ứng lương', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                advances: [{ id: 1, amount: '1000000', status: 'pending' }],
            });

            const result = await payrollService.getAdvances();

            expect(mockApi.get).toHaveBeenCalledWith('/api/payroll/advance');
            expect(Array.isArray(result.advances)).toBe(true);
        });
    });

    describe('requestAdvance', () => {
        it('G62-FE-58: requestAdvance → POST /api/payroll/advance tạo yêu cầu', async () => {
            mockApi.post = jest.fn().mockResolvedValue({
                message: 'OK',
                advance: { id: 2, amount: '1000000', status: 'pending' },
            });

            const result = await payrollService.requestAdvance({
                amount:       1000000,
                requestMonth: 6,
                requestYear:  2026,
            });

            expect(mockApi.post).toHaveBeenCalledWith('/api/payroll/advance', {
                amount:       1000000,
                requestMonth: 6,
                requestYear:  2026,
            });
            expect(result.advance.status).toBe('pending');
        });

        it('G62-FE-59: requestAdvance → status="pending", KHÔNG tự approve', async () => {
            mockApi.post = jest.fn().mockResolvedValue({
                message: 'OK',
                advance: { status: 'pending' },
            });

            const result = await payrollService.requestAdvance({
                amount:       500000,
                requestMonth: 6,
                requestYear:  2026,
            });

            expect(result.advance.status).toBe('pending');
            expect(result.advance.status).not.toBe('approved');
            expect(result.advance.status).not.toBe('paid');
        });
    });
});
