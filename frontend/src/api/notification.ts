const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ------- Types matching backend notification.types.ts -------

export type NotificationChannelName = 'email' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export type SendNotificationRequest = {
  userId: string;
  type: string;
  data: Record<string, unknown>;
  channels?: NotificationChannelName[];
};

export type SendNotificationResult = {
  messageId: string;
  channel: NotificationChannelName;
  status: NotificationStatus;
  rawPayload?: Record<string, unknown>;
};

export type SendNotificationResponse = {
  results: SendNotificationResult[];
};

export const NOTIFICATION_TYPES = [
  { value: 'ticket_purchase', label: 'Ticket Purchase Confirmed' },
  { value: 'event_reminder', label: 'Event Reminder' },
  { value: 'cancellation', label: 'Ticket Cancelled' },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['value'];

// ------- API call -------

export async function sendNotification(
  request: SendNotificationRequest,
  signal?: AbortSignal,
): Promise<SendNotificationResponse> {
  const response = await fetch(`${API_BASE_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'] : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return response.json() as Promise<SendNotificationResponse>;
}
