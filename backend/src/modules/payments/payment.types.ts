export type PaymentProviderName = 'vnpay' | 'momo';

export type PaymentOutcome = 'success' | 'failed' | 'pending';

export type ProviderPaymentRequest = {
  orderId: string;
  amountVnd: number;
  providerRequestId: string;
  returnUrl: string;
  webhookUrl: string;
  customerEmail?: string;
};

export type ProviderPaymentResponse = {
  paymentUrl: string;
  providerRequestId: string;
  rawPayload?: Record<string, unknown>;
};

export type ProviderPaymentQuery = {
  providerRequestId: string;
  providerTransactionId?: string | null;
  initiatedAt: Date;
  amountVnd: number;
};

export type NormalizedPaymentResult = {
  provider: PaymentProviderName;
  providerRequestId: string;
  providerTransactionId?: string;
  amountVnd: number;
  outcome: PaymentOutcome;
  eventId?: string;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(request: ProviderPaymentRequest): Promise<ProviderPaymentResponse>;
  verifyAndParseWebhook(payload: Record<string, unknown>): NormalizedPaymentResult;
  queryPayment?(request: ProviderPaymentQuery): Promise<NormalizedPaymentResult | null>;
}

export type PaymentAvailability = {
  provider: PaymentProviderName;
  status: 'available' | 'temporarily_unavailable';
  retryAfterSeconds?: number;
};
