import { createHmac, randomUUID } from 'node:crypto';
import type { PaymentProvider } from '../payment.types';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentWebhookPayload,
} from '../payment.types';
import type { PaymentProviderDependencies } from './provider-context';

export class VnpayProvider implements PaymentProvider {
  readonly name = 'vnpay' as const;

  constructor(private readonly dependencies: PaymentProviderDependencies) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const transactionId = `vnp_${randomUUID().replace(/-/g, '')}`;
      const paymentUrl = this.buildPaymentUrl(request, transactionId);

      return {
        paymentUrl,
        providerTransactionId: transactionId,
        rawPayload: {
          provider: this.name,
          orderId: request.orderId,
          amount: request.amount,
        },
      };
    });
  }

  async verifyWebhook(payload: PaymentWebhookPayload): Promise<boolean> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const expectedSignature = this.signPayload({
        providerTransactionId: payload.providerTransactionId,
        status: payload.status,
        orderId: String(payload.rawPayload.orderId ?? ''),
      });

      return payload.signature === expectedSignature;
    });
  }

  private buildPaymentUrl(request: CreatePaymentRequest, transactionId: string): string {
    const params = new URLSearchParams();
    params.set('vnp_Version', '2.1.0');
    params.set('vnp_Command', 'pay');
    params.set('vnp_TmnCode', this.dependencies.config.tmnCode ?? '');
    params.set('vnp_Amount', String(Math.round(request.amount * 100)));
    params.set('vnp_CurrCode', 'VND');
    params.set('vnp_TxnRef', transactionId);
    params.set('vnp_OrderInfo', `Payment for order ${request.orderId}`);
    params.set('vnp_OrderType', 'other');
    params.set('vnp_Locale', 'vn');
    params.set('vnp_ReturnUrl', request.returnUrl || this.dependencies.config.returnUrl);
    params.set('vnp_IpAddr', '127.0.0.1');
    params.set('vnp_CreateDate', this.formatDate(new Date()));

    const sortedParams = [...params.entries()].sort(([left], [right]) => left.localeCompare(right));
    const queryString = sortedParams.map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, '+')}`).join('&');
    const secureHash = this.signText(queryString);

    return `${this.dependencies.config.paymentUrl}?${queryString}&vnp_SecureHash=${secureHash}`;
  }

  private signPayload(payload: { providerTransactionId: string; status: string; orderId: string }): string {
    return this.signText(`${payload.orderId}|${payload.providerTransactionId}|${payload.status}`);
  }

  private signText(text: string): string {
    return createHmac('sha512', this.dependencies.config.hashSecret).update(text).digest('hex');
  }

  private formatDate(date: Date): string {
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`;
  }
}
