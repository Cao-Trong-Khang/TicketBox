import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGateStaffAssignmentDto } from './dto/create-gate-staff-assignment.dto';

@Injectable()
export class GateStaffAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssignment(actorUserId: string, concertId: string, dto: CreateGateStaffAssignmentDto) {
    await this.ensureOrganizerOwnsConcert(actorUserId, concertId);
    await this.ensureUserExists(dto.user_id);

    try {
      const assignment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.gateStaffAssignment.create({
          data: {
            concertId,
            userId: dto.user_id,
            gateLabel: dto.gate_label.trim(),
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'gate_staff.assigned',
            targetType: 'gate_staff_assignment',
            targetId: created.id,
            metadataJson: JSON.stringify({
              concert_id: concertId,
              user_id: dto.user_id,
              gate_label: dto.gate_label.trim(),
            }),
          },
        });

        return created;
      });

      return {
        id: assignment.id,
        concert_id: assignment.concertId,
        user_id: assignment.userId,
        gate_label: assignment.gateLabel,
        assigned_at: assignment.assignedAt,
      };
    } catch (error) {
      if (isGateAssignmentUniqueError(error)) {
        throw new ConflictException('Gate staff user is already assigned to this concert');
      }

      throw error;
    }
  }

  async listAssignments(actorUserId: string, concertId: string) {
    await this.ensureOrganizerOwnsConcert(actorUserId, concertId);

    const assignments = await this.prisma.gateStaffAssignment.findMany({
      where: { concertId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });

    return assignments.map((assignment) => ({
      id: assignment.id,
      concert_id: assignment.concertId,
      user_id: assignment.userId,
      gate_label: assignment.gateLabel,
      assigned_at: assignment.assignedAt,
      user: assignment.user,
    }));
  }

  async deleteAssignment(actorUserId: string, concertId: string, assignmentId: string): Promise<void> {
    await this.ensureOrganizerOwnsConcert(actorUserId, concertId);

    const assignment = await this.prisma.gateStaffAssignment.findFirst({
      where: {
        id: assignmentId,
        concertId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Gate staff assignment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.gateStaffAssignment.delete({ where: { id: assignment.id } });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'gate_staff.removed',
          targetType: 'gate_staff_assignment',
          targetId: assignment.id,
          metadataJson: JSON.stringify({
            concert_id: concertId,
            user_id: assignment.userId,
            gate_label: assignment.gateLabel,
          }),
        },
      });
    });
  }

  async assertGateStaffAssigned(userId: string, concertId: string, gateLabel?: string): Promise<void> {
    const assignment = await this.prisma.gateStaffAssignment.findFirst({
      where: {
        userId,
        concertId,
        ...(gateLabel ? { gateLabel } : {}),
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Gate staff user is not assigned to this concert or gate');
    }
  }

  private async ensureOrganizerOwnsConcert(organizerId: string, concertId: string): Promise<void> {
    const concert = await this.prisma.concert.findUnique({
      where: { id: concertId },
      select: { organizerId: true },
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    if (concert.organizerId !== organizerId) {
      throw new ForbiddenException('Organizer does not own this concert');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}

function isGateAssignmentUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('concert_id') &&
    error.meta.target.includes('user_id')
  );
}
