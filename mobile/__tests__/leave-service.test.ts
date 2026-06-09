import { leaveService } from '@/services/leave-service';
import { apiClient }    from '@/lib/api-client';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('leaveService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getMyLeaves', () => {
        it('G62-FE-60: getMyLeaves() → GET /api/leave/me không params', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                leaves: [{ id: 1, leave_date: '2026-06-09', leave_type: 'paid', status: 'approved' }],
            });

            const result = await leaveService.getMyLeaves();

            expect(mockApi.get).toHaveBeenCalledWith('/api/leave/me');
            expect(Array.isArray(result.leaves)).toBe(true);
        });

        it('G62-FE-61: getMyLeaves({month:6,year:2026}) → URL có ?month=6&year=2026', async () => {
            mockApi.get = jest.fn().mockResolvedValue({ leaves: [] });

            await leaveService.getMyLeaves({ month: 6, year: 2026 });

            const url: string = (mockApi.get as jest.Mock).mock.calls[0][0];
            expect(url).toContain('month=6');
            expect(url).toContain('year=2026');
        });
    });

    describe('getSummary', () => {
        it('G62-FE-62: getSummary(6,2026) → GET /api/leave/summary?month=6&year=2026', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                total_leaves: '2',
                unpaid_days:  '0',
                paid_days:    '2',
                working_days: 22,
            });

            const result = await leaveService.getSummary(6, 2026);

            expect(mockApi.get).toHaveBeenCalledWith('/api/leave/summary?month=6&year=2026');
            expect(result.working_days).toBe(22);
        });
    });

    describe('create', () => {
        it('G62-FE-63: create(payload) → POST /api/leave tạo đơn nghỉ phép', async () => {
            mockApi.post = jest.fn().mockResolvedValue({
                message: 'OK',
                leave:   { id: 2, status: 'approved' },
            });

            const result = await leaveService.create({
                leaveDate: '2026-06-10',
                leaveType: 'paid',
                reason:    'Lý do cá nhân',
            });

            expect(mockApi.post).toHaveBeenCalledWith('/api/leave', {
                leaveDate: '2026-06-10',
                leaveType: 'paid',
                reason:    'Lý do cá nhân',
            });
            expect(result.leave.id).toBe(2);
        });
    });

    describe('delete', () => {
        it('G62-FE-64: delete(2) → DELETE /api/leave/2 hủy đơn nghỉ', async () => {
            mockApi.delete = jest.fn().mockResolvedValue({ message: 'Deleted' });

            const result = await leaveService.delete(2);

            expect(mockApi.delete).toHaveBeenCalledWith('/api/leave/2');
            expect(result.message).toBe('Deleted');
        });
    });
});
