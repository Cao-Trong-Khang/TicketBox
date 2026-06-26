import { randomUUID } from 'node:crypto';
import type { NotificationProvider, SendNotificationRequest, SendNotificationResponse } from '../notification.types';
import type { PushProviderDependencies } from './provider-context';

export class PushProvider implements NotificationProvider {
  readonly name = 'push' as const;

  constructor(private readonly dependencies: PushProviderDependencies) {}

  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const messageId = `push_${randomUUID().replace(/-/g, '')}`;
      const title = this.buildTitle(request.type);
      const deviceToken = String(request.data['deviceToken'] ?? '');

      return {
        messageId,
        channel: this.name,
        status: 'sent',
        rawPayload: {
          provider: this.name,
          userId: request.userId,
          type: request.type,
          deviceToken,
          title,
          projectId: this.dependencies.config.projectId,
        },
      };
    });
  }

  private buildTitle(type: string): string {
    const titles: Record<string, string> = {
      ticket_purchase: 'Ticket Purchase Confirmed',
      event_reminder: 'Upcoming Event Reminder',
      cancellation: 'Ticket Cancelled',
    };

    return titles[type] ?? `Notification: ${type}`;
  }
}
