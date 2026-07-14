import { createHmac } from 'node:crypto';
import type {
  NormalizedPaymentResult, PaymentProvider, PaymentProviderName, ProviderPaymentQuery,
  ProviderPaymentRequest, ProviderPaymentResponse,
} from '../payment.types';
import type { PaymentProviderRuntimeConfig } from './provider-context';
import { ProviderInfrastructureError } from './provider-errors';

export type DeterministicBehavior = 'success' | 'failure' | 'pending' | 'timeout' | 'outage';

export class DeterministicPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName;

  constructor(
    private readonly delegate: PaymentProvider,
    private readonly config: PaymentProviderRuntimeConfig,
    private readonly behavior: DeterministicBehavior,
    private readonly delayMs: number,
  ) {
    this.name = delegate.name;
  }

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResponse> {
    await this.controlledDelay();
    this.assertAvailable();
    const separator = request.returnUrl.includes('?') ? '&' : '?';
    return {
      paymentUrl: request.returnUrl + separator + 'demoProvider=' + this.name,
      providerRequestId: request.providerRequestId,
      rawPayload: { deterministic: true },
    };
  }

  async queryPayment(request: ProviderPaymentQuery): Promise<NormalizedPaymentResult | null> {
    await this.controlledDelay();
    this.assertAvailable();
    return {
      provider: this.name,
      providerRequestId: request.providerRequestId,
      providerTransactionId: 'demo-' + request.providerRequestId,
      amountVnd: request.amountVnd,
      outcome: this.behavior === 'success' ? 'success' : this.behavior === 'failure' ? 'failed' : 'pending',
      eventId: 'demo-' + request.providerRequestId,
    };
  }

  verifyAndParseWebhook(payload: Record<string, unknown>): NormalizedPaymentResult {
    return this.delegate.verifyAndParseWebhook(payload);
  }

  createSignedCallback(reference: string, amountVnd: number, outcome: 'success' | 'failed'): Record<string, unknown> {
    return this.name === 'vnpay'
      ? this.createVnpayCallback(reference, amountVnd, outcome)
      : this.createMomoCallback(reference, amountVnd, outcome);
  }

  private async controlledDelay(): Promise<void> {
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }

  private assertAvailable(): void {
    if (this.behavior === 'timeout') throw new ProviderInfrastructureError('Deterministic provider timeout', 'timeout');
    if (this.behavior === 'outage') throw new ProviderInfrastructureError('Deterministic provider outage', 'provider_5xx');
  }

  private createVnpayCallback(reference: string, amountVnd: number, outcome: 'success' | 'failed'): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      vnp_Amount: String(amountVnd * 100),
      vnp_ResponseCode: outcome === 'success' ? '00' : '24',
      vnp_TransactionStatus: outcome === 'success' ? '00' : '02',
      vnp_TxnRef: reference,
      vnp_TransactionNo: 'demo-' + reference,
    };
    const canonical = Object.entries(payload)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value)).replace(/%20/g, '+'))
      .join('&');
    payload.vnp_SecureHash = createHmac('sha512', this.config.hashSecret).update(canonical).digest('hex');
    return payload;
  }

  private createMomoCallback(reference: string, amountVnd: number, outcome: 'success' | 'failed'): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      amount: amountVnd, extraData: '', message: outcome === 'success' ? 'Successful.' : 'Failed.',
      orderId: reference, orderInfo: 'TicketBox demo', orderType: 'momo_wallet',
      partnerCode: this.config.partnerCode ?? '', payType: 'qr', requestId: reference,
      responseTime: Date.now(), resultCode: outcome === 'success' ? 0 : 1006,
      transId: 'demo-' + reference,
    };
    const signed: Record<string, unknown> = { accessKey: this.config.accessKey ?? '', ...payload };
    const canonical = Object.entries(signed)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => key + '=' + String(value))
      .join('&');
    payload.signature = createHmac('sha256', this.config.hashSecret).update(canonical).digest('hex');
    return payload;
  }
}
