import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import {
  CheckIn,
  CheckInMode,
  CheckInStatus,
  CheckInSyncStatus,
  ImportStatus,
  OrderStatus,
  PaymentStatus,
  TicketStatus,
  VipGuestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import {
  CHECK_IN_QR_ENTITY_TYPES,
  createCheckInQrToken,
  verifyCheckInQrTokenForEntity,
} from './check-in-qr-token';
import { CheckInService } from './check-in.service';
import { CheckInClientMode, CheckInScanEntityType } from './dto/sync-check-in.dto';

process.env.CHECK_IN_QR_HMAC_SECRET = 'test-check-in-qr-hmac-secret-1234567890';
process.env.CHECK_IN_QR_ISSUER = 'ticketbox';

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
  checkInStaffAssignments: {
    id: string;
    userId: string;
    concertId: string;
    gateLabel: string;
    assignedAt: Date;
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
    order: {
      status: OrderStatus;
      paidAt: Date | null;
      totalAmountVnd: number;
      payments: {
        status: PaymentStatus;
        amountVnd: number;
      }[];
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

test('preload returns signed QR tokens for ticket and VIP guests, not raw credentials', async () => {
  const { service, state } = createHarness();
  const preload = await service.preloadEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    'staff-assignment-a',
  );

  assert.notEqual(preload.tickets[0].qrHash, state.tickets[0].qrHash);
  assert.notEqual(preload.vipGuests[0].qrHash, state.vipGuests[0].qrHash);
  assert.equal(preload.vipGuests[0].externalGuestKey, state.vipGuests[0].externalGuestKey);

  const ticketVerification = verifyCheckInQrTokenForEntity(
    preload.tickets[0].qrHash,
    CHECK_IN_QR_ENTITY_TYPES.ticket,
    new Date('2026-08-01T00:00:00.000Z'),
  );
  assert.equal(ticketVerification.valid, true);

  const vipVerification = verifyCheckInQrTokenForEntity(
    preload.vipGuests[0].qrHash ?? '',
    CHECK_IN_QR_ENTITY_TYPES.vipGuest,
    new Date('2026-08-01T00:00:00.000Z'),
  );
  assert.equal(vipVerification.valid, true);
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
      id: 'vip-gate-b',
      qrHash: 'vip-qr-gate-b',
      externalGuestKey: 'VIP-GATE-B',
      concertId: 'concert-1',
      fullName: 'Gate B Guest',
      email: 'gateb@example.test',
      phone: '+84903333333',
      sponsorSource: 'LOCAL_DEMO',
      sponsorCompany: 'Gate B Sponsor',
      invitedBy: 'Sponsor Desk',
      guestType: 'Guest',
      allowedGate: 'Gate B',
      status: VipGuestStatus.ACTIVE,
      importStatus: ImportStatus.COMPLETED,
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
    'staff-assignment-a',
  );

  assert.deepEqual(
    preload.vipGuests.map((guest) => guest.id),
    ['vip-1'],
  );
});

test('preload scopes VIP guests to the selected gate assignment', async () => {
  const { service, state } = createHarness();
  state.vipGuests.push(
    {
      id: 'vip-any-gate',
      qrHash: 'vip-qr-any-gate',
      externalGuestKey: 'VIP-ANY',
      concertId: 'concert-1',
      fullName: 'Any Gate Guest',
      email: 'any@example.test',
      phone: '+84904444444',
      sponsorSource: 'LOCAL_DEMO',
      sponsorCompany: 'Any Gate Sponsor',
      invitedBy: 'Sponsor Desk',
      guestType: 'Guest',
      allowedGate: null,
      status: VipGuestStatus.ACTIVE,
      importStatus: ImportStatus.COMPLETED,
      checkedInAt: null,
      notes: null,
    },
    {
      id: 'vip-gate-b',
      qrHash: 'vip-qr-gate-b',
      externalGuestKey: 'VIP-GATE-B',
      concertId: 'concert-1',
      fullName: 'Gate B Guest',
      email: 'gateb@example.test',
      phone: '+84905555555',
      sponsorSource: 'LOCAL_DEMO',
      sponsorCompany: 'Gate B Sponsor',
      invitedBy: 'Sponsor Desk',
      guestType: 'Guest',
      allowedGate: 'Gate B',
      status: VipGuestStatus.ACTIVE,
      importStatus: ImportStatus.COMPLETED,
      checkedInAt: null,
      notes: null,
    },
  );

  const preload = await service.preloadEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    'staff-assignment-a',
  );

  assert.deepEqual(
    preload.assignments.map((assignment) => assignment.assignmentId),
    ['staff-assignment-a'],
  );
  assert.deepEqual(
    preload.vipGuests.map((guest) => guest.id).sort(),
    ['vip-1', 'vip-any-gate'],
  );
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
  const serverNow = new Date('2026-08-20T12:00:05.000Z');

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'local-1',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
    localResult: 'accepted',
  });

  assert.equal(response.outcomes[0].resultCode, 'accepted');
  assert.equal(response.outcomes[0].serverCheckInAt, serverNow.toISOString());
  assert.equal(state.tickets[0].status, TicketStatus.USED);
  assert.deepEqual(state.tickets[0].checkedInAt, serverNow);
});

