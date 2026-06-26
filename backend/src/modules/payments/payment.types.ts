export type PaymentProviderName = 'vnpay' | 'momo';

export type PaymentStatus = 'pending' | 'completed' | 'failed';

export type CreatePaymentRequest = {
  orderId: string;
  amount: number;
  returnUrl: string;
  webhookUrl: string;
  customerEmail?: string;
  provider: PaymentProviderName;
};

export type CreatePaymentResponse = {
  paymentUrl: string;
  providerTransactionId: string;
  rawPayload?: Record<string, unknown>;
};

export type PaymentWebhookPayload = {
  providerTransactionId: string;
  status: PaymentStatus;
  signature?: string;
  rawPayload: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse>;

  verifyWebhook(payload: PaymentWebhookPayload): Promise<boolean>;
}
