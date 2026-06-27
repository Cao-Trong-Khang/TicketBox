import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLE_CODES } from './rbac.constants';
import { RoleManagementService } from './role-management.service';

test('role management lists, assigns, rejects duplicates, removes, and audits', async () => {
  const state = createState();
  const service = new RoleManagementService(createPrismaMock(state) as never, createAuditMock(state) as never);

  const roles = await service.listRoles();
  assert.deepEqual(
    roles.map((role) => role.code),
    [ROLE_CODES.audience, ROLE_CODES.checkinStaff, ROLE_CODES.organizer],
  );

  const assigned = await service.assignRole('organizer-1', 'user-1', ROLE_CODES.checkinStaff);
  assert.deepEqual(
    assigned.map((role) => role.code),
    [ROLE_CODES.audience, ROLE_CODES.checkinStaff],
  );
  assert.equal(state.auditLogs[0].action, 'role.assigned');

  await assert.rejects(
    () => service.assignRole('organizer-1', 'user-1', ROLE_CODES.checkinStaff),
    ConflictException,
  );

  await service.removeRole('organizer-1', 'user-1', ROLE_CODES.checkinStaff);
  assert.deepEqual(
    (await service.listUserRoles('user-1')).map((role) => role.code),
    [ROLE_CODES.audience],
  );
  assert.equal(state.auditLogs[1].action, 'role.removed');
});

test('role management returns not found for missing target user or role', async () => {
  const state = createState();
  const service = new RoleManagementService(createPrismaMock(state) as never, createAuditMock(state) as never);

  await assert.rejects(() => service.listUserRoles('missing-user'), NotFoundException);
  await assert.rejects(() => service.assignRole('organizer-1', 'user-1', 'MISSING_ROLE'), NotFoundException);
});

function createState() {
  const roles = [
    { id: 'role-audience', code: ROLE_CODES.audience, name: 'Audience' },
    { id: 'role-checkin', code: ROLE_CODES.checkinStaff, name: 'Check-in Staff' },
    { id: 'role-organizer', code: ROLE_CODES.organizer, name: 'Organizer' },
  ];
  const permissions = [
    { id: 'permission-read', code: 'concert:read', description: 'Read concerts' },
    { id: 'permission-update', code: 'concert:update', description: 'Update concerts' },
  ];

  return {
    users: [{ id: 'user-1' }, { id: 'organizer-1' }],
    roles,
    permissions,
    userRoles: [{ userId: 'user-1', roleId: 'role-audience' }],
    rolePermissions: [
      { roleId: 'role-audience', permissionId: 'permission-read' },
      { roleId: 'role-organizer', permissionId: 'permission-update' },
    ],
    auditLogs: [] as { action: string; targetId: string; metadata?: unknown }[],
  };
}

function createPrismaMock(state: ReturnType<typeof createState>) {
  const tx = {
    role: {
      findMany: async () =>
        [...state.roles]
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((role) => ({
            ...role,
            rolePermissions: state.rolePermissions
              .filter((rolePermission) => rolePermission.roleId === role.id)
              .map((rolePermission) => ({
                ...rolePermission,
                permission: state.permissions.find(
                  (permission) => permission.id === rolePermission.permissionId,
                ),
              })),
          })),
      findUnique: async ({ where }: { where: { code?: string; id?: string } }) =>
        state.roles.find((role) => role.code === where.code || role.id === where.id) ?? null,
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.users.find((user) => user.id === where.id) ?? null,
    },
    userRole: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        state.userRoles
          .filter((userRole) => userRole.userId === where.userId)
          .map((userRole) => ({
            ...userRole,
            role: state.roles.find((role) => role.id === userRole.roleId),
          }))
          .sort((a, b) => a.role!.code.localeCompare(b.role!.code)),
      create: async ({ data }: { data: { userId: string; roleId: string } }) => {
        if (
          state.userRoles.some(
            (userRole) => userRole.userId === data.userId && userRole.roleId === data.roleId,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError('Duplicate role', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }
        state.userRoles.push(data);
        return data;
      },
      delete: async ({ where }: { where: { userId_roleId: { userId: string; roleId: string } } }) => {
        state.userRoles = state.userRoles.filter(
          (userRole) =>
            userRole.userId !== where.userId_roleId.userId ||
            userRole.roleId !== where.userId_roleId.roleId,
        );
      },
    },
  };

  return {
    ...tx,
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
}

function createAuditMock(state: ReturnType<typeof createState>) {
  return {
    record: async (input: { action: string; targetId: string; metadata?: unknown }) => {
      state.auditLogs.push(input);
    },
  };
}