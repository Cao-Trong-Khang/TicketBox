import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CheckIn,
  CheckInMode,
  CheckInStatus,
  CheckInSyncStatus,
  ImportStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
  VipGuestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types';
import { PermissionService } from '../rbac/permission.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import {
  CHECK_IN_QR_ENTITY_TYPES,
  createCheckInQrToken,
  verifyCheckInQrTokenForEntity,
} from './check-in-qr-token';
import {
  CheckInAssignmentDto,
  CheckInPreloadDto,
  CheckInResultCode,
  CheckInSyncOutcomeDto,
  CheckInSyncResponseDto,
} from './check-in.types';
import {
  CheckInClientMode,
  CheckInScanEntityType,
  CheckInSyncScanDto,
  SyncCheckInDto,
} from './dto/sync-check-in.dto';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const PRELOAD_RATE_LIMIT = 120;
const SYNC_RATE_LIMIT = 300;
const DEFAULT_TICKET_QR_EXPIRATION_GRACE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_TICKET_QR_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_CLOCK_SKEW_SECONDS = 5 * 60;
const DEFAULT_OFFLINE_GRACE_SECONDS = 24 * 60 * 60;

export const CHECK_IN_NOW = 'CHECK_IN_NOW';

type AssignmentAccess = {
  id: string;
  gateName: string | null;
  sourceDeviceId: string | null;
};

type ScanTiming = {
  clientScannedAt: Date | null;
  serverReceivedAt: Date;
};

type WinningCheckIn = Pick<
  CheckIn,
  'id' | 'sourceDeviceId' | 'serverCheckedInAt' | 'scannedAt'
>;

