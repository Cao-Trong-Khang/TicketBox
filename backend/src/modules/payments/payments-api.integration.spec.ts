import * as assert from 'node:assert/strict';
import { after, test } from 'node:test';
import {
  CanActivate, ExecutionContext, ForbiddenException, INestApplication,
  UnauthorizedException, ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ConcertStatus, OrderStatus, PrismaClient, TicketTypeStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { ReservationReleaseService } from '../orders/reservation-release.service';
import { PaymentFactory } from './payment.factory';
import { PaymentsController, PaymentWebhooksController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DeterministicPaymentProvider } from './providers/deterministic-payment.provider';
import { VnpayProvider } from './providers/vnpay.provider';

const integrationTest = process.env.RUN_PAYMENT_INTEGRATION === '1' ? test : test.skip;
const prisma = new PrismaClient();

after(async () => {
  await prisma.$disconnect();
});

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];
    if (!userId) throw new UnauthorizedException();
    request.user = { id: String(userId), email: 'test@example.test' };
    return true;
  }
}

class HeaderPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (request.headers['x-permission'] !== 'ticket:purchase') throw new ForbiddenException();
    return true;
  }
}

class AllowRateLimitGuard implements CanActivate {
  canActivate(): boolean { return true; }
}

integrationTest('payment HTTP contract enforces auth, ownership, validation and signed settlement', async () => {
  await prisma.ticket.deleteMany();
  await prisma.paymentTransaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.ticketType.deleteMany();
  await prisma.concert.deleteMany();
  await prisma.user.deleteMany();

  const organizer = await prisma.user.create({ data: { email: randomUUID() + '@org.test', passwordHash: 'hash' } });
  const owner = await prisma.user.create({ data: { email: randomUUID() + '@owner.test', passwordHash: 'hash' } });
  const other = await prisma.user.create({ data: { email: randomUUID() + '@other.test', passwordHash: 'hash' } });
  const concert = await prisma.concert.create({ data: {
    organizerId: organizer.id, title: 'API Payment', venueName: 'Arena',
    status: ConcertStatus.PUBLISHED, startsAt: new Date(Date.now() - 60_000),
    endsAt: new Date(Date.now() + 3_600_000),
  } });
  const ticketType = await prisma.ticketType.create({ data: {
    concertId: concert.id, code: 'VIP', name: 'VIP', priceVnd: 150000,
    totalQuantity: 10, reservedQuantity: 1, soldQuantity: 0, perUserLimit: 4,
    saleStartAt: new Date(Date.now() - 60_000), saleEndAt: new Date(Date.now() + 3_600_000),
    status: TicketTypeStatus.ACTIVE,
  } });
  const order = await prisma.order.create({ data: {
    orderCode: 'API-' + randomUUID(), userId: owner.id, concertId: concert.id,
    status: OrderStatus.PENDING, totalAmountVnd: 150000,
    expiresAt: new Date(Date.now() + 60_000), idempotencyKey: 'api-order',
  } });
  await prisma.orderItem.create({ data: {
    orderId: order.id, ticketTypeId: ticketType.id, quantity: 1,
    unitPriceVnd: 150000, subtotalVnd: 150000,
  } });

  const runtimeConfig = {
    name: 'vnpay' as const, paymentUrl: 'https://provider.test/pay',
    queryUrl: 'https://provider.test/query', webhookSecret: 'unused',
    returnUrl: 'https://frontend.test/payments/success', ipnUrl: 'https://api.test/webhook',
    tmnCode: 'TMN', hashSecret: 'test-secret', timeoutMs: 1000, queryTimeoutMs: 1000,
  };
  const realProvider = new VnpayProvider({ config: runtimeConfig });
  const fixtureProvider = new DeterministicPaymentProvider(realProvider, runtimeConfig, 'success', 0);
  const factory = new PaymentFactory([fixtureProvider]);
  const redis = new RedisCacheService(new ConfigService({ REDIS_URL: 'redis://localhost:6379' }));
  const service = new PaymentsService(
    prisma as never, factory,
    {
      execute: async (_provider: string, operation: () => Promise<unknown>) => operation(),
      availability: async (provider: string) => ({ provider, status: 'available' }),
    } as never,
    new ReservationReleaseService(redis),
    { record: () => undefined } as never,
    new ConfigService({ FRONTEND_ORIGIN: 'https://frontend.test', PUBLIC_API_ORIGIN: 'https://api.test' }),
  );

  const module = await Test.createTestingModule({
    controllers: [PaymentsController, PaymentWebhooksController],
    providers: [
      { provide: PaymentsService, useValue: service },
      { provide: JwtAuthGuard, useValue: new HeaderAuthGuard() },
      { provide: PermissionsGuard, useValue: new HeaderPermissionGuard() },
      { provide: RateLimitGuard, useValue: new AllowRateLimitGuard() },
    ],
  })
    .overrideGuard(JwtAuthGuard).useValue(new HeaderAuthGuard())
    .overrideGuard(PermissionsGuard).useValue(new HeaderPermissionGuard())
    .overrideGuard(RateLimitGuard).useValue(new AllowRateLimitGuard())
    .compile();
  const app: INestApplication = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.init();

  try {
    await request(app.getHttpServer()).post('/payments/initiate').send({
      orderId: order.id, provider: 'vnpay', idempotencyKey: 'api-payment',
    }).expect(401);
    await request(app.getHttpServer()).post('/payments/initiate')
      .set('x-user-id', owner.id).send({
        orderId: order.id, provider: 'vnpay', idempotencyKey: 'api-payment',
      }).expect(403);
    await request(app.getHttpServer()).post('/payments/initiate')
      .set('x-user-id', other.id).set('x-permission', 'ticket:purchase').send({
        orderId: order.id, provider: 'vnpay', idempotencyKey: 'api-payment-other',
      }).expect(403);
    await request(app.getHttpServer()).post('/payments/initiate')
      .set('x-user-id', owner.id).set('x-permission', 'ticket:purchase').send({
        orderId: order.id, provider: 'vnpay', idempotencyKey: 'api-tampered',
        amountVnd: 1, returnUrl: 'https://attacker.test', webhookUrl: 'https://attacker.test',
      }).expect(400);

    const initiation = await request(app.getHttpServer()).post('/payments/initiate')
      .set('x-user-id', owner.id).set('x-permission', 'ticket:purchase').send({
        orderId: order.id, provider: 'vnpay', idempotencyKey: 'api-payment',
      }).expect(200);
    assert.equal(initiation.body.status, 'pending');
    assert.match(initiation.body.paymentUrl, /^https:\/\/frontend\.test\/payments\/success/);

    await request(app.getHttpServer()).get('/payments/' + initiation.body.paymentId)
      .set('x-user-id', other.id).set('x-permission', 'ticket:purchase').expect(403);
    await request(app.getHttpServer()).post('/payments/confirm')
      .set('x-user-id', owner.id).set('x-permission', 'ticket:purchase').send({ orderId: order.id }).expect(404);

    await request(app.getHttpServer()).post('/payments/webhooks/vnpay')
      .send({ vnp_TxnRef: 'forged', vnp_Amount: '15000000', vnp_SecureHash: 'forged' }).expect(500);

    const persisted = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: initiation.body.paymentId } });
    const callback = fixtureProvider.createSignedCallback(persisted.providerRequestId, 150000, 'success');
    await request(app.getHttpServer()).post('/payments/webhooks/vnpay').send(callback).expect(200);
    const status = await request(app.getHttpServer()).get('/payments/' + initiation.body.paymentId)
      .set('x-user-id', owner.id).set('x-permission', 'ticket:purchase').expect(200);
    assert.equal(status.body.status, 'success');
    assert.equal(status.body.orderStatus, 'PAID');
    assert.equal(await prisma.ticket.count({ where: { orderId: order.id } }), 1);
  } finally {
    await app.close();
    redis.onModuleDestroy();
  }
});
