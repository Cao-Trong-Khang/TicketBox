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
      } else if (request.type === 'event_reminder') {
        const startsAt = request.data['startsAt'] ? new Date(request.data['startsAt'] as string).toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' }) : 'sắp tới';
        html = `
          <h2>Nhắc nhở sự kiện sắp diễn ra!</h2>
          <p>Xin chào,</p>
          <p>Sự kiện <strong>${request.data['concertTitle']}</strong> mà bạn đã mua vé sẽ diễn ra vào lúc <strong>${startsAt}</strong>.</p>
          <p><strong>Địa điểm:</strong> ${request.data['venueName'] || 'Vui lòng kiểm tra lại trên Website'}</p>
          <p>Hãy chuẩn bị sẵn mã QR Code trong trang 'Lịch sử Đơn hàng' để được quét mã check-in tại cổng nhé!</p>
          <br>
          <p>Chúc bạn có một trải nghiệm thật tuyệt vời,<br>TicketBox Team</p>
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
      ticket_purchase: 'TicketBox: Hoàn tất thanh toán thành công!',
      event_reminder: 'TicketBox: Nhắc nhở sự kiện sắp bắt đầu (trong 24h tới)',
      cancellation: 'TicketBox: Hoàn tất hủy vé',
    };

    return subjects[type] ?? `TicketBox Notification: ${type}`;
  }
}
