import { randomUUID } from 'node:crypto';
// @ts-ignore
import * as nodemailer from 'nodemailer';
import type { NotificationProvider, SendNotificationRequest, SendNotificationResponse } from '../notification.types';
import type { EmailProviderDependencies } from './provider-context';

export class EmailProvider implements NotificationProvider {
  readonly name = 'email' as const;
  private transporter: any;

  constructor(private readonly dependencies: EmailProviderDependencies) {
    this.transporter = nodemailer.createTransport({
      host: this.dependencies.config.host,
      port: this.dependencies.config.port,
      secure: this.dependencies.config.port === 465,
      auth: {
        user: this.dependencies.config.user,
        pass: this.dependencies.config.password,
      },
    });
  }

  async send(request: SendNotificationRequest): Promise<SendNotificationResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const messageId = `email_${randomUUID().replace(/-/g, '')}`;
      const subject = this.buildSubject(request.type);
      const to = String(request.data['email'] ?? '');

      let html = `<p>Xin chào,</p><p>Bạn có một thông báo mới từ TicketBox.</p>`;
      
      if (request.type === 'ticket_purchase') {
        html = `
          <h2>Cảm ơn bạn đã đặt vé!</h2>
          <p>Xin chào,</p>
          <p>Đơn hàng đặt vé cho sự kiện <strong>${request.data['concertTitle'] || 'Concert'}</strong> của bạn đã được thanh toán thành công.</p>
          <p><strong>Mã đơn hàng:</strong> ${request.data['orderCode']}</p>
          <p><strong>Tổng tiền:</strong> ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(request.data['amount'] as number)}</p>
          <p>Vui lòng truy cập trang 'Lịch sử Đơn hàng' để xem mã QR Code và e-tickets nhé.</p>
          <br>
          <p>Trân trọng,<br>TicketBox Team</p>
        `;
      }

      const info = await this.transporter.sendMail({
        from: this.dependencies.config.fromAddress,
        to,
        subject,
        html,
      });

      return {
        messageId: info.messageId || messageId,
        channel: this.name,
        status: 'sent',
        rawPayload: {
          provider: this.name,
          userId: request.userId,
          type: request.type,
          to,
          subject,
          from: this.dependencies.config.fromAddress,
          info,
        },
      };
    });
  }

  private buildSubject(type: string): string {
    const subjects: Record<string, string> = {
      ticket_purchase: 'TicketBox: Your ticket purchase is confirmed!',
      event_reminder: 'TicketBox: Reminder for your upcoming event',
      cancellation: 'TicketBox: Your ticket has been cancelled',
    };

    return subjects[type] ?? `TicketBox Notification: ${type}`;
  }
}
