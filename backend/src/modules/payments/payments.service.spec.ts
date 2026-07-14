import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { ProviderInfrastructureError } from './providers/provider-errors';

const order = {
  id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING,
  expiresAt: new Date(Date.now() + 60_000), totalAmountVnd: 150000,
  user: { email: 'audience@example.test' },
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1', orderId: order.id, provider: PaymentProvider.VNPAY,
    providerRequestId: 'stable-provider-ref', idempotencyKey: 'idem-1',
    requestFingerprint: '',
    status: PaymentStatus.INITIATED, amountVnd: order.totalAmountVnd,
    paymentUrl: null, failureCode: null, initiationLeaseUntil: new Date(Date.now() + 30_000),
    ...overrides,
  };
}

function createSubject(options: {
  order?: typeof order | null;
  createPayment?: () => Promise<ReturnType<typeof payment>>;
  existing?: ReturnType<typeof payment> | null;
  leaseWon?: boolean;
  providerError?: Error;
} = {}) {
  const providerCalls: Array<Record<string, unknown>> = [];
  const created = payment({ requestFingerprint: 'created' });
  let latest = created;
  const prisma = {
    order: { findUnique: async () => options.order === undefined ? order : options.order },
    paymentTransaction: {
      create: async () => {
        if (options.createPayment) return options.createPayment();
        return created;
      },
      findUnique: async () => options.existing ?? null,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        if ('paymentUrl' in data || 'failureCode' in data) latest = { ...latest, ...data };
        return { count: options.leaseWon === false ? 0 : 1 };
      },
      findUniqueOrThrow: async () => latest,
    },
  };
  const provider = {
    name: 'vnpay' as const,
    createPayment: async (request: Record<string, unknown>) => {
      providerCalls.push(request);
      if (options.providerError) throw options.providerError;
      return { paymentUrl: 'https://provider.test/pay', providerRequestId: String(request.providerRequestId) };
    },
    verifyAndParseWebhook: () => { throw new Error('unused'); },
  };
  const factory = { getProvider: () => provider, listProviders: () => ['vnpay', 'momo'] };
  const circuits = { execute: async (_name: string, operation: () => Promise<unknown>) => operation(), availability: async () => ({ status: 'available' }) };
  const releases = { invalidateAvailability: async () => undefined };
  const observability = { record: () => undefined };
  const service = new PaymentsService(
    prisma as never, factory as never, circuits as never, releases as never,
    observability as never,
    new ConfigService({ FRONTEND_ORIGIN: 'https://frontend.test', PUBLIC_API_ORIGIN: 'https://api.test' }),
  );
  return { service, providerCalls, prisma, created };
}

test('initiation rejects a non-owner before provider contact', async () => {
  const context = createSubject({ order: { ...order, userId: 'another-user' } });
  await assert.rejects(context.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' }), /does not belong/);
  assert.equal(context.providerCalls.length, 0);
});

test('initiation derives amount and callback URLs from server state', async () => {
  const context = createSubject();
  await context.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' });
  assert.equal(context.providerCalls.length, 1);
  assert.equal(context.providerCalls[0].amountVnd, 150000);
  assert.equal(context.providerCalls[0].returnUrl, 'https://frontend.test/payments/success?paymentId=payment-1');
  assert.equal(context.providerCalls[0].webhookUrl, 'https://api.test/payments/webhooks/vnpay');
});

test('exact replay returns persisted state without another provider call', async () => {
  const fingerprint = require('node:crypto').createHash('sha256')
    .update('user-1|order-1|vnpay|150000').digest('hex');
  const unique = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  const context = createSubject({
    createPayment: async () => { throw unique; },
    existing: payment({ requestFingerprint: fingerprint, status: PaymentStatus.PENDING, paymentUrl: 'https://provider.test/existing' }),
  });
  const result = await context.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' });
  assert.equal(result.paymentUrl, 'https://provider.test/existing');
  assert.equal(context.providerCalls.length, 0);
});

test('conflicting idempotency reuse returns conflict', async () => {
  const unique = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  const context = createSubject({
    createPayment: async () => { throw unique; },
    existing: payment({ requestFingerprint: 'different-request' }),
  });
  await assert.rejects(context.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' }), /another payment/);
});

test('expired lease recovery reuses stable provider identity while an active lease does not call twice', async () => {
  const fingerprint = require('node:crypto').createHash('sha256')
    .update('user-1|order-1|vnpay|150000').digest('hex');
  const unique = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
  const recovered = createSubject({
    createPayment: async () => { throw unique; },
    existing: payment({ requestFingerprint: fingerprint, initiationLeaseUntil: new Date(0) }),
  });
  await recovered.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' });
  assert.equal(recovered.providerCalls[0].providerRequestId, 'stable-provider-ref');

  const concurrent = createSubject({
    createPayment: async () => { throw unique; },
    existing: payment({ requestFingerprint: fingerprint, initiationLeaseUntil: new Date(Date.now() + 60_000) }),
    leaseWon: false,
  });
  await concurrent.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' });
  assert.equal(concurrent.providerCalls.length, 0);
});

test('provider infrastructure failure is mapped to retryable service unavailable', async () => {
  const context = createSubject({ providerError: new ProviderInfrastructureError('timeout', 'timeout') });
  await assert.rejects(
    context.service.initiate('user-1', { orderId: order.id, provider: 'vnpay', idempotencyKey: 'idem-1' }),
    (error: unknown) => typeof error === 'object' && error !== null && 'getStatus' in error && (error as { getStatus(): number }).getStatus() === 503,
  );
});
