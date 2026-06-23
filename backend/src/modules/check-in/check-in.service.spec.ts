import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import {
  CheckIn,
  CheckInMode,
  CheckInStatus,
  CheckInSyncStatus,
  ImportStatus,
  TicketStatus,
  VipGuestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import { createTicketQrToken } from './check-in-qr-token';
import { CheckInService } from './check-in.service';
import { CheckInScanEntityType } from './dto/sync-check-in.dto';

process.env.CHECK_IN_QR_HMAC_SECRET = 'test-check-in-qr-hmac-secret';

type TestState = {
  userRoles: { userId: string; role: { code: string } }[];
  userPermissions: Record<string, string[]>;
  assignments: {
    id: string;
    staffUserId: string;
    concertId: string;
    gateName: string | null;
    sourceDeviceId: string | null;
    active: boolean;
  }[];
  concerts: {
    id: string;
    title: string;
    venueName: string;
    venueAddress: string | null;
    startsAt: Date;
    endsAt: Date | null;
  }[];
  tickets: {
    id: string;
    ticketCode: string;
    qrHash: string;
    concertId: string;
    status: TicketStatus;
    issuedAt: Date;
    checkedInAt: Date | null;
    ticketType: {
      code: string;
      name: string;
    };
  }[];
  vipGuests: {
    id: string;
    qrHash: string | null;
    externalGuestKey: string | null;
    concertId: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    sponsorSource: string;
    sponsorCompany: string | null;
    invitedBy: string | null;
    guestType: string | null;
    allowedGate: string | null;
    status: VipGuestStatus;
    importStatus: ImportStatus;
    checkedInAt: Date | null;
    notes: string | null;
  }[];
  checkIns: CheckIn[];
};

test('preload rejects a user without Check-in Staff role and preload permission', async () => {
  const { service } = createHarness({
    userRoles: [],
    userPermissions: {
      audience: [],
    },
  });

  await assert.rejects(
    () => service.preloadEvent({ id: 'audience', email: 'audience@example.test' }, 'concert-1'),
    ForbiddenException,
  );
});

test('preload includes completed imported VIP guests for assigned Check-in Staff only', async () => {
  const { service, state } = createHarness();
  state.vipGuests.push(
    {
      id: 'vip-retryable',
      qrHash: 'vip-qr-retryable',
      externalGuestKey: 'VIP-RETRYABLE',
      concertId: 'concert-1',
      fullName: 'Retryable Import Guest',
      email: 'retryable@example.test',
      phone: '+84901111111',
      sponsorSource: 'LOCAL_DEMO',
      sponsorCompany: 'Retry Sponsor',
      invitedBy: 'Retry Desk',
      guestType: 'Press',
      allowedGate: 'Gate B',
      status: VipGuestStatus.ACTIVE,
      importStatus: ImportStatus.RETRYABLE_FAILED,
      checkedInAt: null,
      notes: null,
    },
    {
      id: 'vip-cancelled',
      qrHash: 'vip-qr-cancelled',
      externalGuestKey: 'VIP-CANCELLED',
      concertId: 'concert-1',
      fullName: 'Cancelled Guest',
      email: 'cancelled@example.test',
      phone: '+84902222222',
      sponsorSource: 'LOCAL_DEMO',
      sponsorCompany: 'Cancelled Sponsor',
      invitedBy: 'Sponsor Desk',
      guestType: 'Guest',
      allowedGate: 'VIP Gate',
      status: VipGuestStatus.CANCELLED,
      importStatus: ImportStatus.COMPLETED,
      checkedInAt: null,
      notes: null,
    },
  );

  const preload = await service.preloadEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
  );

  assert.deepEqual(
    preload.vipGuests.map((guest) => guest.id),
    ['vip-1'],
  );
  assert.equal(preload.vipGuests[0].sponsorCompany, 'TicketBox Partners');
  assert.equal(preload.vipGuests[0].guestType, 'Artist Guest');
});

test('preload rejects Check-in Staff without an active assignment for the concert', async () => {
  const { service } = createHarness();

  await assert.rejects(
    () => service.preloadEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-2'),
    ForbiddenException,
  );
});

test('sync accepts a valid assigned ticket scan and updates authoritative ticket state', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0]);

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'local-1',
          qrHash,
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:00:00.000Z',
          localResult: 'accepted',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'accepted');
  assert.equal(response.outcomes[0].idempotent, false);
  assert.equal(state.tickets[0].status, TicketStatus.USED);
  assert.equal(state.checkIns.length, 1);
  assert.equal(state.checkIns[0].status, CheckInStatus.SUCCESS);
});

