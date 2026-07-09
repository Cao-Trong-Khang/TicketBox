import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_CODES } from '../rbac/rbac.constants';

@Injectable()
export class CheckInStaffAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async assignStaff(actorUserId: string, concertId: string, userId: string, gateLabel: string) {
    const concert = await this.assertOrganizerOwnsConcert(actorUserId, concertId);
    await this.assertUserIsCheckInStaff(userId);

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.checkInStaffAssignment.create({
          data: {
            concertId: concert.id,
            userId,
            gateLabel: gateLabel.trim(),
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        });
        await this.auditLog.record(
          {
            actorUserId,
            action: 'check_in_staff.assigned',
            targetType: 'check_in_staff_assignment',
            targetId: created.id,
            metadata: {
              concertId: concert.id,
              staffUserId: userId,
              gateLabel: created.gateLabel,
            },
          },
          tx,
        );

        return created;
      });

      return this.toAssignmentDto(assignment);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Check-in Staff user is already assigned to this concert');
      }

      throw error;
    }
  }

  async listStaff(actorUserId: string, concertId: string) {
    const concert = await this.assertOrganizerOwnsConcert(actorUserId, concertId);
    const assignments = await this.prisma.checkInStaffAssignment.findMany({
      where: { concertId: concert.id },
      orderBy: [{ gateLabel: 'asc' }, { assignedAt: 'asc' }],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return assignments.map((assignment) => this.toAssignmentDto(assignment));
  }

  async removeStaff(actorUserId: string, concertId: string, assignmentId: string): Promise<void> {
    const concert = await this.assertOrganizerOwnsConcert(actorUserId, concertId);
    const assignment = await this.prisma.checkInStaffAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment || assignment.concertId !== concert.id) {
      throw new NotFoundException('Check-in Staff assignment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.checkInStaffAssignment.delete({ where: { id: assignment.id } });
      await this.auditLog.record(
        {
          actorUserId,
          action: 'check_in_staff.removed',
          targetType: 'check_in_staff_assignment',
          targetId: assignment.id,
          metadata: {
            concertId: concert.id,
            staffUserId: assignment.userId,
            gateLabel: assignment.gateLabel,
          },
        },
        tx,
      );
    });
  }

  private async assertOrganizerOwnsConcert(actorUserId: string, concertId: string) {
    const concert = await this.prisma.concert.findUnique({
      where: { id: concertId },
      select: {
        id: true,
        organizerId: true,
      },
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    if (concert.organizerId !== actorUserId) {
      throw new ForbiddenException('Organizer does not own this concert');
    }

    return concert;
  }

  private async assertUserIsCheckInStaff(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const staffRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { code: ROLE_CODES.checkinStaff },
      },
      select: { userId: true },
    });

    if (!staffRole) {
      throw new ForbiddenException('Target user must have CHECKIN_STAFF role');
    }
  }

  private toAssignmentDto(assignment: {
    id: string;
    concertId: string;
    userId: string;
    gateLabel: string;
    assignedAt: Date;
    user?: {
      id: string;
      email: string;
      displayName: string | null;
    };
  }) {
    return {
      id: assignment.id,
      concertId: assignment.concertId,
      userId: assignment.userId,
      gateLabel: assignment.gateLabel,
      assignedAt: assignment.assignedAt.toISOString(),
      user: assignment.user
        ? {
            id: assignment.user.id,
            email: assignment.user.email,
            displayName: assignment.user.displayName,
          }
        : undefined,
    };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}