test('sync rejects unsigned ticket QR bearer hashes', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'unsigned-ticket',
    qrHash: 'ticket-qr-1',
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token is not signed');
});

test('sync rejects a tampered ticket signature', async () => {
  const { service, state } = createHarness();
  const tampered = `${signedTicketQr(state.tickets[0]).slice(0, -1)}x`;

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'tampered-ticket-signature',
    qrHash: tampered,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token signature is invalid');
});

test('sync rejects a tampered ticket payload', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0], undefined, { nonce: 'other-qr' });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'tampered-ticket-payload',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'Ticket QR token does not match the issued ticket');
});

test('sync rejects a ticket token for the wrong concert', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0], undefined, { concertId: 'concert-2' });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'wrong-concert-ticket',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'unauthorized');
  assert.equal(state.checkIns[0].note, 'QR token belongs to a different concert');
});

test('sync rejects a ticket token with the wrong entity type', async () => {
  const { service, state } = createHarness();
  const qrHash = signedVipQr(state.vipGuests[0], undefined, { entityId: state.tickets[0].id });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'wrong-ticket-entity-type',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(
    state.checkIns[0].note,
    'QR token entity type is invalid for TICKET',
  );
});

test('sync rejects a ticket token with the wrong issuer', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0], undefined, { issuer: 'other-issuer' });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'wrong-ticket-issuer',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token issuer is invalid');
});

test('sync rejects expired signed ticket QR tokens before ticket lookup acceptance', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0], new Date('2026-01-01T00:00:00.000Z'));

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'expired-ticket',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token is expired');
});

test('sync rejects active tickets whose order is not paid', async () => {
  const { service, state } = createHarness();
  state.tickets[0].order.status = OrderStatus.PENDING;
  state.tickets[0].order.paidAt = null;
  state.tickets[0].order.payments = [];

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'unpaid-order',
    qrHash: signedTicketQr(state.tickets[0]),
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'Ticket order has not been paid');
});

test('sync accepts offline scans after event end only within grace window', async () => {
  const { service, state } = createHarness({ now: new Date('2026-08-21T12:00:00.000Z') });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'offline-before-end',
    qrHash: signedTicketQr(state.tickets[0]),
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T15:29:00.000Z',
    mode: CheckInClientMode.offline,
  });

  assert.equal(response.outcomes[0].resultCode, 'accepted');
});

test('sync accepts a valid VIP guest only at an assigned gate', async () => {
  const { service, state } = createHarness();
  state.vipGuests[0].allowedGate = ' gate a ';

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-local-1',
    qrHash: signedVipQr(state.vipGuests[0]),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
    localResult: 'accepted',
  });

  assert.equal(response.outcomes[0].resultCode, 'accepted');
  assert.equal(state.vipGuests[0].status, VipGuestStatus.CHECKED_IN);
});