test('sync rejects unsigned ticket QR bearer hashes', async () => {
  const { service, state } = createHarness();

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'unsigned-ticket',
          qrHash: 'ticket-qr-1',
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].status, CheckInStatus.INVALID_QR);
  assert.equal(state.checkIns[0].note, 'Ticket QR token is not signed');
  assert.equal(state.tickets[0].status, TicketStatus.ACTIVE);
});

test('sync rejects expired signed ticket QR tokens before ticket lookup acceptance', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0], new Date('2026-01-01T00:00:00.000Z'));

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'expired-ticket',
          qrHash,
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].status, CheckInStatus.INVALID_QR);
  assert.equal(state.checkIns[0].note, 'Ticket QR token is expired');
  assert.equal(state.tickets[0].status, TicketStatus.ACTIVE);
});

test('sync accepts a VIP guest only at an assigned gate', async () => {
  const { service, state } = createHarness();
  state.vipGuests[0].allowedGate = ' gate a ';

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'vip-local-1',
          qrHash: 'vip-qr-1',
          entityType: CheckInScanEntityType.vipGuest,
          scannedAt: '2026-08-20T12:00:00.000Z',
          localResult: 'accepted',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'accepted');
  assert.equal(state.checkIns[0].status, CheckInStatus.SUCCESS);
  assert.equal(state.vipGuests[0].status, VipGuestStatus.CHECKED_IN);
});

test('sync rejects VIP guest scans at the wrong assignment gate', async () => {
  const { service, state } = createHarness();

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'vip-wrong-gate',
          qrHash: 'vip-qr-1',
          entityType: CheckInScanEntityType.vipGuest,
          scannedAt: '2026-08-20T12:00:00.000Z',
          localResult: 'accepted',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'unauthorized');
  assert.equal(state.checkIns[0].status, CheckInStatus.UNAUTHORIZED);
  assert.equal(state.checkIns[0].note, 'VIP guest is assigned to VIP Gate');
  assert.equal(state.vipGuests[0].status, VipGuestStatus.ACTIVE);
  assert.equal(state.vipGuests[0].checkedInAt, null);
});

test('sync retry with the same device and local scan ID returns the original outcome', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0]);
  const dto = {
    sourceDeviceId: 'device-a',
    scans: [
      {
        localScanId: 'local-retry',
        qrHash,
        entityType: CheckInScanEntityType.ticket,
        scannedAt: '2026-08-20T12:00:00.000Z',
      },
    ],
  };

  const first = await service.syncEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-1', dto);
  const retry = await service.syncEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-1', dto);

  assert.equal(first.outcomes[0].checkInId, retry.outcomes[0].checkInId);
  assert.equal(retry.outcomes[0].idempotent, true);
  assert.equal(state.checkIns.length, 1);
});

test('cross-device offline scans resolve to first successful sync and later duplicate outcome', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0]);

  const first = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'device-a-local',
          qrHash,
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    },
  );
  const second = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-b',
      scans: [
        {
          localScanId: 'device-b-local',
          qrHash,
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:01:00.000Z',
        },
      ],
    },
  );

  assert.equal(first.outcomes[0].resultCode, 'accepted');
  assert.equal(second.outcomes[0].resultCode, 'duplicate');
  assert.equal(state.checkIns.filter((checkIn) => checkIn.status === CheckInStatus.SUCCESS).length, 1);
});

test('Redis rate limiting returns a retryable 429 before changing scan state', async () => {
  const { service, state } = createHarness({ redisCount: 301 });
  const qrHash = signedTicketQr(state.tickets[0]);

  await assert.rejects(
    () =>
      service.syncEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-1', {
        sourceDeviceId: 'device-a',
        scans: [
          {
            localScanId: 'rate-limited',
            qrHash,
            entityType: CheckInScanEntityType.ticket,
            scannedAt: '2026-08-20T12:00:00.000Z',
          },
        ],
      }),
    (error) =>
      error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
  assert.equal(state.checkIns.length, 0);
  assert.equal(state.tickets[0].status, TicketStatus.ACTIVE);
});

test('Kafka publish failures do not change the authoritative sync response', async () => {
  const { service, state } = createHarness({ publisherThrows: true });
  const qrHash = signedTicketQr(state.tickets[0]);

  const response = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-a',
      scans: [
        {
          localScanId: 'kafka-down',
          qrHash,
          entityType: CheckInScanEntityType.ticket,
          scannedAt: '2026-08-20T12:00:00.000Z',
        },
      ],
    },
  );

  assert.equal(response.outcomes[0].resultCode, 'accepted');
});

