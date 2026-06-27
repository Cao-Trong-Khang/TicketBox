import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: true },
          orderBy: { permission: { code: 'asc' } },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      permissions: role.rolePermissions.map((rolePermission) => ({
        code: rolePermission.permission.code,
        description: rolePermission.permission.description,
      })),
    }));
  }

  async listUserRoles(userId: string) {
    await this.assertUserExists(userId);

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      orderBy: { role: { code: 'asc' } },
      include: { role: true },
    });

    return userRoles.map((userRole) => ({
      id: userRole.role.id,
      code: userRole.role.code,
      name: userRole.role.name,
    }));
  }

  async assignRole(actorUserId: string, userId: string, roleCode: string) {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const [targetUser, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { code: normalizedRoleCode } }),
    ]);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
          },
        });
        await this.auditLog.record(
          {
            actorUserId,
            action: 'role.assigned',
            targetType: 'user',
            targetId: userId,
            metadata: { roleCode: role.code },
          },
          tx,
        );
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('User already has this role');
      }

      throw error;
    }

    return this.listUserRoles(userId);
  }

  async removeRole(actorUserId: string, userId: string, roleCode: string): Promise<void> {
    const normalizedRoleCode = normalizeRoleCode(roleCode);
    const [targetUser, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.role.findUnique({ where: { code: normalizedRoleCode } }),
    ]);

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.delete({
        where: {
          userId_roleId: {
            userId,
            roleId: role.id,
          },
        },
      });
      await this.auditLog.record(
        {
          actorUserId,
          action: 'role.removed',
          targetType: 'user',
          targetId: userId,
          metadata: { roleCode: role.code },
        },
        tx,
      );
    });
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}

function normalizeRoleCode(roleCode: string): string {
  return roleCode.trim().toUpperCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}