test('sync rejects VIP raw external guest keys as QR credentials', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-raw-external-key',
    qrHash: state.vipGuests[0].externalGuestKey ?? 'VIP-1',
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token is not signed');
});

test('sync rejects VIP guest scans at the wrong assignment gate', async () => {
  const { service, state } = createHarness();
  state.vipGuests[0].allowedGate = 'VIP Gate';

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-wrong-gate',
    qrHash: signedVipQr(state.vipGuests[0]),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'unauthorized');
  assert.equal(state.checkIns[0].note, 'VIP guest is assigned to VIP Gate');
});

test('sync rejects a VIP token with the wrong concert', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-wrong-concert',
    qrHash: signedVipQr(state.vipGuests[0], undefined, { concertId: 'concert-2' }),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'unauthorized');
  assert.equal(state.checkIns[0].note, 'QR token belongs to a different concert');
});

test('sync rejects a VIP token with the wrong entity type', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-wrong-entity-type',
    qrHash: signedTicketQr(state.tickets[0], undefined, { entityId: state.vipGuests[0].id }),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(
    state.checkIns[0].note,
    'QR token entity type is invalid for VIP_GUEST',
  );
});

test('sync rejects a VIP token with the wrong issuer', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-wrong-issuer',
    qrHash: signedVipQr(state.vipGuests[0], undefined, { issuer: 'other-issuer' }),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token issuer is invalid');
});

test('sync rejects expired VIP tokens', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-expired',
    qrHash: signedVipQr(state.vipGuests[0], new Date('2026-01-01T00:00:00.000Z')),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'QR token is expired');
});

test('sync rejects a VIP token whose payload nonce is tampered', async () => {
  const { service, state } = createHarness();

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-tampered-payload',
    qrHash: signedVipQr(state.vipGuests[0], undefined, { nonce: 'other-vip-qr' }),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'invalid');
  assert.equal(state.checkIns[0].note, 'VIP guest QR token does not match the imported guest');
});

test('sync rejects already checked-in VIP tokens as duplicates', async () => {
  const { service, state } = createHarness();
  state.vipGuests[0].allowedGate = null;
  state.vipGuests[0].status = VipGuestStatus.CHECKED_IN;
  state.vipGuests[0].checkedInAt = new Date('2026-08-20T11:59:00.000Z');

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'vip-already-used',
    qrHash: signedVipQr(state.vipGuests[0]),
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'duplicate');
});

test('sync retry with the same device and local scan ID returns the original outcome', async () => {
  const { service, state } = createHarness();
  const dto = {
    sourceDeviceId: 'device-a',
    scans: [
      {
        localScanId: 'local-retry',
        qrHash: signedTicketQr(state.tickets[0]),
        entityType: CheckInScanEntityType.ticket,
        scannedAt: '2026-08-20T12:00:00.000Z',
      },
    ],
  };

  const first = await service.syncEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-1', dto);
  const retry = await service.syncEvent({ id: 'staff-1', email: 'staff@example.test' }, 'concert-1', dto);

  assert.equal(first.outcomes[0].checkInId, retry.outcomes[0].checkInId);
  assert.equal(retry.outcomes[0].idempotent, true);
});

test('cross-device offline ticket scans resolve to first successful sync and later conflict outcome', async () => {
  const { service, state } = createHarness();
  const qrHash = signedTicketQr(state.tickets[0]);

  const first = await syncOne(service, 'concert-1', {
    localScanId: 'device-a-local',
    qrHash,
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });
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
  assert.equal(second.outcomes[0].resultCode, 'conflict');
  assert.equal(
    state.checkIns.filter((checkIn) => checkIn.status === CheckInStatus.SUCCESS).length,
    1,
  );
});