function createHarness(
  overrides: {
    userRoles?: TestState['userRoles'];
    userPermissions?: TestState['userPermissions'];
    redisCount?: number;
    publisherThrows?: boolean;
  } = {},
): { service: CheckInService; state: TestState } {
  const state: TestState = {
    userRoles: overrides.userRoles ?? [
      {
        userId: 'staff-1',
        role: { code: ROLE_CODES.checkinStaff },
      },
    ],
    userPermissions: overrides.userPermissions ?? {
      'staff-1': [
        PERMISSION_CODES.checkinPreload,
        PERMISSION_CODES.checkinScan,
        PERMISSION_CODES.checkinSync,
      ],
    },
    assignments: [
      {
        id: 'assignment-a',
        staffUserId: 'staff-1',
        concertId: 'concert-1',
        gateName: 'Gate A',
        sourceDeviceId: 'device-a',
        active: true,
      },
      {
        id: 'assignment-b',
        staffUserId: 'staff-1',
        concertId: 'concert-1',
        gateName: 'Gate B',
        sourceDeviceId: 'device-b',
        active: true,
      },
    ],
    concerts: [
      {
        id: 'concert-1',
        title: 'Demo Concert',
        venueName: 'Demo Arena',
        venueAddress: 'District 1',
        startsAt: new Date('2026-08-20T11:00:00.000Z'),
        endsAt: new Date('2026-08-20T15:30:00.000Z'),
      },
    ],
    tickets: [
      {
        id: 'ticket-1',
        ticketCode: 'DEMO-001',
        qrHash: 'ticket-qr-1',
        concertId: 'concert-1',
        status: TicketStatus.ACTIVE,
        issuedAt: new Date('2026-06-15T12:00:00.000Z'),
        checkedInAt: null,
        ticketType: {
          code: 'GA',
          name: 'General Admission',
        },
      },
    ],
    vipGuests: [
      {
        id: 'vip-1',
        qrHash: 'vip-qr-1',
        externalGuestKey: 'VIP-1',
        concertId: 'concert-1',
        fullName: 'VIP Guest',
        email: 'vip@example.test',
        phone: '+84900000001',
        sponsorSource: 'LOCAL_DEMO',
        sponsorCompany: 'TicketBox Partners',
        invitedBy: 'Sponsor Team',
        guestType: 'Artist Guest',
        allowedGate: 'VIP Gate',
        status: VipGuestStatus.ACTIVE,
        importStatus: ImportStatus.COMPLETED,
        checkedInAt: null,
        notes: 'Use VIP entrance',
      },
    ],
    checkIns: [],
  };
  const prisma = createPrismaMock(state);
  const permissionService = {
    userHasPermissions: async (userId: string, permissions: string[]) => {
      const grantedPermissions = new Set(state.userPermissions[userId] ?? []);
      return permissions.every((permission) => grantedPermissions.has(permission));
    },
  };
  const redisCache = {
    incrementWithTtl: async () => overrides.redisCount ?? 1,
  };
  const publisher: CheckInEventsPublisher = {
    publishSyncOutcome: async () => {
      if (overrides.publisherThrows) {
        throw new Error('Kafka unavailable');
      }
    },
  };

  return {
    service: new CheckInService(
      prisma as unknown as PrismaService,
      permissionService as never,
      redisCache as never,
      publisher,
    ),
    state,
  };
}

