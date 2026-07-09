export type NotificationChannelName = 'email' | 'push' | 'sms' | 'zalo';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export type SendNotificationRequest = {
  userId: string;
  type: string;
  data: Record<string, unknown>;
};

export type SendNotificationResponse = {
  messageId: string;
  channel: NotificationChannelName;
  status: NotificationStatus;
  rawPayload?: Record<string, unknown>;
};

export interface NotificationProvider {
  readonly name: NotificationChannelName;

  send(request: SendNotificationRequest): Promise<SendNotificationResponse>;
}
