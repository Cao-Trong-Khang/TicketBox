import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types';
import { CHECK_IN_QR_ENTITY_TYPES, createCheckInQrToken } from '../check-in/check-in-qr-token';

const DEFAULT_TICKET_QR_EXPIRATION_GRACE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_TICKET_QR_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export type MyTicketDto = {
  id: string;
  concertId: string;
  concertTitle: string;
  concertStartsAt: string;
  concertEndsAt: string | null;
  ticketCode: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt: string | null;
  signedQrToken: string;
};

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyTickets(user: AuthenticatedUser): Promise<MyTicketDto[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        ownerUserId: user.id,
      },
      orderBy: [{ concert: { startsAt: 'asc' } }, { ticketCode: 'asc' }],
      select: {
        id: true,
        concertId: true,
        ticketCode: true,
        qrHash: true,
        status: true,
        issuedAt: true,
        checkedInAt: true,
        concert: {
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    return tickets.map((ticket) => ({
      id: ticket.id,
      concertId: ticket.concertId,
      concertTitle: ticket.concert.title,
      concertStartsAt: ticket.concert.startsAt.toISOString(),
      concertEndsAt: ticket.concert.endsAt?.toISOString() ?? null,
      ticketCode: ticket.ticketCode,
      status: ticket.status,
      issuedAt: ticket.issuedAt.toISOString(),
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      signedQrToken: createCheckInQrToken({
        entityType: CHECK_IN_QR_ENTITY_TYPES.ticket,
        entityId: ticket.id,
        concertId: ticket.concertId,
        nonce: ticket.qrHash,
        issuedAt: ticket.issuedAt,
        expiresAt: this.resolveTicketQrExpiresAt(ticket.concert.endsAt, ticket.issuedAt),
      }),
    }));
  }

  private resolveTicketQrExpiresAt(concertEndsAt: Date | null, referenceDate: Date): Date {
    if (concertEndsAt) {
      return new Date(
        concertEndsAt.getTime() +
          this.readPositiveIntegerEnv(
            'CHECK_IN_QR_EXPIRATION_GRACE_SECONDS',
            DEFAULT_TICKET_QR_EXPIRATION_GRACE_SECONDS,
          ) *
            1000,
      );
    }

    return new Date(
      referenceDate.getTime() +
        this.readPositiveIntegerEnv(
          'CHECK_IN_QR_TOKEN_TTL_SECONDS',
          DEFAULT_TICKET_QR_TOKEN_TTL_SECONDS,
        ) *
          1000,
    );
  }

  private readPositiveIntegerEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);

    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
