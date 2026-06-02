export type NotificationType =
  | 'TRIP_ASSIGNED'
  | 'TRIP_QUEUED'
  | 'INCIDENT_FEEDBACK'
  | 'ADVANCE_APPROVED'
  | 'ADVANCE_REJECTED'
  | 'PAYSLIP_PUBLISHED'
  | 'SYSTEM_ALERT';

export type AppNotification = {
  id: number | string;
  title: string;
  message: string;
  type: NotificationType | string;
  target_id: number | string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
};
