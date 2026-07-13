import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma, RefreshToken, Role, User, UserRole, UserStatus } from '@prisma/client';
import request = require('supertest');
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { OrganizerConcertsService } from '../concerts/organizer-concerts.service';
import { OrganizerTicketTypesService } from '../concerts/organizer-ticket-types.service';
import { ConcertsModule } from '../concerts/concerts.module';
import { OrdersService } from '../orders/orders.service';
import { OrdersModule } from '../orders/orders.module';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { PermissionService } from '../rbac/permission.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RATE_LIMIT_EXCEEDED_MESSAGE } from './rate-limit.constants';

type TestState = {
  roles: Role[];
  userRoles: UserRole[];
  users: User[];
  refreshTokens: RefreshToken[];
};

test('rate limiting protects auth, orders, and organizer mutations with 429 responses', async () => {
  process.env.JWT_ACCESS_SECRET = 'test-jwt-secret';
  process.env.JWT_ACCESS_TOKEN_TTL = '1h';

  const state = createSeededState();
  const prisma = createPrismaMock(state);
  const redis = createRedisCacheMock();
  const app = await createTestApp(prisma, redis);

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .set('x-forwarded-for', '10.0.0.1')
        .send({
          email: `fan${attempt}@ticketbox.test`,
          password: 'strong-password',
        })
        .expect(201);
    }

    const register429 = await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-forwarded-for', '10.0.0.1')
      .send({
        email: 'fan4@ticketbox.test',
        password: 'strong-password',
      })
      .expect(429);

    assert.equal(register429.body.message, RATE_LIMIT_EXCEEDED_MESSAGE);
    assert.ok(Number(register429.headers['retry-after']) > 0);

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('x-forwarded-for', '10.0.0.2')
      .send({
        email: 'order-user@ticketbox.test',
        password: 'strong-password',
      })
      .expect(201);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('x-forwarded-for', '10.0.0.3')
        .send({
          email: 'fan0@ticketbox.test',
          password: 'strong-password',
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.0.3')
      .send({
        email: 'fan0@ticketbox.test',
        password: 'strong-password',
      })
      .expect(429);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-forwarded-for', '10.0.0.4')
      .send({
        email: 'order-user@ticketbox.test',
        password: 'strong-password',
      })
      .expect(201);

    const accessToken = loginResponse.body.accessToken as string;
    assert.equal(typeof accessToken, 'string');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', `20.0.0.${attempt + 1}`)
        .send(createOrderPayload(attempt))
        .expect(200);
    }

    const orders429 = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-forwarded-for', '21.0.0.1')
      .send(createOrderPayload(9))
      .expect(429);

    assert.equal(orders429.body.message, RATE_LIMIT_EXCEEDED_MESSAGE);
    assert.ok(Number(orders429.headers['retry-after']) > 0);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app.getHttpServer())
        .post('/organizer/concerts')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-forwarded-for', `30.0.0.${attempt + 1}`)
        .send({
          title: `Concert ${attempt}`,
          artistName: 'Artist',
          venueName: 'Venue',
          venueAddress: 'Address',
          startsAt: '2099-08-01T12:00:00.000Z',
          endsAt: '2099-08-01T15:00:00.000Z',
          performanceStartAt: '2099-08-01T19:00:00.000Z',
        })
        .expect(201);
    }

    const organizer429 = await request(app.getHttpServer())
      .post('/organizer/concerts')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-forwarded-for', '31.0.0.1')
      .send({
        title: 'Concert blocked',
        artistName: 'Artist',
        venueName: 'Venue',
        venueAddress: 'Address',
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
      })
      .expect(429);

    assert.equal(organizer429.body.message, RATE_LIMIT_EXCEEDED_MESSAGE);
    assert.ok(Number(organizer429.headers['retry-after']) > 0);
  } finally {
    await app.close();
  }
});

