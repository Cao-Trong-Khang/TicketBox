import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { VnpayProvider } from './providers/vnpay.provider';
import { MomoProvider } from './providers/momo.provider';
import { DeterministicPaymentProvider } from './providers/deterministic-payment.provider';

const common = {
  paymentUrl: 'https://provider.test/pay',
  queryUrl: 'https://provider.test/query',
  webhookSecret: 'unused',
  returnUrl: 'http://web/return',
  ipnUrl: 'http://api/ipn',
  timeoutMs: 1000,
  queryTimeoutMs: 1000,
};

test('VNPAY verifies canonical signature and normalizes amount', () => {
  const provider = new VnpayProvider({ config: { name: 'vnpay', ...common, hashSecret: 'secret', tmnCode: 'TMN' } });
  const payload: Record<string, unknown> = { vnp_Amount: '12500000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TxnRef: 'tbx_ref', vnp_TransactionNo: 'txn_1' };
  const canonical = Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`).join('&');
  payload.vnp_SecureHash = createHmac('sha512', 'secret').update(canonical).digest('hex');
  assert.deepEqual(provider.verifyAndParseWebhook(payload), { provider: 'vnpay', providerRequestId: 'tbx_ref', providerTransactionId: 'txn_1', amountVnd: 125000, outcome: 'success', eventId: 'txn_1' });
  payload.vnp_Amount = '99900';
  assert.throws(() => provider.verifyAndParseWebhook(payload), /INVALID_VNPAY_SIGNATURE/);
});

test('MoMo rejects unsigned callback and accepts documented canonical fields', () => {
  const provider = new MomoProvider({ config: { name: 'momo', ...common, hashSecret: 'secret', partnerCode: 'MOMO', accessKey: 'access' } });
  const payload: Record<string, unknown> = { amount: 125000, extraData: '', message: 'Successful.', orderId: 'tbx_ref', orderInfo: 'TicketBox', orderType: 'momo_wallet', partnerCode: 'MOMO', payType: 'qr', requestId: 'tbx_ref', responseTime: 1, resultCode: 0, transId: 'txn_2' };
  const signed = { accessKey: 'access', ...payload };
  payload.signature = createHmac('sha256', 'secret').update(Object.entries(signed).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&')).digest('hex');
  assert.equal(provider.verifyAndParseWebhook(payload).outcome, 'success');
  payload.signature = 'forged';
  assert.throws(() => provider.verifyAndParseWebhook(payload), /INVALID_MOMO_SIGNATURE/);
});

test('VNPAY initiation uses the server amount and stable request reference', async () => {
  const provider = new VnpayProvider({ config: { name: 'vnpay', ...common, hashSecret: 'secret', tmnCode: 'TMN' } });
  const result = await provider.createPayment({ orderId: 'order-1', amountVnd: 150000, providerRequestId: 'stable-ref', returnUrl: 'http://trusted/return', webhookUrl: 'http://trusted/ipn' });
  assert.match(result.paymentUrl, /vnp_Amount=15000000/);
  assert.match(result.paymentUrl, /vnp_TxnRef=stable-ref/);
  assert.equal(result.providerRequestId, 'stable-ref');
});

test('MoMo query signs the authoritative reference and preserves pending evidence', async () => {
  const provider = new MomoProvider({ config: { name: 'momo', ...common, hashSecret: 'secret', partnerCode: 'MOMO', accessKey: 'access' } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const canonical = 'accessKey=access&orderId=stable-ref&partnerCode=MOMO&requestId=' + body.requestId;
    assert.equal(body.signature, createHmac('sha256', 'secret').update(canonical).digest('hex'));
    return new Response(JSON.stringify({ orderId: 'stable-ref', amount: 150000, resultCode: 1000 }), { status: 200 });
  };
  try {
    const result = await provider.queryPayment({ providerRequestId: 'stable-ref', initiatedAt: new Date(), amountVnd: 150000 });
    assert.equal(result?.outcome, 'pending');
    assert.equal(result?.amountVnd, 150000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('VNPAY query verifies its response signature before returning success', async () => {
  const provider = new VnpayProvider({ config: { name: 'vnpay', ...common, hashSecret: 'secret', tmnCode: 'TMN' } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const payload: Record<string, unknown> = {
      vnp_ResponseId: 'response-1', vnp_Command: 'querydr', vnp_ResponseCode: '00',
      vnp_Message: 'Success', vnp_TmnCode: 'TMN', vnp_TxnRef: 'stable-ref',
      vnp_Amount: '15000000', vnp_BankCode: 'NCB', vnp_PayDate: '20260714120000',
      vnp_TransactionNo: '1234', vnp_TransactionType: '01',
      vnp_TransactionStatus: '00', vnp_OrderInfo: 'TicketBox', vnp_PromotionCode: '',
      vnp_PromotionAmount: '',
    };
    const order = [
      'vnp_ResponseId','vnp_Command','vnp_ResponseCode','vnp_Message','vnp_TmnCode',
      'vnp_TxnRef','vnp_Amount','vnp_BankCode','vnp_PayDate','vnp_TransactionNo',
      'vnp_TransactionType','vnp_TransactionStatus','vnp_OrderInfo',
      'vnp_PromotionCode','vnp_PromotionAmount',
    ];
    payload.vnp_SecureHash = createHmac('sha512', 'secret')
      .update(order.map((key) => String(payload[key] ?? '')).join('|')).digest('hex');
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  try {
    const result = await provider.queryPayment({ providerRequestId: 'stable-ref', initiatedAt: new Date(), amountVnd: 150000 });
    assert.equal(result?.outcome, 'success');
    assert.equal(result?.amountVnd, 150000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deterministic fixture creates signed callbacks accepted by the real adapters', () => {
  const config = { name: 'momo' as const, ...common, hashSecret: 'secret', partnerCode: 'MOMO', accessKey: 'access' };
  const real = new MomoProvider({ config });
  const fixture = new DeterministicPaymentProvider(real, config, 'success', 0);
  const callback = fixture.createSignedCallback('stable-ref', 150000, 'success');
  assert.deepEqual(fixture.verifyAndParseWebhook(callback), {
    provider: 'momo', providerRequestId: 'stable-ref',
    providerTransactionId: 'demo-stable-ref', amountVnd: 150000,
    outcome: 'success', eventId: 'demo-stable-ref',
  });
});

test('deterministic fixture exposes controlled outage and recovery outcomes', async () => {
  const config = { name: 'vnpay' as const, ...common, hashSecret: 'secret', tmnCode: 'TMN' };
  const real = new VnpayProvider({ config });
  const outage = new DeterministicPaymentProvider(real, config, 'outage', 0);
  await assert.rejects(outage.createPayment({
    orderId: 'order-1', amountVnd: 150000, providerRequestId: 'stable-ref',
    returnUrl: 'http://trusted/return', webhookUrl: 'http://trusted/ipn',
  }), /Deterministic provider outage/);
  const recovered = new DeterministicPaymentProvider(real, config, 'success', 0);
  const result = await recovered.queryPayment({
    providerRequestId: 'stable-ref', amountVnd: 150000, initiatedAt: new Date(),
  });
  assert.equal(result?.outcome, 'success');
});
