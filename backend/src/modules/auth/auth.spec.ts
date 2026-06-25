import assert from 'node:assert/strict';
import test from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Permission, Prisma, RefreshToken, Role, RolePermission, User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { RbacModule } from '../rbac/rbac.module';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from './auth.module';

type TestState = {
  users: User[];
  roles: Role[];
  permissions: Permission[];
  userRoles: UserRole[];
  rolePermissions: RolePermission[];
  refreshTokens: RefreshToken[];
};

test('auth and RBAC endpoints use database permissions without JWT role claims', async () => {
  process.env.JWT_ACCESS_SECRET = 'test-jwt-secret';
  process.env.JWT_ACCESS_TOKEN_TTL = '1h';

  const state = createSeededState();
  const prisma = createPrismaMock(state);
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

    const storedUser = state.users[0];
    assert.ok(storedUser);
    assert.notEqual(storedUser.passwordHash, 'strong-password');
    assert.equal(await bcrypt.compare('strong-password', storedUser.passwordHash), true);
    assertUserHasRole(state, storedUser.id, ROLE_CODES.audience);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fan@ticketbox.test',
        password: 'another-password',
      })
      .expect(409);

    const audienceLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'FAN@ticketbox.test',
        password: 'strong-password',
      })
      .expect(201);

    assert.equal(typeof audienceLogin.body.accessToken, 'string');
    assert.equal(typeof audienceLogin.body.refreshToken, 'string');
    assert.equal(state.refreshTokens.length, 1);
    assert.equal(state.refreshTokens[0].userId, storedUser.id);
    assert.notEqual(state.refreshTokens[0].tokenHash, audienceLogin.body.refreshToken);
    assert.equal(await bcrypt.compare(audienceLogin.body.refreshToken, state.refreshTokens[0].tokenHash), true);

    const payload = decodeJwtPayload(audienceLogin.body.accessToken);
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
      .set('Authorization', `Bearer ${audienceLogin.body.accessToken}`)
      .expect(200);

    assert.deepEqual(meResponse.body, {
      id: storedUser.id,
      email: storedUser.email,
    });
    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: audienceLogin.body.refreshToken })
      .expect(201);

    assert.equal(typeof refreshResponse.body.accessToken, 'string');
    assert.equal(typeof refreshResponse.body.refreshToken, 'string');
    assert.notEqual(refreshResponse.body.refreshToken, audienceLogin.body.refreshToken);
    assert.ok(state.refreshTokens[0].revokedAt);
    assert.equal(state.refreshTokens.length, 2);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: audienceLogin.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(204);

    assert.ok(state.refreshTokens[1].revokedAt);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: refreshResponse.body.refreshToken })
      .expect(401);

    await request(app.getHttpServer()).get('/rbac-test/concert-create').expect(401);

    await request(app.getHttpServer())
      .get('/rbac-test/concert-create')
      .set('Authorization', `Bearer ${audienceLogin.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/rbac-test/ticket-purchase')
      .set('Authorization', `Bearer ${audienceLogin.body.accessToken}`)
      .expect(200);

    const organizer = await createRegisteredUser(app, 'organizer@example.com');
    replaceUserRoles(state, organizer.id, [ROLE_CODES.organizer]);

    const organizerLogin = await login(app, 'organizer@example.com');

    await request(app.getHttpServer())
      .get('/rbac-test/concert-create')
      .set('Authorization', `Bearer ${organizerLogin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/rbac-test/ticket-purchase')
      .set('Authorization', `Bearer ${organizerLogin.accessToken}`)
      .expect(403);

    replaceUserRoles(state, organizer.id, [ROLE_CODES.organizer, ROLE_CODES.audience]);

    await request(app.getHttpServer())
      .get('/rbac-test/ticket-purchase')
      .set('Authorization', `Bearer ${organizerLogin.accessToken}`)
      .expect(200);
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
      RbacModule,
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

async function createRegisteredUser(app: INestApplication, email: string): Promise<User> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password: 'strong-password',
    })
    .expect(201);

  return response.body as User;
}

async function login(app: INestApplication, email: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email,
      password: 'strong-password',
    })
    .expect(201);

  return response.body as { accessToken: string; refreshToken: string };
}

