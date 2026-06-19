import assert from 'node:assert/strict';
import test from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  AuditLog,
  Concert,
  GateStaffAssignment,
  Permission,
  Prisma,
  RefreshToken,
  Role,
  RolePermission,
  User,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { HttpErrorFilter } from '../../http-error.filter';
import { GateStaffAssignmentModule } from '../gate-staff/gate-staff-assignment.module';
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
  auditLogs: AuditLog[];
  concerts: Concert[];
  gateStaffAssignments: GateStaffAssignment[];
};

test('auth, RBAC, and gate-staff endpoints follow the auth-and-rbac contract', async () => {
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
        fullName: 'Ticket Fan',
        phone: '0900000000',
      })
      .expect(201);

    assert.equal(registerResponse.body.email, 'fan@ticketbox.test');
    assert.equal(registerResponse.body.fullName, 'Ticket Fan');
    assert.equal(registerResponse.body.passwordHash, undefined);
    assert.deepEqual(registerResponse.body.roles, [ROLE_CODES.audience]);

    const storedUser = state.users.find((user) => user.email === 'fan@ticketbox.test');
    assert.ok(storedUser);
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

    assert.equal(typeof audienceLogin.body.access_token, 'string');
    assert.equal(typeof audienceLogin.body.refresh_token, 'string');
    assert.deepEqual(audienceLogin.body.user.roles, [ROLE_CODES.audience]);

    const payload = decodeJwtPayload(audienceLogin.body.access_token);
    assert.equal(payload.user_id, storedUser.id);
    assert.deepEqual(payload.roles, [ROLE_CODES.audience]);
    assert.equal(typeof payload.exp, 'number');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'fan@ticketbox.test',
        password: 'wrong-password',
      })
      .expect(401)
      .expect(({ body }) => assert.equal(body.status_code, 401));

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const meResponse = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${audienceLogin.body.access_token}`)
      .expect(200);

    assert.equal(meResponse.body.id, storedUser.id);
    assert.equal(meResponse.body.passwordHash, undefined);
    assert.deepEqual(meResponse.body.roles, [ROLE_CODES.audience]);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: audienceLogin.body.refresh_token })
      .expect(201);

    assert.equal(typeof refreshResponse.body.access_token, 'string');
    assert.equal(typeof refreshResponse.body.refresh_token, 'string');
    assert.notEqual(refreshResponse.body.refresh_token, audienceLogin.body.refresh_token);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: audienceLogin.body.refresh_token })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${refreshResponse.body.access_token}`)
      .send({ refresh_token: refreshResponse.body.refresh_token })
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: refreshResponse.body.refresh_token })
      .expect(401);

    await request(app.getHttpServer())
      .get('/roles')
      .set('Authorization', `Bearer ${audienceLogin.body.access_token}`)
      .expect(200)
      .expect(({ body }) => {
        const roleCodes = body.map((role: { code: string }) => role.code);
        assert.deepEqual(roleCodes, [ROLE_CODES.audience, ROLE_CODES.gateStaff, ROLE_CODES.organizer]);
      });

    await request(app.getHttpServer())
      .get('/admin/users/some-user/roles')
      .set('Authorization', `Bearer ${audienceLogin.body.access_token}`)
      .expect(403)
      .expect(({ body }) => assert.equal(body.status_code, 403));

    const organizer = await createUserWithRoles(state, 'organizer@example.com', [
      ROLE_CODES.organizer,
    ]);
    const organizerLogin = await login(app, 'organizer@example.com');

    await request(app.getHttpServer())
      .post(`/admin/users/${storedUser.id}/roles`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .send({ role_code: ROLE_CODES.gateStaff })
      .expect(201);

    assertUserHasRole(state, storedUser.id, ROLE_CODES.gateStaff);
    assert.equal(state.auditLogs.some((log) => log.action === 'user_role.assigned'), true);

    await request(app.getHttpServer())
      .post(`/admin/users/${storedUser.id}/roles`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .send({ role_code: ROLE_CODES.gateStaff })
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/admin/users/${storedUser.id}/roles/${ROLE_CODES.gateStaff}`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .expect(204);

    assert.equal(state.auditLogs.some((log) => log.action === 'user_role.removed'), true);

    const concert = createConcert(state, organizer.id, 'concert-1');
    const otherOrganizer = await createUserWithRoles(state, 'other-organizer@example.com', [
      ROLE_CODES.organizer,
    ]);
    const otherOrganizerLogin = await login(app, 'other-organizer@example.com');

    await request(app.getHttpServer())
      .post(`/admin/concerts/${concert.id}/gate-staff`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .send({ user_id: storedUser.id, gate_label: 'Gate A' })
      .expect(201);

    assert.equal(state.gateStaffAssignments.length, 1);
    assert.equal(state.auditLogs.some((log) => log.action === 'gate_staff.assigned'), true);

    await request(app.getHttpServer())
      .get(`/admin/concerts/${concert.id}/gate-staff`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .expect(200)
      .expect(({ body }) => assert.equal(body[0].gate_label, 'Gate A'));

    await request(app.getHttpServer())
      .post(`/admin/concerts/${concert.id}/gate-staff`)
      .set('Authorization', `Bearer ${otherOrganizerLogin.access_token}`)
      .send({ user_id: storedUser.id, gate_label: 'Gate B' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/admin/concerts/${concert.id}/gate-staff/${state.gateStaffAssignments[0].id}`)
      .set('Authorization', `Bearer ${organizerLogin.access_token}`)
      .expect(204);

    assert.equal(state.auditLogs.some((log) => log.action === 'gate_staff.removed'), true);
    assert.equal(state.gateStaffAssignments.length, 0);
    assert.ok(otherOrganizer);
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
      GateStaffAssignmentModule,
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
  app.useGlobalFilters(new HttpErrorFilter());
  await app.init();

  return app;
}