test('cross-device offline VIP scans resolve to conflict with winning check-in metadata', async () => {
  const { service, state } = createHarness();
  state.vipGuests[0].allowedGate = null;
  const qrHash = signedVipQr(state.vipGuests[0]);

  const first = await syncOne(service, 'concert-1', {
    localScanId: 'vip-device-a-local',
    qrHash,
    entityType: CheckInScanEntityType.vipGuest,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });
  const second = await service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    'concert-1',
    {
      sourceDeviceId: 'device-b',
      scans: [
        {
          localScanId: 'vip-device-b-local',
          qrHash,
          entityType: CheckInScanEntityType.vipGuest,
          scannedAt: '2026-08-20T12:01:00.000Z',
        },
      ],
    },
  );

  assert.equal(first.outcomes[0].resultCode, 'accepted');
  assert.equal(second.outcomes[0].resultCode, 'conflict');
  assert.equal(
    state.checkIns.filter((checkIn) => checkIn.status === CheckInStatus.SUCCESS).length,
    1,
  );
});

test('Redis rate limiting returns a retryable 429 before changing scan state', async () => {
  const { service, state } = createHarness({ redisCount: 301 });

  await assert.rejects(
    () =>
      syncOne(service, 'concert-1', {
        localScanId: 'rate-limited',
        qrHash: signedTicketQr(state.tickets[0]),
        entityType: CheckInScanEntityType.ticket,
        scannedAt: '2026-08-20T12:00:00.000Z',
      }),
    (error) => error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
  );
  assert.equal(state.checkIns.length, 0);
});

test('Kafka publish failures do not change the authoritative sync response', async () => {
  const { service, state } = createHarness({ publisherThrows: true });

  const response = await syncOne(service, 'concert-1', {
    localScanId: 'kafka-down',
    qrHash: signedTicketQr(state.tickets[0]),
    entityType: CheckInScanEntityType.ticket,
    scannedAt: '2026-08-20T12:00:00.000Z',
  });

  assert.equal(response.outcomes[0].resultCode, 'accepted');
});