async function createTestApp(
  prisma: Partial<PrismaService>,
  redis: Partial<RedisCacheService>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
      }),
      AuthModule,
      OrdersModule,
      ConcertsModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(RedisCacheService)
    .useValue(redis)
    .overrideProvider(PermissionService)
    .useValue({ userHasPermissions: async () => true })
    .overrideProvider(OrdersService)
    .useValue({
      createOrder: async (userId: string) => ({
        orderId: `order-${userId}`,
        orderCode: 'TBX-ORDER',
        status: 'PENDING',
        totalAmountVnd: 100000,
        expiresAt: '2099-08-01T12:15:00.000Z',
      }),
    })
    .overrideProvider(OrganizerConcertsService)
    .useValue({
      listOwnedConcerts: async () => [],
      createConcert: async (userId: string, dto: Record<string, unknown>) => ({
        id: 'concert-id',
        status: 'PUBLISHED',
        lifecycleStatus: 'UPCOMING',
        title: dto.title,
        artistName: dto.artistName,
        description: null,
        venueName: dto.venueName,
        venueAddress: dto.venueAddress,
        bannerUrl: null,
        seatingSvg: null,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        performanceStartAt: dto.performanceStartAt,
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
        organizerId: userId,
      }),
      getOwnedConcert: async () => ({
        id: 'concert-id',
        status: 'PUBLISHED',
        lifecycleStatus: 'UPCOMING',
        title: 'Concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: null,
        seatingSvg: null,
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      updateOwnedConcert: async () => ({
        id: 'concert-id',
        status: 'PUBLISHED',
        lifecycleStatus: 'UPCOMING',
        title: 'Concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: null,
        seatingSvg: null,
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      cancelOwnedConcert: async () => ({
        id: 'concert-id',
        status: 'CANCELLED',
        lifecycleStatus: 'UPCOMING',
        title: 'Concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: null,
        seatingSvg: null,
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      ensureOrganizerRole: async () => undefined,
      findOwnedConcertOrThrow: async () => ({
        id: 'concert-id',
        organizerId: 'user-1',
        status: 'PUBLISHED',
        title: 'Concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: null,
        seatingSvg: null,
        startsAt: new Date('2099-08-01T12:00:00.000Z'),
        endsAt: new Date('2099-08-01T15:00:00.000Z'),
        performanceStartAt: new Date('2099-08-01T19:00:00.000Z'),
        createdAt: new Date('2099-08-01T10:00:00.000Z'),
        updatedAt: new Date('2099-08-01T10:00:00.000Z'),
      }),
    })
    .overrideProvider(OrganizerTicketTypesService)
    .useValue({
      listOwnedConcertTicketTypes: async () => [],
      createOwnedConcertTicketType: async () => ({
        id: 'ticket-type-id',
        code: 'GA',
        name: 'General Admission',
        priceVnd: 100000,
        totalQuantity: 100,
        reservedQuantity: 0,
        soldQuantity: 0,
        availableQuantity: 100,
        perUserLimit: 4,
        saleStartAt: '2099-08-01T10:00:00.000Z',
        saleEndAt: '2099-08-01T12:00:00.000Z',
        status: 'INACTIVE',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      updateOwnedConcertTicketType: async () => ({
        id: 'ticket-type-id',
        code: 'GA',
        name: 'General Admission',
        priceVnd: 100000,
        totalQuantity: 100,
        reservedQuantity: 0,
        soldQuantity: 0,
        availableQuantity: 100,
        perUserLimit: 4,
        saleStartAt: '2099-08-01T10:00:00.000Z',
        saleEndAt: '2099-08-01T12:00:00.000Z',
        status: 'INACTIVE',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      activateOwnedConcertTicketType: async () => ({
        id: 'ticket-type-id',
        code: 'GA',
        name: 'General Admission',
        priceVnd: 100000,
        totalQuantity: 100,
        reservedQuantity: 0,
        soldQuantity: 0,
        availableQuantity: 100,
        perUserLimit: 4,
        saleStartAt: '2099-08-01T10:00:00.000Z',
        saleEndAt: '2099-08-01T12:00:00.000Z',
        status: 'ACTIVE',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
      deactivateOwnedConcertTicketType: async () => ({
        id: 'ticket-type-id',
        code: 'GA',
        name: 'General Admission',
        priceVnd: 100000,
        totalQuantity: 100,
        reservedQuantity: 0,
        soldQuantity: 0,
        availableQuantity: 100,
        perUserLimit: 4,
        saleStartAt: '2099-08-01T10:00:00.000Z',
        saleEndAt: '2099-08-01T12:00:00.000Z',
        status: 'INACTIVE',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }),
    })
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();

  return app;
}

function createSeededState(): TestState {
  const now = new Date();

  return {
    users: [],
    refreshTokens: [],
    roles: [
      {
        id: 'role-audience',
        code: ROLE_CODES.audience,
        name: 'Audience',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'role-organizer',
        code: ROLE_CODES.organizer,
        name: 'Organizer',
        createdAt: now,
        updatedAt: now,
      },
    ],
    userRoles: [],
  };
}

function createPrismaMock(state: TestState): Partial<PrismaService> {
  const tx = {
    user: {
      create: async ({ data }: { data: Prisma.UserCreateInput }) => {
        if (state.users.some((user) => user.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on email', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['email'] },
          });
        }

        const now = new Date();
        const user: User = {
          id: `00000000-0000-0000-0000-00000000000${state.users.length + 1}`,
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: typeof data.displayName === 'string' ? data.displayName : null,
          status: UserStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        };

        state.users.push(user);
        const audienceRole = state.roles.find((role) => role.code === ROLE_CODES.audience);
        assert.ok(audienceRole);
        state.userRoles.push({
          userId: user.id,
          roleId: audienceRole.id,
          createdAt: now,
        });

        return user;
      },
      findUnique: async ({ where }: { where: Prisma.UserWhereUniqueInput }) => {
        return state.users.find((user) => user.email === where.email || user.id === where.id) ?? null;
      },
    },
    role: {
      findUnique: async ({ where }: { where: Prisma.RoleWhereUniqueInput }) => {
        return state.roles.find((role) => role.code === where.code || role.id === where.id) ?? null;
      },
    },
    userRole: {
      create: async ({ data }: { data: Prisma.UserRoleUncheckedCreateInput }) => {
        const userRole: UserRole = {
          userId: data.userId,
          roleId: data.roleId,
          createdAt: new Date(),
        };

        state.userRoles.push(userRole);
        return userRole;
      },
      findMany: async ({
        where,
        select,
        include,
      }: {
        where: Prisma.UserRoleWhereInput;
        select?: Prisma.UserRoleSelect;
        include?: Prisma.UserRoleInclude;
      }) => {
        return state.userRoles
          .filter((userRole) => !where.userId || userRole.userId === where.userId)
          .map((userRole) => {
            const role = state.roles.find((candidate) => candidate.id === userRole.roleId);
            assert.ok(role);

            if (select?.role) {
              return {
                ...userRole,
                role: {
                  code: role.code,
                },
              };
            }

            if (include?.role) {
              return {
                ...userRole,
                role: {
                  ...role,
                  rolePermissions: [],
                },
              };
            }

            return {
              ...userRole,
              role,
            };
          });
      },
    },
    refreshToken: {
      create: async ({ data }: { data: Prisma.RefreshTokenUncheckedCreateInput }) => {
        const refreshToken: RefreshToken = {
          id: `refresh-token-${state.refreshTokens.length + 1}`,
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
          revokedAt: null,
          createdAt: new Date(),
        };

        state.refreshTokens.push(refreshToken);
        return refreshToken;
      },
    },
  };

  return {
    ...tx,
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as Partial<PrismaService>;
}

function createRedisCacheMock(): Partial<RedisCacheService> {
  const counters = new Map<string, { count: number; expiresAt: number }>();

  return {
    incrementWithTtl: async (key: string, ttlSeconds: number) => {
      const now = Date.now();
      const current = counters.get(key);

      if (!current || current.expiresAt <= now) {
        counters.set(key, {
          count: 1,
          expiresAt: now + ttlSeconds * 1000,
        });
        return 1;
      }

      current.count += 1;
      counters.set(key, current);
      return current.count;
    },
    getTtlSeconds: async (key: string) => {
      const current = counters.get(key);

      if (!current) {
        return null;
      }

      return Math.max(0, Math.ceil((current.expiresAt - Date.now()) / 1000));
    },
  };
}

function createOrderPayload(index: number) {
  return {
    concertId: '11111111-1111-4111-8111-111111111111',
    items: [
      {
        ticketTypeId: '22222222-2222-4222-8222-222222222222',
        quantity: 1,
      },
    ],
    idempotencyKey: `33333333-3333-4333-8333-${String(index + 1).padStart(12, '0')}`,
  };
}