async function login(app: INestApplication, email: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({
      email,
      password: 'strong-password',
    })
    .expect(201);

  return response.body as { access_token: string; refresh_token: string };
}

async function createUserWithRoles(state: TestState, email: string, roleCodes: string[]) {
  const now = new Date();
  const user: User = {
    id: nextUuid(state.users.length + 1),
    email,
    passwordHash: await bcrypt.hash('strong-password', 10),
    fullName: null,
    phone: null,
    status: UserStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };

  state.users.push(user);
  replaceUserRoles(state, user.id, roleCodes);
  return user;
}

function createSeededState(): TestState {
  const now = new Date();
  const roles: Role[] = [
    createRole('10000000-0000-0000-0000-000000000001', ROLE_CODES.audience, 'Audience', now),
    createRole('10000000-0000-0000-0000-000000000002', ROLE_CODES.gateStaff, 'Gate Staff', now),
    createRole('10000000-0000-0000-0000-000000000003', ROLE_CODES.organizer, 'Organizer', now),
  ];
  const permissions: Permission[] = Object.values(PERMISSION_CODES).map((code, index) => ({
    id: `20000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
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
      PERMISSION_CODES.concertStats,
      PERMISSION_CODES.documentUpload,
      PERMISSION_CODES.aiBioRead,
    ]),
    ...mapPermissions(roles, permissions, ROLE_CODES.gateStaff, [
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
    auditLogs: [],
    concerts: [],
    gateStaffAssignments: [],
  };
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
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const email = String(data.email);

        if (state.users.some((user) => user.email === email)) {
          throw uniqueConstraintError(['email']);
        }

        const now = new Date();
        const user: User = {
          id: nextUuid(state.users.length + 1),
          email,
          passwordHash: String(data.passwordHash),
          fullName: typeof data.fullName === 'string' ? data.fullName : null,
          phone: typeof data.phone === 'string' ? data.phone : null,
          status: UserStatus.ACTIVE,
          createdAt: now,
          updatedAt: now,
        };

        state.users.push(user);

        const userRoles = data.userRoles as { create?: { roleId: string } } | undefined;
        if (userRoles?.create) {
          state.userRoles.push({
            userId: user.id,
            roleId: userRoles.create.roleId,
            createdAt: now,
          });
        }

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
      findMany: async () => {
        return [...state.roles]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((role) => ({
            ...role,
            rolePermissions: state.rolePermissions
              .filter((rolePermission) => rolePermission.roleId === role.id)
              .map((rolePermission) => ({
                ...rolePermission,
                permission: findPermissionById(state, rolePermission.permissionId),
              })),
          }));
      },
    },
    userRole: {
      create: async ({ data }: { data: Prisma.UserRoleUncheckedCreateInput }) => {
        if (
          state.userRoles.some(
            (userRole) => userRole.userId === data.userId && userRole.roleId === data.roleId,
          )
        ) {
          throw uniqueConstraintError(['user_id', 'role_id']);
        }

        const userRole: UserRole = {
          userId: data.userId,
          roleId: data.roleId,
          createdAt: new Date(),
        };

        state.userRoles.push(userRole);
        return userRole;
      },
      findUnique: async ({ where }: { where: Prisma.UserRoleWhereUniqueInput }) => {
        const composite = where.userId_roleId;
        return (
          state.userRoles.find(
            (userRole) => userRole.userId === composite?.userId && userRole.roleId === composite.roleId,
          ) ?? null
        );
      },
      findMany: async ({ where }: { where: Prisma.UserRoleWhereInput }) => {
        return state.userRoles
          .filter((userRole) => !where.userId || userRole.userId === where.userId)
          .map((userRole) => {
            const role = findRoleById(state, userRole.roleId);

            return {
              ...userRole,
              role: {
                ...role,
                rolePermissions: state.rolePermissions
                  .filter((rolePermission) => rolePermission.roleId === role.id)
                  .map((rolePermission) => ({
                    ...rolePermission,
                    permission: findPermissionById(state, rolePermission.permissionId),
                  })),
              },
            };
          });
      },
      delete: async ({ where }: { where: Prisma.UserRoleWhereUniqueInput }) => {
        const composite = where.userId_roleId;
        const index = state.userRoles.findIndex(
          (userRole) => userRole.userId === composite?.userId && userRole.roleId === composite.roleId,
        );
        assert.notEqual(index, -1);
        return state.userRoles.splice(index, 1)[0];
      },
    },
    refreshToken: {
      create: async ({ data }: { data: Prisma.RefreshTokenUncheckedCreateInput }) => {
        const refreshToken: RefreshToken = {
          id: data.id ?? nextUuid(state.refreshTokens.length + 100),
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt as Date,
          revokedAt: null,
          createdAt: new Date(),
        };

        state.refreshTokens.push(refreshToken);
        return refreshToken;
      },
      findUnique: async ({ where, include }: { where: Prisma.RefreshTokenWhereUniqueInput; include?: { user?: boolean } }) => {
        const refreshToken = state.refreshTokens.find((candidate) => candidate.id === where.id) ?? null;

        if (!refreshToken || !include?.user) {
          return refreshToken;
        }

        return {
          ...refreshToken,
          user: state.users.find((user) => user.id === refreshToken.userId),
        };
      },
      update: async ({ where, data }: { where: Prisma.RefreshTokenWhereUniqueInput; data: Prisma.RefreshTokenUpdateInput }) => {
        const refreshToken = state.refreshTokens.find((candidate) => candidate.id === where.id);
        assert.ok(refreshToken);
        refreshToken.revokedAt = data.revokedAt as Date;
        return refreshToken;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
        const auditLog: AuditLog = {
          id: nextUuid(state.auditLogs.length + 300),
          actorUserId: data.actorUserId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          metadataJson: typeof data.metadataJson === 'string' ? data.metadataJson : null,
          createdAt: new Date(),
        };

        state.auditLogs.push(auditLog);
        return auditLog;
      },
    },
    concert: {
      findUnique: async ({ where }: { where: Prisma.ConcertWhereUniqueInput }) => {
        const concert = state.concerts.find((candidate) => candidate.id === where.id) ?? null;
        return concert ? { organizerId: concert.organizerId } : null;
      },
    },
    gateStaffAssignment: {
      create: async ({ data }: { data: Prisma.GateStaffAssignmentUncheckedCreateInput }) => {
        if (
          state.gateStaffAssignments.some(
            (assignment) => assignment.concertId === data.concertId && assignment.userId === data.userId,
          )
        ) {
          throw uniqueConstraintError(['concert_id', 'user_id']);
        }

        const assignment: GateStaffAssignment = {
          id: nextUuid(state.gateStaffAssignments.length + 400),
          concertId: data.concertId,
          userId: data.userId,
          gateLabel: data.gateLabel,
          assignedAt: new Date(),
        };

        state.gateStaffAssignments.push(assignment);
        return assignment;
      },
      findMany: async ({ where }: { where: Prisma.GateStaffAssignmentWhereInput }) => {
        return state.gateStaffAssignments
          .filter((assignment) => assignment.concertId === where.concertId)
          .map((assignment) => ({
            ...assignment,
            user: state.users.find((user) => user.id === assignment.userId),
          }));
      },
      findFirst: async ({ where }: { where: Prisma.GateStaffAssignmentWhereInput }) => {
        return (
          state.gateStaffAssignments.find((assignment) => {
            return (
              (!where.id || assignment.id === where.id) &&
              (!where.concertId || assignment.concertId === where.concertId) &&
              (!where.userId || assignment.userId === where.userId) &&
              (!where.gateLabel || assignment.gateLabel === where.gateLabel)
            );
          }) ?? null
        );
      },
      delete: async ({ where }: { where: Prisma.GateStaffAssignmentWhereUniqueInput }) => {
        const index = state.gateStaffAssignments.findIndex((assignment) => assignment.id === where.id);
        assert.notEqual(index, -1);
        return state.gateStaffAssignments.splice(index, 1)[0];
      },
    },
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
  const role = roles.find((candidate) => candidate.code === roleCode);
  assert.ok(role);

  return permissionCodes.map((permissionCode) => {
    const permission = permissions.find((candidate) => candidate.code === permissionCode);
    assert.ok(permission);

    return {
      roleId: role.id,
      permissionId: permission.id,
      createdAt: new Date(),
    };
  });
}

function createConcert(state: TestState, organizerId: string, id: string): Concert {
  const now = new Date();
  const concert: Concert = {
    id,
    organizerId,
    title: 'Concert',
    artistName: null,
    description: null,
    venueName: 'Venue',
    venueAddress: null,
    bannerUrl: null,
    seatingSvg: null,
    status: 'DRAFT',
    startsAt: now,
    endsAt: null,
    createdAt: now,
    updatedAt: now,
  };

  state.concerts.push(concert);
  return concert;
}

function assertUserHasRole(state: TestState, userId: string, roleCode: string): void {
  const role = state.roles.find((candidate) => candidate.code === roleCode);
  assert.ok(role);
  assert.ok(
    state.userRoles.some((userRole) => userRole.userId === userId && userRole.roleId === role.id),
  );
}

function replaceUserRoles(state: TestState, userId: string, roleCodes: string[]): void {
  state.userRoles = state.userRoles.filter((userRole) => userRole.userId !== userId);

  for (const roleCode of roleCodes) {
    const role = state.roles.find((candidate) => candidate.code === roleCode);
    assert.ok(role);
    state.userRoles.push({
      userId,
      roleId: role.id,
      createdAt: new Date(),
    });
  }
}

function findRoleById(state: TestState, roleId: string): Role {
  const role = state.roles.find((candidate) => candidate.id === roleId);
  assert.ok(role);
  return role;
}

function findPermissionById(state: TestState, permissionId: string): Permission {
  const permission = state.permissions.find((candidate) => candidate.id === permissionId);
  assert.ok(permission);
  return permission;
}

function uniqueConstraintError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');

  if (!payload) {
    throw new Error('Invalid JWT');
  }

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function nextUuid(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}
