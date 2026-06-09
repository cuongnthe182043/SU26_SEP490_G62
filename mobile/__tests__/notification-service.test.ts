import { notificationService } from '@/services/notification-service';
import { apiClient }            from '@/lib/api-client';

jest.mock('@/lib/api-client');

const mockApi = apiClient as jest.Mocked<typeof apiClient>;

describe('notificationService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('getMyNotifications', () => {
        it('G62-FE-70: getMyNotifications() → GET /api/notifications?page=1&limit=20', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                notifications: [{ id: 1, is_read: false }],
                total: 1,
            });

            const result = await notificationService.getMyNotifications();

            expect(mockApi.get).toHaveBeenCalledWith('/api/notifications?page=1&limit=20');
            expect(Array.isArray(result.notifications)).toBe(true);
        });

        it('G62-FE-71: getMyNotifications(2,10) → URL có page=2&limit=10', async () => {
            mockApi.get = jest.fn().mockResolvedValue({ notifications: [], total: 0 });

            await notificationService.getMyNotifications(2, 10);

            const url: string = (mockApi.get as jest.Mock).mock.calls[0][0];
            expect(url).toContain('page=2');
            expect(url).toContain('limit=10');
        });
    });

    describe('getById', () => {
        it('G62-FE-72: getById(7) → GET /api/notifications/7', async () => {
            mockApi.get = jest.fn().mockResolvedValue({
                notification: { id: 7, is_read: false },
            });

            await notificationService.getById(7);

            expect(mockApi.get).toHaveBeenCalledWith('/api/notifications/7');
        });
    });

    describe('markAsRead', () => {
        it('G62-FE-73: markAsRead(7) → PATCH /api/notifications/7/read', async () => {
            mockApi.patch = jest.fn().mockResolvedValue({
                notification: { id: 7, is_read: true },
            });

            await notificationService.markAsRead(7);

            expect(mockApi.patch).toHaveBeenCalledWith('/api/notifications/7/read', {});
        });
    });

    describe('markAllAsRead', () => {
        it('G62-FE-74: markAllAsRead() → PATCH /api/notifications/read-all', async () => {
            mockApi.patch = jest.fn().mockResolvedValue({ ok: true });

            const result = await notificationService.markAllAsRead();

            expect(mockApi.patch).toHaveBeenCalledWith('/api/notifications/read-all', {});
            expect(result.ok).toBe(true);
        });
    });
});
