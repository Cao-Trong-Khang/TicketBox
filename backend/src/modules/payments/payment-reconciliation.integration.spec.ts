import * as assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  ConcertStatus, OrderStatus, PaymentProvider, PaymentStatus,
  PrismaClient, TicketTypeStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { ReservationReleaseService } from '../orders/reservation-release.service';
import { PaymentFactory } from './payment.factory';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { PaymentsService } from './payments.service';
import type { NormalizedPaymentResult, PaymentProvider as ProviderContract } from './payment.types';

const integrationTest = process.env.RUN_PAYMENT_INTEGRATION === '1' ? test : test.skip;
const prisma = new PrismaClient();
const redis = new RedisCacheService(new ConfigService({ REDIS_URL: 'redis://localhost:6379' }));

after(async () => {
  redis.onModuleDestroy();
  await prisma.$disconnect();
});

beforeEach(async () => {
  if (process.env.RUN_PAYMENT_INTEGRATION !== '1') return;
  await prisma.ticket.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.concert.deleteMany();
  await prisma.user.deleteMany();
});

async function baseFixture() {
  const organizer = await prisma.user.create({ data: {
    email: randomUUID() + '@organizer.test', passwordHash: 'hash',
  } });
  const buyer = await prisma.user.create({ data: {
    email: randomUUID() + '@buyer.test', passwordHash: 'hash',
  } });
  const concert = await prisma.concert.create({ data: {
    organizerId: organizer.id, title: 'Payment Race', venueName: 'Arena',
    status: ConcertStatus.PUBLISHED, startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 3_600_000),
  } });
  const ticketType = await prisma.ticketType.create({ data: {
    concertId: concert.id, code: 'VIP', name: 'VIP', priceVnd: 150000,
    totalQuantity: 20, reservedQuantity: 0, soldQuantity: 0, perUserLimit: 20,
    saleStartAt: new Date(Date.now() - 60_000), saleEndAt: new Date(Date.now() + 3_600_000),
    status: TicketTypeStatus.ACTIVE,
  } });
  return { buyer, concert, ticketType };
}

async function createAttempt(
  fixture: Awaited<ReturnType<typeof baseFixture>>,
  name: string,
  paymentStatus: PaymentStatus,
  orderStatus: OrderStatus = OrderStatus.PENDING,
  reserve = true,
) {
  const order = await prisma.order.create({ data: {
    orderCode: name + '-' + randomUUID(), userId: fixture.buyer.id, concertId: fixture.concert.id,
    status: orderStatus, totalAmountVnd: 150000,
    expiresAt: orderStatus === OrderStatus.EXPIRED ? new Date(0) : new Date(Date.now() + 60_000),
    idempotencyKey: name,
  } });
  const item = await prisma.orderItem.create({ data: {
    orderId: order.id, ticketTypeId: fixture.ticketType.id, quantity: 1,
    unitPriceVnd: 150000, subtotalVnd: 150000,
  } });
  if (reserve) await prisma.ticketType.update({
    where: { id: fixture.ticketType.id }, data: { reservedQuantity: { increment: 1 } },
  });
  const provider = name.includes('failure') ? PaymentProvider.MOMO : PaymentProvider.VNPAY;
  const payment = await prisma.paymentTransaction.create({ data: {
    orderId: order.id, provider, providerRequestId: name,
    idempotencyKey: 'pay-' + name, requestFingerprint: 'fixture-' + name,
    status: paymentStatus, amountVnd: 150000,
    initiationLeaseUntil: paymentStatus === PaymentStatus.INITIATED ? new Date(0) : null,
    requestedAt: new Date(Date.now() - 120_000),
  } });
  return { order, item, payment };
}

function createServices(results: Map<string, NormalizedPaymentResult | null>) {
  function provider(name: 'vnpay' | 'momo'): ProviderContract {
    return {
      name,
      createPayment: async () => { throw new Error('unused'); },
      verifyAndParseWebhook: () => { throw new Error('unused'); },
      queryPayment: async (request) => results.get(request.providerRequestId) ?? null,
    };
  }
  const factory = new PaymentFactory([provider('vnpay'), provider('momo')]);
  const circuits = {
    execute: async (_provider: string, operation: () => Promise<unknown>) => operation(),
    availability: async () => ({ status: 'available' }),
  };
  const releases = new ReservationReleaseService(redis);
  const payments = new PaymentsService(
    prisma as never, factory, circuits as never, releases,
    { record: () => undefined } as never,
    new ConfigService(),
  );
  const reconciliation = new PaymentReconciliationService(
    prisma as never, factory, payments, circuits as never,
    new ConfigService({ PAYMENT_RECONCILIATION_BATCH_SIZE: 25, PAYMENT_RECONCILIATION_STALE_MS: 1 }),
  );
  return { payments, reconciliation };
}

