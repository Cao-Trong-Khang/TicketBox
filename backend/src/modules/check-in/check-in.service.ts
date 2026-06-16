import {
  ForbiddenException,
  HttpException,
  HttpStatus,
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

type AssignmentAccess = {
  id: string;
  gateName: string | null;
  sourceDeviceId: string | null;
};

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly redisCache: RedisCacheService,
    private readonly eventsPublisher: CheckInEventsPublisher,
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
            orderBy: {
              scannedAt: 'desc',
            },
            take: 1,
            select: {
              scannedAt: true,
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
        qrHash: ticket.qrHash,
        status: ticket.status,
        issuedAt: ticket.issuedAt.toISOString(),
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
        attendeeName: ticket.owner?.displayName ?? ticket.owner?.email ?? null,
        attendeeEmail: ticket.owner?.email ?? null,
        zoneOrSeat: ticket.ticketType.name,
        previousCheckIn: ticket.checkIns?.[0]
          ? {
              scannedAt: ticket.checkIns[0].scannedAt.toISOString(),
              gate: ticket.checkIns[0].sourceDeviceId,
              staffName:
                ticket.checkIns[0].staffUser.displayName ?? ticket.checkIns[0].staffUser.email,
            }
          : null,
        ticketType: ticket.ticketType,
      })),
      vipGuests: vipGuests.map((guest) => ({
        id: guest.id,
        qrHash: guest.qrHash,
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
    await this.assertAssignedCheckInStaff(user.id, concertId, [
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
      outcomes.push(await this.syncOneScan(user.id, concertId, dto.sourceDeviceId, scan));
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
    scan: CheckInSyncScanDto,
  ): Promise<CheckInSyncOutcomeDto> {
    const existing = await this.findIdempotentCheckIn(sourceDeviceId, scan.localScanId);

    if (existing) {
      return this.toOutcome(existing, true);
    }

    try {
      const checkIn = await this.prisma.$transaction((tx) =>
        this.processNewScan(tx, staffUserId, concertId, sourceDeviceId, scan),
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
    scan: CheckInSyncScanDto,
  ): Promise<CheckIn> {
    if (scan.entityType === CheckInScanEntityType.vipGuest) {
      return this.processVipGuestScan(tx, staffUserId, concertId, sourceDeviceId, scan);
    }

    return this.processTicketScan(tx, staffUserId, concertId, sourceDeviceId, scan);
  }

  private async processTicketScan(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
  ): Promise<CheckIn> {
    const scannedAt = new Date(scan.scannedAt);
    const ticket = await tx.ticket.findUnique({
      where: { qrHash: scan.qrHash },
      include: {
        concert: {
          select: {
            endsAt: true,
          },
        },
      },
    });

    if (!ticket) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        status: CheckInStatus.INVALID_QR,
        note: 'QR hash was not found for any issued ticket',
      });
    }

    if (ticket.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        ticketId: ticket.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'Ticket belongs to a different concert',
      });
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        ticketId: ticket.id,
        status: CheckInStatus.CANCELLED_TICKET,
        note: 'Ticket is cancelled',
      });
    }

    if (this.isExpired(ticket.concert.endsAt, scannedAt)) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
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
      select: { id: true },
    });

    if (existingSuccess || ticket.status === TicketStatus.USED || ticket.checkedInAt) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        ticketId: ticket.id,
        status: CheckInStatus.ALREADY_USED,
        note: 'Ticket already has a successful check-in',
      });
    }

    const checkIn = await this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
      ticketId: ticket.id,
      status: CheckInStatus.SUCCESS,
      note: scan.localResult ? `Local result: ${scan.localResult}` : null,
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.USED,
        checkedInAt: checkIn.scannedAt,
      },
    });

    return checkIn;
  }

  private async processVipGuestScan(
    tx: Prisma.TransactionClient,
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
  ): Promise<CheckIn> {
    const scannedAt = new Date(scan.scannedAt);
    const guest = await tx.vipGuest.findFirst({
      where: {
        OR: [{ qrHash: scan.qrHash }, { externalGuestKey: scan.qrHash }],
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
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        status: CheckInStatus.INVALID_QR,
        note: 'QR hash was not found for any VIP guest',
      });
    }

    if (guest.concertId !== concertId) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        vipGuestId: guest.id,
        status: CheckInStatus.UNAUTHORIZED,
        note: 'VIP guest belongs to a different concert',
      });
    }

    if (guest.status === VipGuestStatus.CANCELLED) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        vipGuestId: guest.id,
        status: CheckInStatus.CANCELLED_TICKET,
        note: 'VIP guest entry is cancelled',
      });
    }

    if (this.isExpired(guest.concert.endsAt, scannedAt)) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
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
      select: { id: true },
    });

    if (existingSuccess || guest.status === VipGuestStatus.CHECKED_IN || guest.checkedInAt) {
      return this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
        vipGuestId: guest.id,
        status: CheckInStatus.ALREADY_USED,
        note: 'VIP guest already has a successful check-in',
      });
    }

    const checkIn = await this.createCheckIn(tx, staffUserId, concertId, sourceDeviceId, scan, {
      vipGuestId: guest.id,
      status: CheckInStatus.SUCCESS,
      note: scan.localResult ? `Local result: ${scan.localResult}` : null,
    });

    await tx.vipGuest.update({
      where: { id: guest.id },
      data: {
        status: VipGuestStatus.CHECKED_IN,
        checkedInAt: checkIn.scannedAt,
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
    input: {
      ticketId?: string;
      vipGuestId?: string;
      status: CheckInStatus;
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
      scannedAt: new Date(scan.scannedAt),
      syncedAt: new Date(),
      note: input.note,
    };

    return tx.checkIn.create({ data });
  }

  private async recordConflictAfterUniqueFailure(
    staffUserId: string,
    concertId: string,
    sourceDeviceId: string,
    scan: CheckInSyncScanDto,
  ): Promise<CheckIn> {
    const [ticket, vipGuest] =
      scan.entityType === CheckInScanEntityType.ticket
        ? [
            await this.prisma.ticket.findUnique({
              where: { qrHash: scan.qrHash },
              select: { id: true },
            }),
            null,
          ]
        : [
            null,
            await this.prisma.vipGuest.findFirst({
              where: {
                OR: [{ qrHash: scan.qrHash }, { externalGuestKey: scan.qrHash }],
              },
              select: { id: true },
            }),
          ];

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
        scannedAt: new Date(scan.scannedAt),
        syncedAt: new Date(),
        note: 'A successful check-in for this payload was recorded by another device first',
      },
    });
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
      serverCheckInAt: checkIn.scannedAt?.toISOString() ?? null,
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
        return 'Another device synchronized a successful scan first';
      case CheckInStatus.CANCELLED_TICKET:
        return 'Ticket or guest entry is cancelled';
      case CheckInStatus.INVALID_QR:
      default:
        return 'QR payload is invalid';
    }
  }

  private isExpired(endsAt: Date | null, scannedAt: Date): boolean {
    return endsAt !== null && scannedAt.getTime() > endsAt.getTime();
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