function createPrismaMock(state: TestState) {
  const tx = {
    userRole: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        state.userRoles.filter((userRole) => userRole.userId === where.userId),
    },
    checkInAssignment: {
      findMany: async ({
        where,
        include,
      }: {
        where: {
          staffUserId: string;
          concertId?: string;
          active: boolean;
          OR?: { sourceDeviceId: string | null }[];
        };
        include?: unknown;
      }) =>
        state.assignments
          .filter((assignment) => assignment.staffUserId === where.staffUserId)
          .filter((assignment) => !where.concertId || assignment.concertId === where.concertId)
          .filter((assignment) => assignment.active === where.active)
          .filter(
            (assignment) =>
              !where.OR ||
              where.OR.some((condition) => condition.sourceDeviceId === assignment.sourceDeviceId),
          )
          .map((assignment) => ({
            ...assignment,
            ...(include
              ? {
                  concert: state.concerts.find((concert) => concert.id === assignment.concertId),
                }
              : {}),
          })),
    },
    concert: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.concerts.find((concert) => concert.id === where.id) ?? null,
    },
    ticket: {
      findMany: async ({ where }: { where: { concertId: string } }) =>
        state.tickets.filter((ticket) => ticket.concertId === where.concertId),
      findUnique: async ({ where }: { where: { id?: string; qrHash?: string } }) => {
        const ticket = state.tickets.find(
          (candidate) =>
            (where.id !== undefined && candidate.id === where.id) ||
            (where.qrHash !== undefined && candidate.qrHash === where.qrHash),
        );
        const concert = ticket
          ? state.concerts.find((candidate) => candidate.id === ticket.concertId)
          : null;

        return ticket && concert ? { ...ticket, concert: { endsAt: concert.endsAt } } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestState['tickets'][0]> }) => {
        const ticket = state.tickets.find((candidate) => candidate.id === where.id);
        assert.ok(ticket);
        Object.assign(ticket, data);
        return ticket;
      },
    },
    vipGuest: {
      findMany: async ({
        where,
      }: {
        where: {
          concertId: string;
          status?: { in: VipGuestStatus[] };
          import?: { status: ImportStatus };
        };
      }) =>
        state.vipGuests
          .filter((guest) => guest.concertId === where.concertId)
          .filter((guest) => !where.status || where.status.in.includes(guest.status))
          .filter((guest) => !where.import || guest.importStatus === where.import.status),
      findFirst: async ({
        where,
      }: {
        where: {
          OR: { qrHash?: string; externalGuestKey?: string }[];
          import?: { status: ImportStatus };
        };
      }) => {
        const guest = state.vipGuests
          .filter((candidate) => !where.import || candidate.importStatus === where.import.status)
          .find((candidate) =>
            where.OR.some(
              (condition) =>
                ('qrHash' in condition && condition.qrHash === candidate.qrHash) ||
                ('externalGuestKey' in condition &&
                  condition.externalGuestKey === candidate.externalGuestKey),
            ),
          );
        const concert = guest
          ? state.concerts.find((candidate) => candidate.id === guest.concertId)
          : null;

        return guest && concert ? { ...guest, concert: { endsAt: concert.endsAt } } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<TestState['vipGuests'][0]>;
      }) => {
        const guest = state.vipGuests.find((candidate) => candidate.id === where.id);
        assert.ok(guest);
        Object.assign(guest, data);
        return guest;
      },
    },
    checkIn: {
      findFirst: async ({
        where,
      }: {
        where: {
          sourceDeviceId?: string;
          localScanId?: string;
          ticketId?: string;
          vipGuestId?: string;
          status?: CheckInStatus;
        };
      }) =>
        state.checkIns.find(
          (checkIn) =>
            (!where.sourceDeviceId || checkIn.sourceDeviceId === where.sourceDeviceId) &&
            (!where.localScanId || checkIn.localScanId === where.localScanId) &&
            (!where.ticketId || checkIn.ticketId === where.ticketId) &&
            (!where.vipGuestId || checkIn.vipGuestId === where.vipGuestId) &&
            (!where.status || checkIn.status === where.status),
        ) ?? null,
      create: async ({ data }: { data: Partial<CheckIn> }) => {
        const checkIn: CheckIn = {
          id: `check-in-${state.checkIns.length + 1}`,
          ticketId: data.ticketId ?? null,
          vipGuestId: data.vipGuestId ?? null,
          concertId: data.concertId ?? 'concert-1',
          staffUserId: data.staffUserId ?? 'staff-1',
          localScanId: data.localScanId ?? null,
          sourceDeviceId: data.sourceDeviceId ?? null,
          mode: data.mode ?? CheckInMode.OFFLINE,
          status: data.status ?? CheckInStatus.INVALID_QR,
          syncStatus: data.syncStatus ?? CheckInSyncStatus.SYNCED,
          scannedAt: data.scannedAt ?? new Date(),
          syncedAt: data.syncedAt ?? new Date(),
          note: data.note ?? null,
          createdAt: new Date(),
        };

        state.checkIns.push(checkIn);
        return checkIn;
      },
    },
  };

  return {
    ...tx,
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
}

function signedTicketQr(
  ticket: TestState['tickets'][number],
  expiresAt = new Date('2026-08-27T15:30:00.000Z'),
): string {
  return createTicketQrToken({
    ticketId: ticket.id,
    concertId: ticket.concertId,
    nonce: ticket.qrHash,
    expiresAt,
  });
}
