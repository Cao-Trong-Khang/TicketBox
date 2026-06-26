import { createHmac, randomUUID } from 'node:crypto';
import type { PaymentProvider } from '../payment.types';
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentWebhookPayload,
} from '../payment.types';
import type { PaymentProviderDependencies } from './provider-context';

export class MomoProvider implements PaymentProvider {
  readonly name = 'momo' as const;

  constructor(private readonly dependencies: PaymentProviderDependencies) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return this.dependencies.circuitBreaker.execute(async () => {
      const transactionId = `momo_${randomUUID().replace(/-/g, '')}`;
      const paymentUrl = await this.buildPaymentUrl(request, transactionId);

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

  private async buildPaymentUrl(request: CreatePaymentRequest, transactionId: string): Promise<string> {
    const partnerCode = this.dependencies.config.partnerCode ?? '';
    const accessKey = this.dependencies.config.accessKey ?? '';
    const requestId = transactionId;
    const orderId = transactionId;
    const amount = String(Math.round(request.amount));
    const orderInfo = `Payment for order ${request.orderId}`;
    const redirectUrl = request.returnUrl || this.dependencies.config.returnUrl;
    const ipnUrl = request.webhookUrl || this.dependencies.config.ipnUrl;
    const requestType = 'captureWallet';
    const extraData = '';

    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    const signature = this.signText(rawSignature);

    const requestBody = {
      partnerCode,
      partnerName: 'TicketBox',
      storeId: 'TicketBoxStore',
      requestId,
      amount: Number(amount),
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: 'vi',
      requestType,
      autoCapture: true,
      extraData,
      signature,
    };

    const response = await fetch(this.dependencies.config.paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json() as any;
    if (!response.ok || data.resultCode !== 0) {
      throw new Error(`MoMo API error: ${data.message || 'Unknown error'}`);
    }

    return data.payUrl;
  }

  private signPayload(payload: { providerTransactionId: string; status: string; orderId: string }): string {
    return this.signText(`${payload.orderId}|${payload.providerTransactionId}|${payload.status}`);
  }

  private signText(text: string): string {
    return createHmac('sha256', this.dependencies.config.hashSecret).update(text).digest('hex');
  }
}
