import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  NormalizedPaymentResult, PaymentProvider, ProviderPaymentQuery,
  ProviderPaymentRequest, ProviderPaymentResponse,
} from '../payment.types';
import type { PaymentProviderDependencies } from './provider-context';
import { fetchWithDeadline, ProviderBusinessError, ProviderInfrastructureError } from './provider-errors';

export class VnpayProvider implements PaymentProvider {
  readonly name = 'vnpay' as const;
  constructor(private readonly dependencies: PaymentProviderDependencies) {}

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResponse> {
    const params = new URLSearchParams({
      vnp_Version: '2.1.0', vnp_Command: 'pay',
      vnp_TmnCode: this.dependencies.config.tmnCode ?? '',
      vnp_Amount: String(request.amountVnd * 100), vnp_CurrCode: 'VND',
      vnp_TxnRef: request.providerRequestId,
      vnp_OrderInfo: 'TicketBox order ' + request.orderId,
      vnp_OrderType: 'other', vnp_Locale: 'vn',
      vnp_ReturnUrl: request.returnUrl, vnp_IpAddr: '127.0.0.1',
      vnp_CreateDate: this.formatDate(new Date()),
    });
    const canonical = this.canonicalize(Object.fromEntries(params.entries()));
    return {
      paymentUrl: this.dependencies.config.paymentUrl + '?' + canonical + '&vnp_SecureHash=' + this.sign(canonical),
      providerRequestId: request.providerRequestId,
    };
  }

  async queryPayment(request: ProviderPaymentQuery): Promise<NormalizedPaymentResult | null> {
    const now = new Date();
    const fields: Record<string, string> = {
      vnp_RequestId: createHmac('sha256', this.dependencies.config.hashSecret)
        .update(request.providerRequestId + '|' + now.toISOString()).digest('hex').slice(0, 32),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.dependencies.config.tmnCode ?? '',
      vnp_TxnRef: request.providerRequestId,
      vnp_TransactionDate: this.formatDate(request.initiatedAt),
      vnp_CreateDate: this.formatDate(now),
      vnp_IpAddr: '127.0.0.1',
      vnp_OrderInfo: 'Query ' + request.providerRequestId,
    };
    if (request.providerTransactionId) fields.vnp_TransactionNo = request.providerTransactionId;
    const signingOrder = [
      'vnp_RequestId','vnp_Version','vnp_Command','vnp_TmnCode','vnp_TxnRef',
      'vnp_TransactionDate','vnp_CreateDate','vnp_IpAddr','vnp_OrderInfo',
    ];
    const signingData = signingOrder.map((key) => fields[key] ?? '').join('|');
    const response = await fetchWithDeadline(this.dependencies.config.queryUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, vnp_SecureHash: this.sign(signingData) }),
    }, this.dependencies.config.queryTimeoutMs);
    if (response.status >= 500) throw new ProviderInfrastructureError('VNPAY query returned a server error', 'provider_5xx');
    if (!response.ok) throw new ProviderBusinessError('VNPAY_QUERY_REJECTED:' + response.status);
    const data = await response.json() as Record<string, unknown>;
    this.verifyQueryResponse(data);
    const responseCode = String(data.vnp_ResponseCode ?? '');
    const status = String(data.vnp_TransactionStatus ?? '');
    if (responseCode !== '00') return null;
    return {
      provider: this.name,
      providerRequestId: String(data.vnp_TxnRef ?? request.providerRequestId),
      providerTransactionId: data.vnp_TransactionNo ? String(data.vnp_TransactionNo) : undefined,
      amountVnd: Math.round(Number(data.vnp_Amount ?? 0) / 100),
      outcome: status === '00' ? 'success' : ['02', '07', '09'].includes(status) ? 'failed' : 'pending',
      eventId: data.vnp_TransactionNo ? String(data.vnp_TransactionNo) : undefined,
    };
  }

  verifyAndParseWebhook(payload: Record<string, unknown>): NormalizedPaymentResult {
    const signature = String(payload.vnp_SecureHash ?? '');
    const signedFields = Object.fromEntries(Object.entries(payload)
      .filter(([key]) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
      .map(([key, value]) => [key, String(value)]));
    if (!this.safeEqual(signature.toLowerCase(), this.sign(this.canonicalize(signedFields)).toLowerCase())) {
      throw new Error('INVALID_VNPAY_SIGNATURE');
    }
    return {
      provider: this.name,
      providerRequestId: String(payload.vnp_TxnRef ?? ''),
      providerTransactionId: payload.vnp_TransactionNo ? String(payload.vnp_TransactionNo) : undefined,
      amountVnd: Math.round(Number(payload.vnp_Amount ?? 0) / 100),
      outcome: String(payload.vnp_ResponseCode) === '00' && String(payload.vnp_TransactionStatus ?? '00') === '00' ? 'success' : 'failed',
      eventId: payload.vnp_TransactionNo ? String(payload.vnp_TransactionNo) : undefined,
    };
  }

  private verifyQueryResponse(payload: Record<string, unknown>): void {
    const order = [
      'vnp_ResponseId','vnp_Command','vnp_ResponseCode','vnp_Message','vnp_TmnCode',
      'vnp_TxnRef','vnp_Amount','vnp_BankCode','vnp_PayDate','vnp_TransactionNo',
      'vnp_TransactionType','vnp_TransactionStatus','vnp_OrderInfo',
      'vnp_PromotionCode','vnp_PromotionAmount',
    ];
    const data = order.map((key) => String(payload[key] ?? '')).join('|');
    if (!this.safeEqual(String(payload.vnp_SecureHash ?? '').toLowerCase(), this.sign(data).toLowerCase())) {
      throw new Error('INVALID_VNPAY_QUERY_SIGNATURE');
    }
  }

  private canonicalize(values: Record<string, string>): string {
    return Object.entries(values).filter(([, value]) => value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value).replace(/%20/g, '+')).join('&');
  }
  private sign(value: string): string {
    return createHmac('sha512', this.dependencies.config.hashSecret).update(value).digest('hex');
  }
  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private formatDate(date: Date): string {
    const vietnam = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return [
      vietnam.getUTCFullYear(), String(vietnam.getUTCMonth() + 1).padStart(2, '0'),
      String(vietnam.getUTCDate()).padStart(2, '0'), String(vietnam.getUTCHours()).padStart(2, '0'),
      String(vietnam.getUTCMinutes()).padStart(2, '0'), String(vietnam.getUTCSeconds()).padStart(2, '0'),
    ].join('');
  }
}
