import { apiFetch } from '../lib/api-client';

export type PaymentProviderName = 'vnpay' | 'momo';
export type PaymentState = 'initiated' | 'pending' | 'success' | 'failed' | 'timeout' | 'requires_review';
export type InitiatePaymentRequest = { orderId: string; provider: PaymentProviderName; idempotencyKey: string };
export type PaymentResponse = { paymentId: string; orderId: string; provider: PaymentProviderName; status: PaymentState; orderStatus?: string; paymentUrl: string | null; failureCode: string | null };
export type ProviderAvailability = { provider: PaymentProviderName; status: 'available' | 'temporarily_unavailable'; retryAfterSeconds?: number };

export function createPayment(request: InitiatePaymentRequest): Promise<PaymentResponse> {
  return apiFetch('/payments/initiate', { method: 'POST', body: JSON.stringify(request) });
}
export function getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
  return apiFetch(`/payments/${encodeURIComponent(paymentId)}`);
}
export function getPaymentProviders(): Promise<ProviderAvailability[]> {
  return apiFetch('/payments/providers');
}
