import type { NotificationChannelName, NotificationStatus } from '../notification.types';

export type SendNotificationDto = {
  userId: string;
  type: string;
  data: Record<string, unknown>;
  channels?: NotificationChannelName[];
};

export type SendNotificationResultDto = {
  messageId: string;
  channel: NotificationChannelName;
  status: NotificationStatus;
  rawPayload?: Record<string, unknown>;
};

export type SendNotificationResponseDto = {
  results: SendNotificationResultDto[];
};
