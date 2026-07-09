import { randomUUID } from 'node:crypto';
import type { NotificationProvider, SendNotificationRequest, SendNotificationResponse } from '../notification.types';
import type { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker';

export class SmsProvider implements NotificationProvider {
  readonly name = 'sms' as const;

  constructor(private readonly dependencies: { circuitBreaker: CircuitBreaker }) {}

  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const messageId = `sms_${randomUUID().replace(/-/g, '')}`;
      const to = String(request.data['phoneNumber'] ?? request.data['phone'] ?? '');

      return {
        messageId,
        channel: this.name,
        status: 'sent',
        rawPayload: {
          provider: this.name,
          userId: request.userId,
          type: request.type,
          to,
          body: `Mã vé TicketBox của bạn đã được xuất thành công!`,
        },
      };
    });
  }
}