integrationTest('concurrent callback/reconciliation settlement issues tickets exactly once', async () => {
  const fixture = await baseFixture();
  const attempt = await createAttempt(fixture, 'concurrent-success', PaymentStatus.TIMEOUT);
  const result: NormalizedPaymentResult = {
    provider: 'vnpay', providerRequestId: attempt.payment.providerRequestId,
    providerTransactionId: 'txn-concurrent', amountVnd: 150000, outcome: 'success',
  };
  const { payments } = createServices(new Map());
  const settled = await Promise.allSettled([
    payments.applyResult(attempt.payment.id, result),
    payments.applyResult(attempt.payment.id, result),
  ]);
  assert.ok(settled.some((entry) => entry.status === 'fulfilled'));
  const finalPayment = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: attempt.payment.id } });
  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: attempt.order.id } });
  const inventory = await prisma.ticketType.findUniqueOrThrow({ where: { id: fixture.ticketType.id } });
  assert.equal(finalPayment.status, PaymentStatus.SUCCESS);
  assert.equal(finalOrder.status, OrderStatus.PAID);
  assert.equal(await prisma.ticket.count({ where: { orderId: attempt.order.id } }), 1);
  assert.equal(inventory.reservedQuantity, 0);
  assert.equal(inventory.soldQuantity, 1);
});

integrationTest('reconciliation handles lost callbacks, crashed leases, failure, unknown and late success', async () => {
  const fixture = await baseFixture();
  const lost = await createAttempt(fixture, 'lost-callback', PaymentStatus.PENDING);
  const crashed = await createAttempt(fixture, 'crashed-lease', PaymentStatus.INITIATED);
  const failed = await createAttempt(fixture, 'definitive-failure', PaymentStatus.TIMEOUT);
  const unknown = await createAttempt(fixture, 'unknown-status', PaymentStatus.TIMEOUT);
  const late = await createAttempt(fixture, 'late-success', PaymentStatus.TIMEOUT, OrderStatus.EXPIRED, false);
  const results = new Map<string, NormalizedPaymentResult | null>([
    [lost.payment.providerRequestId, { provider: 'vnpay', providerRequestId: lost.payment.providerRequestId, providerTransactionId: 'txn-lost', amountVnd: 150000, outcome: 'success' }],
    [crashed.payment.providerRequestId, { provider: 'vnpay', providerRequestId: crashed.payment.providerRequestId, providerTransactionId: 'txn-crashed', amountVnd: 150000, outcome: 'success' }],
    [failed.payment.providerRequestId, { provider: 'momo', providerRequestId: failed.payment.providerRequestId, providerTransactionId: 'txn-failed', amountVnd: 150000, outcome: 'failed' }],
    [unknown.payment.providerRequestId, null],
    [late.payment.providerRequestId, { provider: 'vnpay', providerRequestId: late.payment.providerRequestId, providerTransactionId: 'txn-late', amountVnd: 150000, outcome: 'success' }],
  ]);
  const { reconciliation } = createServices(results);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await reconciliation.reconcile();

  const statuses = await prisma.paymentTransaction.findMany({
    where: { id: { in: [lost.payment.id, crashed.payment.id, failed.payment.id, unknown.payment.id, late.payment.id] } },
  });
  const byId = new Map(statuses.map((entry) => [entry.id, entry.status]));
  assert.equal(byId.get(lost.payment.id), PaymentStatus.SUCCESS);
  assert.equal(byId.get(crashed.payment.id), PaymentStatus.SUCCESS);
  assert.equal(byId.get(failed.payment.id), PaymentStatus.FAILED);
  assert.equal(byId.get(unknown.payment.id), PaymentStatus.TIMEOUT);
  assert.equal(byId.get(late.payment.id), PaymentStatus.REQUIRES_REVIEW);
  assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: failed.order.id } })).status, OrderStatus.FAILED);
  assert.equal(await prisma.ticket.count({ where: { orderId: { in: [lost.order.id, crashed.order.id] } } }), 2);
});
