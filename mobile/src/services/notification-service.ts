import { apiClient } from '@/lib/api-client';
import type { NotificationsResponse } from '@/types/notification';

export const notificationService = {
  getMyNotifications: () =>
    apiClient.get<NotificationsResponse>('/api/notifications'),
};
