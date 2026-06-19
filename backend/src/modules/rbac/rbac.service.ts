import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLE_CODES } from './rbac.constants';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      permissions: role.rolePermissions
        .map((rolePermission) => rolePermission.permission.code)
        .sort(),
    }));
  }

  async getUserRoles(userId: string) {
    await this.ensureUserExists(userId);

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
      orderBy: { createdAt: 'asc' },
    });

    return userRoles.map((userRole) => ({
      code: userRole.role.code,
      name: userRole.role.name,
      assigned_at: userRole.createdAt,
    }));
  }

  async assignUserRole(actorUserId: string, userId: string, roleCode: string) {
    await this.ensureUserExists(userId);
    const role = await this.ensureRoleExists(roleCode);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'user_role.assigned',
            targetType: 'user',
            targetId: userId,
            metadataJson: JSON.stringify({ role_code: roleCode }),
          },
        });
      });
    } catch (error) {
      if (isUserRoleUniqueError(error)) {
        throw new ConflictException('User already has this role');
      }

      throw error;
    }

    return this.getUserRoles(userId);
  }

  async removeUserRole(actorUserId: string, userId: string, roleCode: string): Promise<void> {
    await this.ensureUserExists(userId);
    const role = await this.ensureRoleExists(roleCode);

    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User role assignment not found');
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

      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'user_role.removed',
          targetType: 'user',
          targetId: userId,
          metadataJson: JSON.stringify({ role_code: roleCode }),
        },
      });
    });
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async ensureRoleExists(roleCode: string) {
    if (!Object.values(ROLE_CODES).includes(roleCode as (typeof ROLE_CODES)[keyof typeof ROLE_CODES])) {
      throw new NotFoundException('Role not found');
    }

    const role = await this.prisma.role.findUnique({ where: { code: roleCode } });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }
}

function isUserRoleUniqueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('user_id') &&
    error.meta.target.includes('role_id')
  );
}
