import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPayment } from '../api/payment';
import type { CreatePaymentRequest } from '../api/payment';

const BASE_REQUEST: CreatePaymentRequest = {
  provider: 'vnpay',
  orderId: 'order-test-1',
  amount: 150000,
  returnUrl: 'http://localhost:5173/payments/success',
  webhookUrl: 'http://localhost:3000/payments/webhook',
};

describe('createPayment', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          paymentUrl: 'https://sandbox.vnpayment.vn/pay?token=abc',
          providerTransactionId: 'vnp_abc123',
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls POST /payments with correct body', async () => {
    const result = await createPayment(BASE_REQUEST);

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/payments');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      orderId: 'order-test-1',
      provider: 'vnpay',
      amount: 150000,
    });
    expect(result.providerTransactionId).toBe('vnp_abc123');
  });

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid orderId' }),
      }),
    );

    await expect(createPayment(BASE_REQUEST)).rejects.toThrow('Invalid orderId');
  });
});
