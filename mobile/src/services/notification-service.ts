import { apiClient } from '@/lib/api-client';
import type {
  MarkNotificationReadResponse,
  NotificationDetailResponse,
  NotificationsResponse,
} from '@/types/notification';

export const notificationService = {
  getMyNotifications: (page = 1, limit = 20) =>
    apiClient.get<NotificationsResponse>(`/api/notifications?page=${page}&limit=${limit}`),
  getById: (id: number | string) =>
    apiClient.get<NotificationDetailResponse>(`/api/notifications/${id}`),
  markAsRead: (id: number | string) =>
    apiClient.patch<MarkNotificationReadResponse>(`/api/notifications/${id}/read`, {}),
  markAllAsRead: () =>
    apiClient.patch<{ ok: boolean }>('/api/notifications/read-all', {}),
};
