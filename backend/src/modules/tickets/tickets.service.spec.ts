import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CHECK_IN_QR_ENTITY_TYPES,
  verifyCheckInQrTokenForEntity,
} from '../check-in/check-in-qr-token';
import { TicketsService } from './tickets.service';

process.env.CHECK_IN_QR_HMAC_SECRET = 'test-check-in-qr-hmac-secret-1234567890';

test('listMyTickets returns audience e-ticket signed QR tokens scoped to the authenticated owner', async () => {
  const prisma = {
    ticket: {
      findMany: async ({ where }: { where: { ownerUserId: string } }) => {
        assert.equal(where.ownerUserId, 'audience-1');

        return [
          {
            id: 'ticket-1',
            concertId: 'concert-1',
            ticketCode: 'DEMO-001',
            qrHash: 'ticket-qr-1',
            status: TicketStatus.ACTIVE,
            issuedAt: new Date('2026-06-15T12:00:00.000Z'),
            checkedInAt: null,
            concert: {
              title: 'Demo Concert',
              startsAt: new Date('2026-08-20T11:00:00.000Z'),
              endsAt: new Date('2026-08-20T15:30:00.000Z'),
            },
          },
        ];
      },
    },
  };

  const service = new TicketsService(prisma as unknown as PrismaService);
  const tickets = await service.listMyTickets({ id: 'audience-1', email: 'audience@example.test' });

  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].concertId, 'concert-1');

  const verification = verifyCheckInQrTokenForEntity(
    tickets[0].signedQrToken,
    CHECK_IN_QR_ENTITY_TYPES.ticket,
    new Date('2026-08-01T00:00:00.000Z'),
  );

  assert.equal(verification.valid, true);

  if (verification.valid) {
    assert.equal(verification.payload.entityId, 'ticket-1');
    assert.equal(verification.payload.concertId, 'concert-1');
    assert.equal(verification.payload.nonce, 'ticket-qr-1');
    assert.equal(verification.payload.entityType, CHECK_IN_QR_ENTITY_TYPES.ticket);
  }
});