function createSeededState(): TestState {
  const now = new Date();
  const roles: Role[] = [
    createRole('role-audience', ROLE_CODES.audience, 'Audience', now),
    createRole('role-organizer', ROLE_CODES.organizer, 'Organizer', now),
    createRole('role-checkin', ROLE_CODES.checkinStaff, 'Check-in Staff', now),
  ];
  const permissions: Permission[] = Object.values(PERMISSION_CODES).map((code, index) => ({
    id: `permission-${index + 1}`,
    code,
    description: code,
    createdAt: now,
    updatedAt: now,
  }));
  const rolePermissions: RolePermission[] = [
    ...mapPermissions(roles, permissions, ROLE_CODES.audience, [
      PERMISSION_CODES.concertRead,
      PERMISSION_CODES.ticketPurchase,
      PERMISSION_CODES.ticketReadOwn,
    ]),
    ...mapPermissions(roles, permissions, ROLE_CODES.organizer, [
      PERMISSION_CODES.concertRead,
      PERMISSION_CODES.concertCreate,
      PERMISSION_CODES.concertUpdate,
      PERMISSION_CODES.concertCancel,
      PERMISSION_CODES.concertTicketTypeManage,
      PERMISSION_CODES.concertAnalyticsRead,
    ]),
    ...mapPermissions(roles, permissions, ROLE_CODES.checkinStaff, [
      PERMISSION_CODES.concertRead,
      PERMISSION_CODES.checkinPreload,
      PERMISSION_CODES.checkinScan,
      PERMISSION_CODES.checkinSync,
    ]),
  ];

  return {
    users: [],
    roles,
    permissions,
    userRoles: [],
    rolePermissions,
    refreshTokens: [],
  };
}

function createRole(id: string, code: string, name: string, date: Date): Role {
  return {
    id,
    code,
    name,
    createdAt: date,
    updatedAt: date,
  };
}

function mapPermissions(
  roles: Role[],
  permissions: Permission[],
  roleCode: string,
  permissionCodes: string[],
): RolePermission[] {
  const role = findRole(roles, roleCode);

  return permissionCodes.map((permissionCode) => {
    const permission = findPermission(permissions, permissionCode);

    return {
      roleId: role.id,
      permissionId: permission.id,
      createdAt: new Date(),
    };
  });
}

function createPrismaMock(state: TestState): Partial<PrismaService> {
  const tx = createPrismaDelegates(state);
  const prisma = {
    ...tx,
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };

  return prisma as unknown as Partial<PrismaService>;
}

function createPrismaDelegates(state: TestState) {
  return {
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
      findMany: async ({ where }: { where: Prisma.RefreshTokenWhereInput }) => {
        return state.refreshTokens.filter((refreshToken) => {
          if (where.userId && refreshToken.userId !== where.userId) {
            return false;
          }
          if (where.revokedAt === null && refreshToken.revokedAt !== null) {
            return false;
          }
          if (
            typeof where.expiresAt === 'object' &&
            where.expiresAt !== null &&
            'gt' in where.expiresAt &&
            where.expiresAt.gt instanceof Date &&
            refreshToken.expiresAt <= where.expiresAt.gt
          ) {
            return false;
          }

          return true;
        });
      },
      update: async ({
        where,
        data,
      }: {
        where: Prisma.RefreshTokenWhereUniqueInput;
        data: Prisma.RefreshTokenUpdateInput;
      }) => {
        const refreshToken = state.refreshTokens.find((candidate) => candidate.id === where.id);
        assert.ok(refreshToken);

        if (data.revokedAt instanceof Date) {
          refreshToken.revokedAt = data.revokedAt;
        }

        return refreshToken;
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
      findMany: async ({ where }: { where: Prisma.UserRoleWhereInput }) => {
        return state.userRoles
          .filter((userRole) => !where.userId || userRole.userId === where.userId)
          .map((userRole) => {
            const role = state.roles.find((candidate) => candidate.id === userRole.roleId);
            assert.ok(role);

            return {
              ...userRole,
              role: {
                ...role,
                rolePermissions: state.rolePermissions
                  .filter((rolePermission) => rolePermission.roleId === role.id)
                  .map((rolePermission) => {
                    const permission = state.permissions.find(
                      (candidate) => candidate.id === rolePermission.permissionId,
                    );
                    assert.ok(permission);

                    return {
                      ...rolePermission,
                      permission,
                    };
                  }),
              },
            };
          });
      },
    },
  };
}

function assertUserHasRole(state: TestState, userId: string, roleCode: string): void {
  const role = findRole(state.roles, roleCode);
  assert.ok(
    state.userRoles.some((userRole) => userRole.userId === userId && userRole.roleId === role.id),
  );
}

function replaceUserRoles(state: TestState, userId: string, roleCodes: string[]): void {
  state.userRoles = state.userRoles.filter((userRole) => userRole.userId !== userId);

  for (const roleCode of roleCodes) {
    const role = findRole(state.roles, roleCode);

    state.userRoles.push({
      userId,
      roleId: role.id,
      createdAt: new Date(),
    });
  }
}

function findRole(roles: Role[], code: string): Role {
  const role = roles.find((candidate) => candidate.code === code);
  assert.ok(role);
  return role;
}

function findPermission(permissions: Permission[], code: string): Permission {
  const permission = permissions.find((candidate) => candidate.code === code);
  assert.ok(permission);
  return permission;
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');

  if (!payload) {
    throw new Error('Invalid JWT');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}
