import { useNotificationsContext } from '@/providers/notifications-provider';

export function useNotifications() {
  return useNotificationsContext();
}
