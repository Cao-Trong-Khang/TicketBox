import * as assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  ConcertStatus, OrderStatus, PrismaClient, TicketTypeStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { CheckoutLockService } from './checkout-lock.service';
import { OrdersService } from './orders.service';
import { ReservationReleaseService } from './reservation-release.service';

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
  await redis.evalStrict("return redis.call('del', unpack(redis.call('keys', 'ticketbox:checkout:lock:*')))", [], []).catch(() => undefined);
});

async function fixture(totalQuantity = 10, perUserLimit = 4) {
  const organizer = await prisma.user.create({ data: {
    email: randomUUID() + '@organizer.test', passwordHash: 'hash', displayName: 'Organizer',
  } });
  const buyers = await Promise.all([0, 1, 2].map((index) => prisma.user.create({ data: {
    email: randomUUID() + '-' + index + '@buyer.test', passwordHash: 'hash', displayName: 'Buyer',
  } })));
  const concert = await prisma.concert.create({ data: {
    organizerId: organizer.id, title: 'Concurrency Concert', venueName: 'Arena',
    status: ConcertStatus.PUBLISHED, startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 3_600_000),
  } });
  const ticketType = await prisma.ticketType.create({ data: {
    concertId: concert.id, code: 'CAT1', name: 'CAT1', priceVnd: 100000,
    totalQuantity, soldQuantity: 0, reservedQuantity: 0, perUserLimit,
    saleStartAt: new Date(Date.now() - 60_000), saleEndAt: new Date(Date.now() + 3_600_000),
    status: TicketTypeStatus.ACTIVE,
  } });
  return { organizer, buyers, concert, ticketType };
}

function service(lockService: { withLocks<T>(scopes: string[], operation: () => Promise<T>): Promise<T> }) {
  return new OrdersService(prisma as never, redis, lockService as never);
}

const noOpLocks = { withLocks: async <T>(_scopes: string[], operation: () => Promise<T>) => operation() };

integrationTest('different idempotency keys cannot race past a user limit of four', async () => {
  const { buyers, concert, ticketType } = await fixture();
  const paid = await prisma.order.create({ data: {
    orderCode: 'BASE-' + randomUUID(), userId: buyers[0].id, concertId: concert.id,
    status: OrderStatus.PAID, totalAmountVnd: 200000, expiresAt: new Date(Date.now() + 60_000),
    paidAt: new Date(), idempotencyKey: 'base-paid',
  } });
  await prisma.orderItem.create({ data: {
    orderId: paid.id, ticketTypeId: ticketType.id, quantity: 2,
    unitPriceVnd: 100000, subtotalVnd: 200000,
  } });
  await prisma.ticketType.update({ where: { id: ticketType.id }, data: { soldQuantity: 2 } });

  const orders = service(noOpLocks);
  const attempts = await Promise.allSettled(['concurrent-a', 'concurrent-b'].map((idempotencyKey) =>
    orders.createOrder(buyers[0].id, {
      concertId: concert.id, idempotencyKey,
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
    }),
  ));
  assert.ok(attempts.filter((result) => result.status === 'fulfilled').length <= 1);
  const quota = await prisma.orderItem.aggregate({
    _sum: { quantity: true },
    where: { ticketTypeId: ticketType.id, order: { userId: buyers[0].id, status: { in: [OrderStatus.PAID, OrderStatus.PENDING] } } },
  });
  assert.ok((quota._sum.quantity ?? 0) <= 4);
});

