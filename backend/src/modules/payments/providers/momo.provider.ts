import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  NormalizedPaymentResult, PaymentProvider, ProviderPaymentQuery,
  ProviderPaymentRequest, ProviderPaymentResponse,
} from '../payment.types';
import type { PaymentProviderDependencies } from './provider-context';
import { fetchWithDeadline, ProviderBusinessError, ProviderInfrastructureError } from './provider-errors';

export class MomoProvider implements PaymentProvider {
  readonly name = 'momo' as const;
  constructor(private readonly dependencies: PaymentProviderDependencies) {}

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResponse> {
    const config = this.dependencies.config;
    const partnerCode = config.partnerCode ?? '';
    const accessKey = config.accessKey ?? '';
    const orderInfo = 'TicketBox order ' + request.orderId;
    const fields = {
      accessKey, amount: String(request.amountVnd), extraData: '', ipnUrl: request.webhookUrl,
      orderId: request.providerRequestId, orderInfo, partnerCode,
      redirectUrl: request.returnUrl, requestId: request.providerRequestId, requestType: 'captureWallet',
    };
    const response = await fetchWithDeadline(config.paymentUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerCode, partnerName: 'TicketBox', storeId: 'TicketBoxStore',
        requestId: request.providerRequestId, amount: request.amountVnd, orderId: request.providerRequestId,
        orderInfo, redirectUrl: request.returnUrl, ipnUrl: request.webhookUrl, lang: 'vi',
        requestType: 'captureWallet', autoCapture: true, extraData: '', signature: this.sign(this.canonical(fields)),
      }),
    }, config.timeoutMs);
    const data = await response.json() as Record<string, unknown>;
    if (response.status >= 500) throw new ProviderInfrastructureError('MoMo returned a server error', 'provider_5xx');
    if (!response.ok || Number(data.resultCode) !== 0 || typeof data.payUrl !== 'string') {
      throw new ProviderBusinessError('MOMO_PROVIDER_DECLINED:' + String(data.resultCode ?? response.status));
    }
    return { paymentUrl: data.payUrl, providerRequestId: request.providerRequestId, rawPayload: data };
  }

  async queryPayment(request: ProviderPaymentQuery): Promise<NormalizedPaymentResult | null> {
    const config = this.dependencies.config;
    const requestId = ('q' + Date.now() + request.providerRequestId.slice(-12)).slice(0, 50);
    const fields = {
      accessKey: config.accessKey ?? '', orderId: request.providerRequestId,
      partnerCode: config.partnerCode ?? '', requestId,
    };
    const response = await fetchWithDeadline(config.queryUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerCode: fields.partnerCode, requestId, orderId: request.providerRequestId,
        lang: 'vi', signature: this.sign(this.canonical(fields)),
      }),
    }, config.queryTimeoutMs);
    if (response.status >= 500) throw new ProviderInfrastructureError('MoMo query returned a server error', 'provider_5xx');
    if (!response.ok) throw new ProviderBusinessError('MOMO_QUERY_REJECTED:' + response.status);
    const data = await response.json() as Record<string, unknown>;
    const resultCode = Number(data.resultCode);
    const pendingCodes = new Set([1000, 7000, 7002, 9000]);
    return {
      provider: this.name,
      providerRequestId: String(data.orderId ?? request.providerRequestId),
      providerTransactionId: data.transId ? String(data.transId) : undefined,
      amountVnd: Number(data.amount ?? 0),
      outcome: resultCode === 0 ? 'success' : pendingCodes.has(resultCode) ? 'pending' : 'failed',
      eventId: data.transId ? String(data.transId) : undefined,
    };
  }

  verifyAndParseWebhook(payload: Record<string, unknown>): NormalizedPaymentResult {
    const signature = String(payload.signature ?? '');
    const fields: Record<string, string> = {};
    for (const key of ['accessKey','amount','extraData','message','orderId','orderInfo','orderType','partnerCode','payType','requestId','responseTime','resultCode','transId']) {
      if (key === 'accessKey') fields[key] = this.dependencies.config.accessKey ?? '';
      else if (payload[key] !== undefined) fields[key] = String(payload[key]);
    }
    if (!this.safeEqual(signature.toLowerCase(), this.sign(this.canonical(fields)).toLowerCase())) {
      throw new Error('INVALID_MOMO_SIGNATURE');
    }
    return {
      provider: this.name, providerRequestId: String(payload.orderId ?? ''),
      providerTransactionId: payload.transId ? String(payload.transId) : undefined,
      amountVnd: Number(payload.amount ?? 0), outcome: Number(payload.resultCode) === 0 ? 'success' : 'failed',
      eventId: payload.transId ? String(payload.transId) : undefined,
    };
  }

  private canonical(values: Record<string, string>): string {
    return Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + '=' + v).join('&');
  }
  private sign(value: string): string {
    return createHmac('sha256', this.dependencies.config.hashSecret).update(value).digest('hex');
  }
  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
