import { randomUUID } from 'node:crypto';
import type { NotificationProvider, SendNotificationRequest, SendNotificationResponse } from '../notification.types';
import type { CircuitBreaker } from '../../../shared/circuit-breaker/circuit-breaker';

export class ZaloProvider implements NotificationProvider {
  readonly name = 'zalo' as const;

  constructor(private readonly dependencies: { circuitBreaker: CircuitBreaker }) {}

  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const messageId = `zalo_${randomUUID().replace(/-/g, '')}`;
      const to = String(request.data['zaloId'] ?? request.data['phone'] ?? '');

      return {
        messageId,
        channel: this.name,
        status: 'sent',
        rawPayload: {
          provider: this.name,
          userId: request.userId,
          type: request.type,
          to,
          body: `Thanh toán đơn hàng thành công trên TicketBox. Mã vé dạng QR Code đã được cập nhật vào ví của bạn.`,
        },
      };
    });
  }
}
