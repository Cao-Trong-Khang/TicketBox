const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// ------- Types matching backend payment.types.ts -------

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

export type ApiError = {
  message: string;
  statusCode?: number;
};

// ------- API call -------

export async function createPayment(
  request: CreatePaymentRequest,
  signal?: AbortSignal,
): Promise<CreatePaymentResponse> {
  const response = await fetch(`${API_BASE_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const message = typeof body['message'] === 'string' ? body['message'] : `HTTP ${response.status}`;
    const error: Error & { statusCode?: number } = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return response.json() as Promise<CreatePaymentResponse>;
}