integrationTest('multiple users cannot oversell global inventory and failed races leave no partial rows', async () => {
  const { buyers, concert, ticketType } = await fixture(2, 4);
  const secondType = await prisma.ticketType.create({ data: {
    concertId: concert.id, code: 'CAT2', name: 'CAT2', priceVnd: 120000,
    totalQuantity: 2, soldQuantity: 0, reservedQuantity: 0, perUserLimit: 4,
    saleStartAt: new Date(Date.now() - 60_000), saleEndAt: new Date(Date.now() + 3_600_000),
    status: TicketTypeStatus.ACTIVE,
  } });
  const orders = service(new CheckoutLockService(redis));
  const attempts = await Promise.allSettled(buyers.slice(0, 2).map((buyer, index) =>
    orders.createOrder(buyer.id, {
      concertId: concert.id, idempotencyKey: 'inventory-' + index,
      items: [
        { ticketTypeId: ticketType.id, quantity: 2 },
        { ticketTypeId: secondType.id, quantity: 2 },
      ],
    }),
  ));
  assert.equal(
    attempts.filter((result) => result.status === 'fulfilled').length,
    1,
    attempts.map((result) => result.status === 'rejected' ? String(result.reason) : 'fulfilled').join(' | '),
  );
  const current = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
  assert.ok(current.soldQuantity + current.reservedQuantity <= current.totalQuantity);
  const secondCurrent = await prisma.ticketType.findUniqueOrThrow({ where: { id: secondType.id } });
  assert.ok(secondCurrent.soldQuantity + secondCurrent.reservedQuantity <= secondCurrent.totalQuantity);
  assert.equal(await prisma.orderItem.count(), 2);
});

integrationTest('Redis outage and busy locks fail before PostgreSQL mutation', async () => {
  const { buyers, concert, ticketType } = await fixture();
  const downRedis = new RedisCacheService(new ConfigService({ REDIS_URL: 'redis://127.0.0.1:1' }));
  try {
    const unavailable = service(new CheckoutLockService(downRedis));
    await assert.rejects(unavailable.createOrder(buyers[0].id, {
      concertId: concert.id, idempotencyKey: 'redis-down',
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }));
    assert.equal(await prisma.order.count(), 0);
  } finally {
    downRedis.onModuleDestroy();
  }

  const lockKey = 'ticketbox:checkout:lock:quota:' + buyers[0].id + ':' + concert.id;
  await redis.setStrict(lockKey, 'other-owner', 'PX', 10_000);
  const busy = service(new CheckoutLockService(redis));
  await assert.rejects(busy.createOrder(buyers[0].id, {
    concertId: concert.id, idempotencyKey: 'redis-busy',
    items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
  }));
  assert.equal(await prisma.order.count(), 0);
  await redis.evalStrict("return redis.call('del', KEYS[1])", [lockKey], []);
});

integrationTest('payment failure and expiry release the same reservation exactly once', async () => {
  const { buyers, concert, ticketType } = await fixture();
  const order = await prisma.order.create({ data: {
    orderCode: 'RACE-' + randomUUID(), userId: buyers[0].id, concertId: concert.id,
    status: OrderStatus.PENDING, totalAmountVnd: 200000, expiresAt: new Date(Date.now() - 1),
    idempotencyKey: 'release-race',
  } });
  await prisma.orderItem.create({ data: {
    orderId: order.id, ticketTypeId: ticketType.id, quantity: 2,
    unitPriceVnd: 100000, subtotalVnd: 200000,
  } });
  await prisma.ticketType.update({ where: { id: ticketType.id }, data: { reservedQuantity: 2 } });
  const releases = new ReservationReleaseService(redis);
  const results = await Promise.allSettled([
    prisma.$transaction((tx) => releases.releasePending(tx, order.id, OrderStatus.FAILED)),
    prisma.$transaction((tx) => releases.releasePending(tx, order.id, OrderStatus.EXPIRED)),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled' && result.value.released).length, 1);
  const current = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
  assert.equal(current.reservedQuantity, 0);
});

integrationTest('expired Redis leases and stale availability cache cannot override PostgreSQL authority', async () => {
  const { buyers, concert, ticketType } = await fixture(3, 4);
  const quotaKey = 'ticketbox:checkout:lock:quota:' + buyers[0].id + ':' + concert.id;
  await redis.setStrict(quotaKey, 'stale-owner', 'PX', 40);
  await redis.set('concerts:' + concert.id + ':ticket-types', JSON.stringify([{ id: ticketType.id, availableQuantity: 0 }]), 60);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const orders = service(new CheckoutLockService(redis));
  const created = await orders.createOrder(buyers[0].id, {
    concertId: concert.id, idempotencyKey: 'after-stale-lease',
    items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
  });
  assert.equal(created.status, OrderStatus.PENDING);
  const authoritative = await prisma.ticketType.findUniqueOrThrow({ where: { id: ticketType.id } });
  assert.equal(authoritative.reservedQuantity, 1);
});
