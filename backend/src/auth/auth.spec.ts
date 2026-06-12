import assert from 'node:assert/strict';
import test from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AuthModule } from './auth.module';
import { PrismaService } from '../shared/prisma/prisma.service';

type TestUser = User;

test('auth endpoints register, login, issue identity-only JWTs, and protect /auth/me', async () => {
  process.env.JWT_ACCESS_SECRET = 'test-jwt-secret';
  process.env.JWT_ACCESS_TOKEN_TTL = '1h';

  const users: TestUser[] = [];
  const prisma = createPrismaMock(users);
  const app = await createTestApp(prisma);

  try {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'Fan@TicketBox.test',
        password: 'strong-password',
        displayName: 'Ticket Fan',
      })
      .expect(201);

    assert.equal(registerResponse.body.email, 'fan@ticketbox.test');
    assert.equal(registerResponse.body.displayName, 'Ticket Fan');
    assert.equal(registerResponse.body.passwordHash, undefined);
    assert.equal(registerResponse.body.password_hash, undefined);

    const storedUser = users[0];
    assert.ok(storedUser);
    assert.notEqual(storedUser.passwordHash, 'strong-password');
    assert.equal(await bcrypt.compare('strong-password', storedUser.passwordHash), true);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fan@ticketbox.test',
        password: 'another-password',
      })
      .expect(409);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'FAN@ticketbox.test',
        password: 'strong-password',
      })
      .expect(201);

    assert.equal(typeof loginResponse.body.accessToken, 'string');

    const payload = decodeJwtPayload(loginResponse.body.accessToken);
    assert.equal(payload.sub, storedUser.id);
    assert.equal(payload.email, storedUser.email);
    assert.equal(payload.role, undefined);
    assert.equal(payload.roles, undefined);
    assert.equal(payload.permissions, undefined);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'fan@ticketbox.test',
        password: 'wrong-password',
      })
      .expect(401);

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    assert.deepEqual(meResponse.body, {
      id: storedUser.id,
      email: storedUser.email,
    });
  } finally {
    await app.close();
  }
});

async function createTestApp(prisma: Partial<PrismaService>): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
      }),
      AuthModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
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

function createPrismaMock(users: TestUser[]): Partial<PrismaService> {
  const prisma = {
    user: {
      create: async ({ data }: { data: Prisma.UserCreateInput }) => {
        if (users.some((user) => user.email === data.email)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on email', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['email'] },
          });
        }

        const now = new Date();
        const user: TestUser = {
          id: `00000000-0000-0000-0000-00000000000${users.length + 1}`,
          email: data.email,
          passwordHash: data.passwordHash,
          displayName: typeof data.displayName === 'string' ? data.displayName : null,
          status: UserStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        };

        users.push(user);
        return user;
      },
      findUnique: async ({ where }: { where: Prisma.UserWhereUniqueInput }) => {
        return users.find((user) => user.email === where.email) ?? null;
      },
    },
  };

  return prisma as unknown as Partial<PrismaService>;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');

  if (!payload) {
    throw new Error('Invalid JWT');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}
