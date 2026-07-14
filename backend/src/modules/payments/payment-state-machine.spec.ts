import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import type { NormalizedPaymentResult } from './payment.types';

const success: NormalizedPaymentResult = {
  provider: 'vnpay', providerRequestId: 'ref-1', providerTransactionId: 'txn-1',
  amountVnd: 150000, outcome: 'success',
};

function createStateSubject(options: {
  verifier?: () => NormalizedPaymentResult;
  lookupPayment?: Record<string, unknown> | null;
  transactionPayment?: Record<string, unknown>;
  order?: Record<string, unknown>;
} = {}) {
  const paymentUpdates: Array<Record<string, unknown>> = [];
  const releaseCalls: string[] = [];
  const txPayment = options.transactionPayment ?? {
    id: 'pay-1', orderId: 'order-1', provider: PaymentProvider.VNPAY,
    status: PaymentStatus.TIMEOUT, amountVnd: 150000,
  };
  const txOrder = options.order ?? {
    id: 'order-1', userId: 'user-1', concertId: 'concert-1',
    status: OrderStatus.PENDING, expiresAt: new Date(Date.now() + 60_000), items: [],
  };
  const tx = {
    $queryRaw: async () => [],
    paymentTransaction: {
      findUnique: async () => txPayment,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        paymentUpdates.push(data);
        return { ...txPayment, ...data };
      },
    },
    order: {
      findUnique: async () => txOrder,
      updateMany: async () => ({ count: 1 }),
    },
    ticket: { create: async () => ({}) },
    $executeRaw: async () => 1,
  };
  const prisma = {
    paymentTransaction: {
      findUnique: async () => options.lookupPayment === undefined
        ? { id: 'pay-1', provider: PaymentProvider.VNPAY, amountVnd: 150000 }
        : options.lookupPayment,
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
  };
  const provider = {
    name: 'vnpay' as const,
    createPayment: async () => ({ paymentUrl: '', providerRequestId: '' }),
    verifyAndParseWebhook: options.verifier ?? (() => success),
  };
  const factory = { getProvider: () => provider, listProviders: () => ['vnpay'] };
  const releases = {
    releasePending: async (_tx: unknown, orderId: string) => {
      releaseCalls.push(orderId);
      return { released: true, concertId: 'concert-1' };
    },
    invalidateAvailability: async () => undefined,
  };
  const auditEvents: string[] = [];
  const service = new PaymentsService(
    prisma as never, factory as never,
    { execute: async (_provider: string, operation: () => Promise<unknown>) => operation() } as never,
    releases as never,
    { record: (event: string) => auditEvents.push(event) } as never,
    new ConfigService(),
  );
  return { service, paymentUpdates, releaseCalls, auditEvents };
}

test('bad signature and mismatched amount are rejected before settlement', async () => {
  const badSignature = createStateSubject({ verifier: () => { throw new Error('INVALID_SIGNATURE'); } });
  await assert.rejects(badSignature.service.handleWebhook('vnpay', {}), /INVALID_SIGNATURE/);
  assert.ok(badSignature.auditEvents.includes('payment_signature_rejected'));

  const mismatch = createStateSubject({ lookupPayment: { id: 'pay-1', provider: PaymentProvider.VNPAY, amountVnd: 1 } });
  await assert.rejects(mismatch.service.handleWebhook('vnpay', {}), /does not match/);
  assert.ok(mismatch.auditEvents.includes('payment_transition_conflict'));
});

test('pending callback preserves timeout uncertainty without settlement', async () => {
  const context = createStateSubject({ verifier: () => ({ ...success, outcome: 'pending' }) });
  let applied = false;
  context.service.applyResult = async () => { applied = true; };
  const response = await context.service.handleWebhook('vnpay', {});
  assert.deepEqual(response, { status: 'accepted' });
  assert.equal(applied, false);
});

test('verified late success records review and does not issue or release', async () => {
  const context = createStateSubject({
    transactionPayment: { id: 'pay-1', orderId: 'order-1', status: PaymentStatus.TIMEOUT },
    order: {
      id: 'order-1', userId: 'user-1', concertId: 'concert-1',
      status: OrderStatus.EXPIRED, expiresAt: new Date(0), items: [],
    },
  });
  await context.service.applyResult('pay-1', success);
  assert.equal(context.paymentUpdates[0].status, PaymentStatus.REQUIRES_REVIEW);
  assert.equal(context.releaseCalls.length, 0);
  assert.ok(context.auditEvents.includes('payment_requires_review'));
});

test('terminal payment makes duplicate callback a monotonic no-op', async () => {
  const context = createStateSubject({
    transactionPayment: { id: 'pay-1', orderId: 'order-1', status: PaymentStatus.SUCCESS },
  });
  await context.service.applyResult('pay-1', success);
  assert.equal(context.paymentUpdates.length, 0);
  assert.equal(context.releaseCalls.length, 0);
  assert.ok(context.auditEvents.includes('payment_duplicate_result'));
});

test('definitive failure uses the shared one-winner release path', async () => {
  const context = createStateSubject();
  await context.service.applyResult('pay-1', { ...success, outcome: 'failed' });
  assert.equal(context.paymentUpdates[0].status, PaymentStatus.FAILED);
  assert.deepEqual(context.releaseCalls, ['order-1']);
});