function createHarness(
  overrides: {
    userRoles?: TestState['userRoles'];
    userPermissions?: TestState['userPermissions'];
    redisCount?: number;
    publisherThrows?: boolean;
    now?: Date;
  } = {},
): { service: CheckInService; state: TestState } {
  const serverNow = overrides.now ?? new Date('2026-08-20T12:00:05.000Z');
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
    checkInStaffAssignments: [
      {
        id: 'staff-assignment-a',
        userId: 'staff-1',
        concertId: 'concert-1',
        gateLabel: 'Gate A',
        assignedAt: new Date('2026-06-01T00:00:00.000Z'),
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
        order: {
          status: OrderStatus.PAID,
          paidAt: new Date('2026-06-15T12:00:00.000Z'),
          totalAmountVnd: 100_000,
          payments: [
            {
              status: PaymentStatus.SUCCESS,
              amountVnd: 100_000,
            },
          ],
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
        allowedGate: 'Gate A',
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
      () => serverNow,
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
      findMany: async ({ where, include }: { where: { staffUserId: string; concertId?: string; active: boolean; id?: string; OR?: { sourceDeviceId: string | null }[] }; include?: unknown }) =>
        state.assignments
          .filter((assignment) => assignment.staffUserId === where.staffUserId)
          .filter((assignment) => !where.concertId || assignment.concertId === where.concertId)
          .filter((assignment) => !where.id || assignment.id === where.id)
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
    checkInStaffAssignment: {
      findFirst: async ({ where }: { where: { userId: string; concertId: string } }) =>
        state.checkInStaffAssignments.find(
          (assignment) =>
            assignment.userId === where.userId && assignment.concertId === where.concertId,
        ) ?? null,
      findMany: async ({ where }: { where: { userId: string; concertId: string; id?: string } }) =>
        state.checkInStaffAssignments.filter(
          (assignment) =>
            assignment.userId === where.userId &&
            assignment.concertId === where.concertId &&
            (!where.id || assignment.id === where.id),
        ),
    },    concert: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.concerts.find((concert) => concert.id === where.id) ?? null,
    },
    ticket: {
      findMany: async ({ where }: { where: { concertId: string } }) =>
        state.tickets.filter((ticket) => ticket.concertId === where.concertId),
      findUnique: async ({ where }: { where: { id?: string } }) => {
        const ticket = state.tickets.find((candidate) => where.id !== undefined && candidate.id === where.id);
        const concert = ticket
          ? state.concerts.find((candidate) => candidate.id === ticket.concertId)
          : null;

        return ticket && concert ? { ...ticket, concert: { endsAt: concert.endsAt }, order: ticket.order } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestState['tickets'][0]> }) => {
        const ticket = state.tickets.find((candidate) => candidate.id === where.id);
        assert.ok(ticket);
        Object.assign(ticket, data);
        return ticket;
      },
    },
    vipGuest: {
      findMany: async ({ where }: { where: { concertId: string; status?: { in: VipGuestStatus[] }; import?: { status: ImportStatus } } }) =>
        state.vipGuests
          .filter((guest) => guest.concertId === where.concertId)
          .filter((guest) => !where.status || where.status.in.includes(guest.status))
          .filter((guest) => !where.import || guest.importStatus === where.import.status),
      findFirst: async ({ where }: { where: { id?: string; import?: { status: ImportStatus } } }) => {
        const guest = state.vipGuests
          .filter((candidate) => !where.import || candidate.importStatus === where.import.status)
          .find((candidate) => (where.id !== undefined ? candidate.id === where.id : false));
        const concert = guest
          ? state.concerts.find((candidate) => candidate.id === guest.concertId)
          : null;

        return guest && concert ? { ...guest, concert: { endsAt: concert.endsAt } } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestState['vipGuests'][0]> }) => {
        const guest = state.vipGuests.find((candidate) => candidate.id === where.id);
        assert.ok(guest);
        Object.assign(guest, data);
        return guest;
      },
    },
    checkIn: {
      findFirst: async ({ where }: { where: { sourceDeviceId?: string; localScanId?: string; ticketId?: string; vipGuestId?: string; status?: CheckInStatus } }) =>
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
          clientScannedAt: data.clientScannedAt ?? null,
          serverReceivedAt: data.serverReceivedAt ?? data.scannedAt ?? new Date(),
          serverCheckedInAt: data.serverCheckedInAt ?? null,
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
  overrides: Partial<{ concertId: string; nonce: string; entityId: string; issuer: string }> = {},
): string {
  return withIssuer(overrides.issuer, () =>
    createCheckInQrToken({
      entityType: CHECK_IN_QR_ENTITY_TYPES.ticket,
      entityId: overrides.entityId ?? ticket.id,
      concertId: overrides.concertId ?? ticket.concertId,
      nonce: overrides.nonce ?? ticket.qrHash,
      issuedAt: ticket.issuedAt,
      expiresAt,
    }),
  );
}

function signedVipQr(
  guest: TestState['vipGuests'][number],
  expiresAt = new Date('2026-08-27T15:30:00.000Z'),
  overrides: Partial<{ concertId: string; nonce: string; entityId: string; issuer: string }> = {},
): string {
  return withIssuer(overrides.issuer, () =>
    createCheckInQrToken({
      entityType: CHECK_IN_QR_ENTITY_TYPES.vipGuest,
      entityId: overrides.entityId ?? guest.id,
      concertId: overrides.concertId ?? guest.concertId,
      nonce: overrides.nonce ?? (guest.qrHash ?? guest.id),
      issuedAt: new Date('2026-06-15T12:00:00.000Z'),
      expiresAt,
    }),
  );
}

function withIssuer<T>(issuer: string | undefined, callback: () => T): T {
  const originalIssuer = process.env.CHECK_IN_QR_ISSUER;

  if (issuer) {
    process.env.CHECK_IN_QR_ISSUER = issuer;
  }

  try {
    return callback();
  } finally {
    process.env.CHECK_IN_QR_ISSUER = originalIssuer;
  }
}

function syncOne(
  service: CheckInService,
  concertId: string,
  scan: {
    localScanId: string;
    qrHash: string;
    entityType: CheckInScanEntityType;
    scannedAt: string;
    localResult?: string;
    mode?: CheckInClientMode;
  },
) {
  return service.syncEvent(
    { id: 'staff-1', email: 'staff@example.test' },
    concertId,
    {
      sourceDeviceId: 'device-a',
      scans: [scan],
    },
  );
}
