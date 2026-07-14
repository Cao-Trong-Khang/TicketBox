import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPayment } from './payment';

describe('secure payment API', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ paymentId: 'pay-1', status: 'pending', paymentUrl: 'https://provider.test' }) }));
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

  it('sends only server-authorized initiation fields', async () => {
    await createPayment({ orderId: 'order-1', provider: 'vnpay', idempotencyKey: 'key-1' });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/payments/initiate');
    expect(JSON.parse(String(init.body))).toEqual({ orderId: 'order-1', provider: 'vnpay', idempotencyKey: 'key-1' });
    expect(String(init.body)).not.toContain('amount');
    expect(String(init.body)).not.toContain('webhookUrl');
  });
});
