import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { CheckInStaffAssignmentService } from './check-in-staff-assignment.service';

test('organizer can assign, list, and remove Check-in Staff with audit logs', async () => {
  const state = createState();
  const service = new CheckInStaffAssignmentService(
    createPrismaMock(state) as never,
    createAuditMock(state) as never,
  );

  const assignment = await service.assignStaff('organizer-1', 'concert-1', 'staff-1', 'Gate A');
  assert.equal(assignment.userId, 'staff-1');
  assert.equal(assignment.gateLabel, 'Gate A');
  assert.equal(state.auditLogs[0].action, 'check_in_staff.assigned');

  const assignments = await service.listStaff('organizer-1', 'concert-1');
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].user?.email, 'staff@example.test');

  await service.removeStaff('organizer-1', 'concert-1', assignment.id);
  assert.equal(state.assignments.length, 0);
  assert.equal(state.auditLogs[1].action, 'check_in_staff.removed');
});

test('Check-in Staff assignment rejects duplicates and non-owner organizers', async () => {
  const state = createState();
  const service = new CheckInStaffAssignmentService(
    createPrismaMock(state) as never,
    createAuditMock(state) as never,
  );

  await service.assignStaff('organizer-1', 'concert-1', 'staff-1', 'Gate A');
  await assert.rejects(
    () => service.assignStaff('organizer-1', 'concert-1', 'staff-1', 'Gate B'),
    ConflictException,
  );
  await assert.rejects(
    () => service.assignStaff('organizer-2', 'concert-1', 'staff-1', 'Gate A'),
    ForbiddenException,
  );
});

test('Check-in Staff assignment requires target user to have CHECKIN_STAFF role', async () => {
  const state = createState();
  const service = new CheckInStaffAssignmentService(
    createPrismaMock(state) as never,
    createAuditMock(state) as never,
  );

  await assert.rejects(
    () => service.assignStaff('organizer-1', 'concert-1', 'audience-1', 'Gate A'),
    ForbiddenException,
  );
});

function createState() {
  return {
    concerts: [{ id: 'concert-1', organizerId: 'organizer-1' }],
    users: [
      { id: 'staff-1', email: 'staff@example.test', displayName: 'Staff One' },
      { id: 'audience-1', email: 'audience@example.test', displayName: 'Audience One' },
    ],
    userRoles: [{ userId: 'staff-1', role: { code: ROLE_CODES.checkinStaff } }],
    assignments: [] as {
      id: string;
      concertId: string;
      userId: string;
      gateLabel: string;
      assignedAt: Date;
      user?: { id: string; email: string; displayName: string | null };
    }[],
    auditLogs: [] as { action: string; targetId: string; metadata?: unknown }[],
  };
}

function createPrismaMock(state: ReturnType<typeof createState>) {
  const tx = {
    concert: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.concerts.find((concert) => concert.id === where.id) ?? null,
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.users.find((user) => user.id === where.id) ?? null,
    },
    userRole: {
      findFirst: async ({ where }: { where: { userId: string; role: { code: string } } }) =>
        state.userRoles.find(
          (userRole) =>
            userRole.userId === where.userId && userRole.role.code === where.role.code,
        ) ?? null,
    },
    checkInStaffAssignment: {
      create: async ({
        data,
      }: {
        data: { concertId: string; userId: string; gateLabel: string };
      }) => {
        if (
          state.assignments.some(
            (assignment) =>
              assignment.concertId === data.concertId && assignment.userId === data.userId,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError('Duplicate assignment', {
            code: 'P2002',
            clientVersion: 'test',
          });
        }

        const user = state.users.find((candidate) => candidate.id === data.userId)!;
        const assignment = {
          id: `assignment-${state.assignments.length + 1}`,
          concertId: data.concertId,
          userId: data.userId,
          gateLabel: data.gateLabel,
          assignedAt: new Date('2026-06-01T00:00:00.000Z'),
          user,
        };
        state.assignments.push(assignment);
        return assignment;
      },
      findMany: async ({ where }: { where: { concertId: string } }) =>
        state.assignments.filter((assignment) => assignment.concertId === where.concertId),
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.assignments.find((assignment) => assignment.id === where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        state.assignments = state.assignments.filter((assignment) => assignment.id !== where.id);
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
