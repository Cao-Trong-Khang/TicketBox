import { randomUUID } from 'node:crypto';
import type { NotificationProvider, SendNotificationRequest, SendNotificationResponse } from '../notification.types';
import type { EmailProviderDependencies } from './provider-context';

export class EmailProvider implements NotificationProvider {
  readonly name = 'email' as const;

  constructor(private readonly dependencies: EmailProviderDependencies) {}

  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const messageId = `email_${randomUUID().replace(/-/g, '')}`;
      const subject = this.buildSubject(request.type);
      const to = String(request.data['email'] ?? '');

      return {
        messageId,
        channel: this.name,
        status: 'sent',
        rawPayload: {
          provider: this.name,
          userId: request.userId,
          type: request.type,
          to,
          subject,
          from: this.dependencies.config.fromAddress,
        },
      };
    });
  }

  private buildSubject(type: string): string {
    const subjects: Record<string, string> = {
      ticket_purchase: 'Your ticket purchase is confirmed',
      event_reminder: 'Reminder: Your upcoming event',
      cancellation: 'Your ticket has been cancelled',
    };

    return subjects[type] ?? `Notification: ${type}`;
  }
}