type TicketPurchaseContext = {
  issuedAt: Date;
  order: {
    status: OrderStatus;
    paidAt: Date | null;
    totalAmountVnd: number;
    payments: {
      status: PaymentStatus;
      amountVnd: number;
    }[];
  };
};

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly redisCache: RedisCacheService,
    private readonly eventsPublisher: CheckInEventsPublisher,
    @Inject(CHECK_IN_NOW) private readonly now: () => Date,
  ) {}

  async listAssignments(user: AuthenticatedUser): Promise<CheckInAssignmentDto[]> {
    await this.assertCheckInStaffWithPermissions(user.id, [PERMISSION_CODES.checkinPreload]);

    const assignments = await this.prisma.checkInAssignment.findMany({
      where: {
        staffUserId: user.id,
        active: true,
      },
      orderBy: [{ concert: { startsAt: 'asc' } }, { gateName: 'asc' }],
      include: {
        concert: {
          select: {
            id: true,
            title: true,
            venueName: true,
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      concertId: assignment.concert.id,
      title: assignment.concert.title,
      venueName: assignment.concert.venueName,
      status: assignment.concert.status,
      gateName: assignment.gateName,
      sourceDeviceId: assignment.sourceDeviceId,
      startsAt: assignment.concert.startsAt.toISOString(),
      endsAt: assignment.concert.endsAt?.toISOString() ?? null,
    }));
  }

  async preloadEvent(user: AuthenticatedUser, concertId: string): Promise<CheckInPreloadDto> {
    const assignments = await this.assertAssignedCheckInStaff(user.id, concertId, [
      PERMISSION_CODES.checkinPreload,
    ]);

    await this.rateLimitOrThrow(
      `check-in:preload:user:${user.id}:concert:${concertId}`,
      PRELOAD_RATE_LIMIT,
    );

    const concert = await this.prisma.concert.findUnique({
      where: { id: concertId },
      select: {
        id: true,
        title: true,
        venueName: true,
        venueAddress: true,
        status: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    const [tickets, vipGuests] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { concertId },
        orderBy: { ticketCode: 'asc' },
        select: {
          id: true,
          ticketCode: true,
          qrHash: true,
          status: true,
          issuedAt: true,
          checkedInAt: true,
          ticketType: {
            select: {
              code: true,
              name: true,
            },
          },
          owner: {
            select: {
              email: true,
              displayName: true,
            },
          },
          checkIns: {
            where: {
              status: CheckInStatus.SUCCESS,
            },
            orderBy: [{ serverCheckedInAt: 'desc' }, { scannedAt: 'desc' }],
            take: 1,
            select: {
              scannedAt: true,
              serverCheckedInAt: true,
              sourceDeviceId: true,
              staffUser: {
                select: {
                  email: true,
                  displayName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.vipGuest.findMany({
        where: {
          concertId,
          status: {
            in: [VipGuestStatus.ACTIVE, VipGuestStatus.CHECKED_IN],
          },
          import: {
            status: ImportStatus.COMPLETED,
          },
        },
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          qrHash: true,
          externalGuestKey: true,
          fullName: true,
          email: true,
          phone: true,
          sponsorSource: true,
          sponsorCompany: true,
          invitedBy: true,
          guestType: true,
          allowedGate: true,
          status: true,
          checkedInAt: true,
          notes: true,
        },
      }),
    ]);

    const generatedAt = new Date();

    return {
      concert: {
        id: concert.id,
        title: concert.title,
        venueName: concert.venueName,
        venueAddress: concert.venueAddress,
        status: concert.status,
        startsAt: concert.startsAt.toISOString(),
        endsAt: concert.endsAt?.toISOString() ?? null,
      },
      assignments: assignments.map((assignment) => ({
        assignmentId: assignment.id,
        gateName: assignment.gateName,
        sourceDeviceId: assignment.sourceDeviceId,
      })),
      snapshot: {
        generatedAt: generatedAt.toISOString(),
        version: `checkin:${concertId}:${generatedAt.getTime()}`,
      },
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        qrHash: createCheckInQrToken({
          entityType: CHECK_IN_QR_ENTITY_TYPES.ticket,
          entityId: ticket.id,
          concertId,
          nonce: ticket.qrHash,
          issuedAt: ticket.issuedAt,
          expiresAt: this.resolveTicketQrExpiresAt(concert.endsAt, generatedAt),
        }),
        status: ticket.status,
        issuedAt: ticket.issuedAt.toISOString(),
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
        attendeeName: ticket.owner?.displayName ?? ticket.owner?.email ?? null,
        attendeeEmail: ticket.owner?.email ?? null,
        zoneOrSeat: ticket.ticketType.name,
        previousCheckIn: ticket.checkIns?.[0]
          ? {
              scannedAt: (
                ticket.checkIns[0].serverCheckedInAt ?? ticket.checkIns[0].scannedAt
              ).toISOString(),
              gate: ticket.checkIns[0].sourceDeviceId,
              staffName:
                ticket.checkIns[0].staffUser.displayName ?? ticket.checkIns[0].staffUser.email,
            }
          : null,
        ticketType: ticket.ticketType,
      })),
      vipGuests: vipGuests.map((guest) => ({
        id: guest.id,
        qrHash: createCheckInQrToken({
          entityType: CHECK_IN_QR_ENTITY_TYPES.vipGuest,
          entityId: guest.id,
          concertId,
          nonce: guest.qrHash ?? guest.id,
          issuedAt: guest.checkedInAt ?? generatedAt,
          expiresAt: this.resolveTicketQrExpiresAt(concert.endsAt, generatedAt),
        }),
        externalGuestKey: guest.externalGuestKey,
        fullName: guest.fullName,
        email: guest.email,
        phone: guest.phone,
        sponsorSource: guest.sponsorSource,
        sponsorCompany: guest.sponsorCompany,
        invitedBy: guest.invitedBy,
        guestType: guest.guestType,
        allowedGate: guest.allowedGate,
        status: guest.status,
        checkedInAt: guest.checkedInAt?.toISOString() ?? null,
        notes: guest.notes,
      })),
    };
  }

  async syncEvent(
    user: AuthenticatedUser,
    concertId: string,
    dto: SyncCheckInDto,
  ): Promise<CheckInSyncResponseDto> {
    const assignments = await this.assertAssignedCheckInStaff(user.id, concertId, [
      PERMISSION_CODES.checkinScan,
      PERMISSION_CODES.checkinSync,
    ], dto.sourceDeviceId);

    await this.rateLimitOrThrow(`check-in:sync:user:${user.id}:concert:${concertId}`, SYNC_RATE_LIMIT);
    await this.rateLimitOrThrow(
      `check-in:sync:device:${dto.sourceDeviceId}:concert:${concertId}`,
      SYNC_RATE_LIMIT,
    );

    const outcomes: CheckInSyncOutcomeDto[] = [];

    for (const scan of dto.scans) {
      outcomes.push(
        await this.syncOneScan(user.id, concertId, dto.sourceDeviceId, assignments, scan),
      );
    }

    return {
      sourceDeviceId: dto.sourceDeviceId,
      concertId,
      syncedAt: new Date().toISOString(),
      outcomes,
    };
  }

  private async syncOneScan(
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    assignments: AssignmentAccess[],
    scan: CheckInSyncScanDto,
  ): Promise<CheckInSyncOutcomeDto> {
    const serverReceivedAt = this.now();
    const existing = await this.findIdempotentCheckIn(sourceDeviceId, scan.localScanId);

    if (existing) {
      return this.toOutcome(existing, true);
    }

    const scanTiming = this.resolveScanTiming(scan, serverReceivedAt);

    try {
      const checkIn = await this.prisma.$transaction((tx) =>
        scanTiming.valid
          ? this.processNewScan(
              tx,
              staffUserId,
              concertId,
              sourceDeviceId,
              assignments,
              scan,
              scanTiming.timing,
            )
          : this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, scanTiming.timing, {
              status: CheckInStatus.INVALID_QR,
              note: scanTiming.reason,
            }),
      );

      await this.publishSafely(checkIn);

      return this.toOutcome(checkIn, false);
    } catch (error) {
      const existingAfterFailure = await this.findIdempotentCheckIn(
        sourceDeviceId,
        scan.localScanId,
      );

      if (existingAfterFailure) {
        return this.toOutcome(existingAfterFailure, true);
      }

      if (isUniqueConstraintError(error)) {
        const conflict = await this.recordConflictAfterUniqueFailure(
          staffUserId,
          concertId,
          sourceDeviceId,
          scan,
          scanTiming.timing,
        );

        await this.publishSafely(conflict);

        return this.toOutcome(conflict, false);
      }

      throw error;
    }
  }

  private async processNewScan(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    assignments: AssignmentAccess[],
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
  ): Promise<CheckIn> {
    if (scan.entityType === CheckInScanEntityType.vipGuest) {
      return this.processVipGuestScan(
        tx,
        staffUserId,
        concertId,
        sourceDeviceId,
        assignments,
        scan,
        timing,
      );
    }

    return this.processTicketScan(tx, staffUserId, concertId, sourceDeviceId, scan, timing);
  }

  private async processTicketScan(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
  ): Promise<CheckIn> {
    const verifiedTicketQr = verifyCheckInQrTokenForEntity(
      scan.qrHash,
      CHECK_IN_QR_ENTITY_TYPES.ticket,
      timing.serverReceivedAt,
    );

    if (!verifiedTicketQr.valid) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        status: CheckInStatus.INVALID_QR,
        note: verifiedTicketQr.reason,
      });
    }

    const ticket = await tx.ticket.findUnique({
      where: { id: verifiedTicketQr.payload.entityId },
      include: {
        concert: {
          select: {
            endsAt: true,
          },
        },
        order: {
          select: {
            status: true,
            paidAt: true,
            totalAmountVnd: true,
            payments: {
              select: {
                status: true,
                amountVnd: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        status: CheckInStatus.INVALID_QR,
        note: 'QR token was not found for any issued ticket',
      });
    }

    if (verifiedTicketQr.payload.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'QR token belongs to a different concert',
      });
    }

    if (
      ticket.qrHash !== verifiedTicketQr.payload.nonce ||
      ticket.concertId !== verifiedTicketQr.payload.concertId
    ) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.INVALID_QR,
        note: 'Ticket QR token does not match the issued ticket',
      });
    }

    if (ticket.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'Ticket belongs to a different concert',
      });
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.CANCELLED_TICKET,
        note: 'Ticket is cancelled',
      });
    }

    const purchaseError = this.validateTicketPurchaseContext(ticket, timing);

    if (purchaseError) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: purchaseError.status,
        note: purchaseError.note,
      });
    }

    if (this.isExpired(ticket.concert.endsAt, timing)) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.EXPIRED,
        note: 'Ticket was scanned after the concert ended',
      });
    }

    const existingSuccess = await tx.checkIn.findFirst({
      where: {
        ticketId: ticket.id,
        status: CheckInStatus.SUCCESS,
      },
      orderBy: [{ serverCheckedInAt: 'asc' }, { scannedAt: 'asc' }],
      select: {
        id: true,
        sourceDeviceId: true,
        serverCheckedInAt: true,
        scannedAt: true,
      },
    });

    if (this.isCrossDeviceWinner(existingSuccess, sourceDeviceId)) {
      return this.createWinnerConflictCheckIn(
        tx,
        staffUserId,
        concertId,
        sourceDeviceId,
        scan,
        timing,
        {
          ticketId: ticket.id,
          winningCheckIn: existingSuccess,
          note: 'Ticket was already checked in on another device',
        },
      );
    }

    if (existingSuccess || ticket.status === TicketStatus.USED || ticket.checkedInAt) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        ticketId: ticket.id,
        status: CheckInStatus.ALREADY_USED,
        note: 'Ticket already has a successful check-in',
      });
    }

    const checkIn = await this.createCheckIn(
      tx,
      staffUserId,
      concertId,
      sourceDeviceId,
      scan,
      timing,
      {
        ticketId: ticket.id,
        status: CheckInStatus.SUCCESS,
        note: scan.localResult ? `Local result: ${scan.localResult}` : null,
      },
    );

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.USED,
        checkedInAt: checkIn.serverCheckedInAt ?? timing.serverReceivedAt,
      },
    });

    return checkIn;
  }

  private async processVipGuestScan(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    assignments: AssignmentAccess[],
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
  ): Promise<CheckIn> {
    const verifiedVipQr = verifyCheckInQrTokenForEntity(
      scan.qrHash,
      CHECK_IN_QR_ENTITY_TYPES.vipGuest,
      timing.serverReceivedAt,
    );

    if (!verifiedVipQr.valid) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        status: CheckInStatus.INVALID_QR,
        note: verifiedVipQr.reason,
      });
    }

    const guest = await tx.vipGuest.findFirst({
      where: {
        id: verifiedVipQr.payload.entityId,
        import: {
          status: ImportStatus.COMPLETED,
        },
      },
      include: {
        concert: {
          select: {
            endsAt: true,
          },
        },
      },
    });

    if (!guest) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        status: CheckInStatus.INVALID_QR,
        note: 'QR token was not found for any VIP guest',
      });
    }

    if (verifiedVipQr.payload.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'QR token belongs to a different concert',
      });
    }

    if (
      (guest.qrHash ?? guest.id) !== verifiedVipQr.payload.nonce ||
      guest.concertId !== verifiedVipQr.payload.concertId
    ) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.INVALID_QR,
        note: 'VIP guest QR token does not match the imported guest',
      });
    }

    if (guest.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'VIP guest belongs to a different concert',
      });
    }

    if (!this.isVipGuestAllowedAtAssignedGate(guest.allowedGate, assignments)) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: `VIP guest is assigned to ${guest.allowedGate}`,
      });
    }

    if (guest.status === VipGuestStatus.CANCELLED) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.CANCELLED_TICKET,
        note: 'VIP guest entry is cancelled',
      });
    }

    if (this.isExpired(guest.concert.endsAt, timing)) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.EXPIRED,
        note: 'VIP guest was scanned after the concert ended',
      });
    }

    const existingSuccess = await tx.checkIn.findFirst({
      where: {
        vipGuestId: guest.id,
        status: CheckInStatus.SUCCESS,
      },
      orderBy: [{ serverCheckedInAt: 'asc' }, { scannedAt: 'asc' }],
      select: {
        id: true,
        sourceDeviceId: true,
        serverCheckedInAt: true,
        scannedAt: true,
      },
    });

    if (this.isCrossDeviceWinner(existingSuccess, sourceDeviceId)) {
      return this.createWinnerConflictCheckIn(
        tx,
        staffUserId,
        concertId,
        sourceDeviceId,
        scan,
        timing,
        {
          vipGuestId: guest.id,
          winningCheckIn: existingSuccess,
          note: 'VIP guest was already checked in on another device',
        },
      );
    }

    if (existingSuccess || guest.status === VipGuestStatus.CHECKED_IN || guest.checkedInAt) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
        vipGuestId: guest.id,
        status: CheckInStatus.ALREADY_USED,
        note: 'VIP guest already has a successful check-in',
      });
    }

    const checkIn = await this.createCheckIn(
      tx,
      staffUserId,
      concertId,
      sourceDeviceId,
      scan,
      timing,
      {
        vipGuestId: guest.id,
        status: CheckInStatus.SUCCESS,
        note: scan.localResult ? `Local result: ${scan.localResult}` : null,
      },
    );

    await tx.vipGuest.update({
      where: { id: guest.id },
      data: {
        status: VipGuestStatus.CHECKED_IN,
        checkedInAt: checkIn.serverCheckedInAt ?? timing.serverReceivedAt,
      },
    });

    return checkIn;
  }

  private async createCheckIn(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
    input: {
      ticketId?: string;
      vipGuestId?: string;
      status: CheckInStatus;
      serverCheckedInAt?: Date | null;
      note?: string | null;
    },
  ): Promise<CheckIn> {
    const data: Prisma.CheckInUncheckedCreateInput = {
      ticketId: input.ticketId,
      vipGuestId: input.vipGuestId,
      concertId,
      staffUserId,
      localScanId: scan.localScanId,
      sourceDeviceId,
      mode: scan.mode === CheckInClientMode.online ? CheckInMode.ONLINE : CheckInMode.OFFLINE,
      status: input.status,
      syncStatus: CheckInSyncStatus.SYNCED,
      scannedAt: timing.serverReceivedAt,
      clientScannedAt: timing.clientScannedAt,
      serverReceivedAt: timing.serverReceivedAt,
      serverCheckedInAt:
        input.serverCheckedInAt ??
        (input.status === CheckInStatus.SUCCESS ? timing.serverReceivedAt : null),
      syncedAt: timing.serverReceivedAt,
      note: input.note,
    };

    return tx.checkIn.create({ data });
  }

  private createWinnerConflictCheckIn(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
    input: {
      ticketId?: string;
      vipGuestId?: string;
      winningCheckIn: WinningCheckIn;
      note: string;
    },
  ): Promise<CheckIn> {
    return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, timing, {
      ticketId: input.ticketId,
      vipGuestId: input.vipGuestId,
      status: CheckInStatus.CONFLICT,
      serverCheckedInAt: this.getWinningServerCheckInAt(input.winningCheckIn),
      note: input.note,
    });
  }

  private async recordConflictAfterUniqueFailure(
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
    timing: ScanTiming,
  ): Promise<CheckIn> {
    const [ticket, vipGuest] =
      scan.entityType === CheckInScanEntityType.ticket
        ? [await this.findTicketFromSignedQrForConflict(scan.qrHash), null]
        : [null, await this.findVipGuestFromSignedQrForConflict(scan.qrHash)];

    return this.prisma.checkIn.create({
      data: {
        ticketId: ticket?.id,
        vipGuestId: vipGuest?.id,
        concertId,
        staffUserId,
        localScanId: scan.localScanId,
        sourceDeviceId,
        mode: scan.mode === CheckInClientMode.online ? CheckInMode.ONLINE : CheckInMode.OFFLINE,
        status: CheckInStatus.CONFLICT,
        syncStatus: CheckInSyncStatus.SYNCED,
        scannedAt: timing.serverReceivedAt,
        clientScannedAt: timing.clientScannedAt,
        serverReceivedAt: timing.serverReceivedAt,
        serverCheckedInAt:
          ticket !== null
            ? await this.findWinningServerCheckInAt({ ticketId: ticket.id })
            : vipGuest !== null
              ? await this.findWinningServerCheckInAt({ vipGuestId: vipGuest.id })
              : null,
        syncedAt: timing.serverReceivedAt,
        note: 'A successful check-in for this payload was recorded by another device first',
      },
    });
  }

  private async findTicketFromSignedQrForConflict(qrHash: string): Promise<{ id: string } | null> {
    const verifiedTicketQr = verifyCheckInQrTokenForEntity(
      qrHash,
      CHECK_IN_QR_ENTITY_TYPES.ticket,
    );

    if (!verifiedTicketQr.valid) {
      return null;
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: verifiedTicketQr.payload.entityId },
      select: {
        id: true,
        concertId: true,
        qrHash: true,
      },
    });

    if (
      !ticket ||
      ticket.qrHash !== verifiedTicketQr.payload.nonce ||
      ticket.concertId !== verifiedTicketQr.payload.concertId
    ) {
      return null;
    }

    return { id: ticket.id };
  }

  private async findVipGuestFromSignedQrForConflict(
    qrHash: string,
  ): Promise<{ id: string } | null> {
    const verifiedVipQr = verifyCheckInQrTokenForEntity(
      qrHash,
      CHECK_IN_QR_ENTITY_TYPES.vipGuest,
    );

    if (!verifiedVipQr.valid) {
      return null;
    }

    const guest = await this.prisma.vipGuest.findFirst({
      where: {
        id: verifiedVipQr.payload.entityId,
      },
      select: {
        id: true,
        concertId: true,
        qrHash: true,
      },
    });

    if (
      !guest ||
      (guest.qrHash ?? guest.id) !== verifiedVipQr.payload.nonce ||
      guest.concertId !== verifiedVipQr.payload.concertId
    ) {
      return null;
    }

    return { id: guest.id };
  }

  private async findIdempotentCheckIn(
    sourceDeviceId: string,
    localScanId: string,
  ): Promise<CheckIn | null> {
    return this.prisma.checkIn.findFirst({
      where: {
        sourceDeviceId,
        localScanId,
      },
    });
  }

  private isCrossDeviceWinner(
    winningCheckIn: WinningCheckIn | null,
    sourceDeviceId: string,
  ): winningCheckIn is WinningCheckIn {
    return winningCheckIn !== null && winningCheckIn.sourceDeviceId !== sourceDeviceId;
  }

  private getWinningServerCheckInAt(winningCheckIn: WinningCheckIn): Date {
    return winningCheckIn.serverCheckedInAt ?? winningCheckIn.scannedAt;
  }

  private validateTicketPurchaseContext(
    ticket: TicketPurchaseContext,
    timing: ScanTiming,
  ): { status: CheckInStatus; note: string } | null {
    if (ticket.issuedAt.getTime() > timing.serverReceivedAt.getTime()) {
      return {
        status: CheckInStatus.INVALID_QR,
        note: 'Ticket has not been issued by the server',
      };
    }

    if (ticket.order.status === OrderStatus.CANCELLED) {
      return {
        status: CheckInStatus.CANCELLED_TICKET,
        note: 'Ticket order is cancelled or refunded',
      };
    }

    if (ticket.order.status !== OrderStatus.PAID || ticket.order.paidAt === null) {
      return {
        status: CheckInStatus.INVALID_QR,
        note: 'Ticket order has not been paid',
      };
    }

    const successfulPaymentAmount = ticket.order.payments
      .filter((payment) => payment.status === PaymentStatus.SUCCESS)
      .reduce((total, payment) => total + payment.amountVnd, 0);

    if (ticket.order.totalAmountVnd > 0 && successfulPaymentAmount < ticket.order.totalAmountVnd) {
      return {
        status: CheckInStatus.INVALID_QR,
        note: 'Ticket order does not have a successful payment',
      };
    }

    return null;
  }

  private async findWinningServerCheckInAt(where: {
    ticketId?: string;
    vipGuestId?: string;
  }): Promise<Date | null> {
    const winningCheckIn = await this.prisma.checkIn.findFirst({
      where: {
        ...where,
        status: CheckInStatus.SUCCESS,
      },
      orderBy: [{ serverCheckedInAt: 'asc' }, { scannedAt: 'asc' }],
      select: {
        serverCheckedInAt: true,
        scannedAt: true,
      },
    });

    return winningCheckIn?.serverCheckedInAt ?? winningCheckIn?.scannedAt ?? null;
  }

  private resolveScanTiming(
    scan: CheckInSyncScanDto,
    serverReceivedAt: Date,
  ):
    | { valid: true; timing: ScanTiming }
    | { valid: false; timing: ScanTiming; reason: string } {
    const parsedClientScannedAt = new Date(scan.scannedAt);
    const timing: ScanTiming = {
      clientScannedAt: Number.isNaN(parsedClientScannedAt.getTime())
        ? null
        : parsedClientScannedAt,
      serverReceivedAt,
    };

    if (!timing.clientScannedAt) {
      return {
        valid: false,
        timing,
        reason: 'Client scannedAt timestamp is invalid',
      };
    }

    const futureSkewMs = timing.clientScannedAt.getTime() - serverReceivedAt.getTime();

    if (futureSkewMs > this.getClockSkewMs()) {
      return {
        valid: false,
        timing,
        reason: 'Client scannedAt is outside allowed clock skew',
      };
    }

    const offlineAgeMs = serverReceivedAt.getTime() - timing.clientScannedAt.getTime();

    if (offlineAgeMs > this.getOfflineGraceMs()) {
      return {
        valid: false,
        timing,
        reason: 'Offline scan is outside allowed grace window',
      };
    }

    return { valid: true, timing };
  }

  private async assertAssignedCheckInStaff(
    userId: string,
    concertId: string,
    requiredPermissions: string[],
    sourceDeviceId?: string,
  ): Promise<AssignmentAccess[]> {
    await this.assertCheckInStaffWithPermissions(userId, requiredPermissions);

    const assignments = await this.prisma.checkInAssignment.findMany({
      where: {
        staffUserId: userId,
        concertId,
        active: true,
        ...(sourceDeviceId
          ? {
              OR: [{ sourceDeviceId: null }, { sourceDeviceId }],
            }
          : {}),
      },
      select: {
        id: true,
        gateName: true,
        sourceDeviceId: true,
      },
    });

    if (assignments.length === 0) {
      throw new ForbiddenException('Check-in staff is not assigned to this concert or device');
    }

    return assignments;
  }

  private isVipGuestAllowedAtAssignedGate(
    allowedGate: string | null,
    assignments: AssignmentAccess[],
  ): boolean {
    if (!allowedGate) {
      return true;
    }

    const normalizedAllowedGate = this.normalizeGateName(allowedGate);

    return assignments.some(
      (assignment) =>
        assignment.gateName !== null &&
        this.normalizeGateName(assignment.gateName) === normalizedAllowedGate,
    );
  }

  private normalizeGateName(gateName: string): string {
    return gateName.trim().toLowerCase();
  }

  private async assertCheckInStaffWithPermissions(
    userId: string,
    requiredPermissions: string[],
  ): Promise<void> {
    const [userRoles, hasPermissions] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        include: {
          role: true,
        },
      }),
      this.permissionService.userHasPermissions(userId, requiredPermissions),
    ]);

    const isCheckInStaff = userRoles.some(
      (userRole) => userRole.role.code === ROLE_CODES.checkinStaff,
    );

    if (!isCheckInStaff || !hasPermissions) {
      throw new ForbiddenException('Check-in Staff role and permissions are required');
    }
  }

  private async rateLimitOrThrow(key: string, limit: number): Promise<void> {
    const count = await this.redisCache.incrementWithTtl(key, RATE_LIMIT_WINDOW_SECONDS);

    if (count !== null && count > limit) {
      throw new HttpException(
        {
          message: 'Check-in endpoint rate limit exceeded',
          retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private resolveTicketQrExpiresAt(concertEndsAt: Date | null, generatedAt: Date): Date {
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
      generatedAt.getTime() +
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

  private getClockSkewMs(): number {
    return (
      this.readPositiveIntegerEnv(
        'CHECK_IN_MAX_CLOCK_SKEW_SECONDS',
        DEFAULT_CLOCK_SKEW_SECONDS,
      ) * 1000
    );
  }

  private getOfflineGraceMs(): number {
    return (
      this.readPositiveIntegerEnv(
        'CHECK_IN_OFFLINE_GRACE_SECONDS',
        DEFAULT_OFFLINE_GRACE_SECONDS,
      ) * 1000
    );
  }

  private async publishSafely(checkIn: CheckIn): Promise<void> {
    try {
      await this.eventsPublisher.publishSyncOutcome(checkIn);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Kafka publish error';
      this.logger.warn(`Check-in analytics publish failed for ${checkIn.id}: ${message}`);
    }
  }

  private toOutcome(checkIn: CheckIn, idempotent: boolean): CheckInSyncOutcomeDto {
    return {
      localScanId: checkIn.localScanId,
      checkInId: checkIn.id,
      resultCode: this.toResultCode(checkIn.status),
      status: checkIn.status,
      message: this.toMessage(checkIn.status),
      syncedAt: checkIn.syncedAt?.toISOString() ?? null,
      serverCheckInAt:
        checkIn.serverCheckedInAt?.toISOString() ??
        (checkIn.status === CheckInStatus.SUCCESS ? checkIn.scannedAt.toISOString() : null),
      idempotent,
    };
  }

  private toResultCode(status: CheckInStatus): CheckInResultCode {
    switch (status) {
      case CheckInStatus.SUCCESS:
        return 'accepted';
      case CheckInStatus.ALREADY_USED:
        return 'duplicate';
      case CheckInStatus.EXPIRED:
        return 'expired';
      case CheckInStatus.UNAUTHORIZED:
      case CheckInStatus.WRONG_CONCERT:
        return 'unauthorized';
      case CheckInStatus.CONFLICT:
        return 'conflict';
      case CheckInStatus.INVALID_QR:
      case CheckInStatus.CANCELLED_TICKET:
      default:
        return 'invalid';
    }
  }

  private toMessage(status: CheckInStatus): string {
    switch (status) {
      case CheckInStatus.SUCCESS:
        return 'Scan accepted';
      case CheckInStatus.ALREADY_USED:
        return 'Duplicate scan';
      case CheckInStatus.EXPIRED:
        return 'Scan expired';
      case CheckInStatus.UNAUTHORIZED:
      case CheckInStatus.WRONG_CONCERT:
        return 'Scan is not authorized for this event';
      case CheckInStatus.CONFLICT:
        return 'Ticket or guest was already checked in on another device';
      case CheckInStatus.CANCELLED_TICKET:
        return 'Ticket or guest entry is cancelled';
      case CheckInStatus.INVALID_QR:
      default:
        return 'QR payload is invalid';
    }
  }

  private isExpired(endsAt: Date | null, timing: ScanTiming): boolean {
    if (!endsAt) {
      return false;
    }

    if (timing.serverReceivedAt.getTime() <= endsAt.getTime()) {
      return false;
    }

    const offlineGraceEndsAt = endsAt.getTime() + this.getOfflineGraceMs();

    if (timing.serverReceivedAt.getTime() > offlineGraceEndsAt) {
      return true;
    }

    return !timing.clientScannedAt || timing.clientScannedAt.getTime() > endsAt.getTime();
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
