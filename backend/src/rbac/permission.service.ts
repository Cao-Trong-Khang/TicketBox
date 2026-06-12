import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissionCodes = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionCodes.add(rolePermission.permission.code);
      }
    }

    return [...permissionCodes].sort();
  }

  async userHasPermissions(userId: string, requiredPermissions: string[]): Promise<boolean> {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const grantedPermissions = new Set(await this.getUserPermissions(userId));

    return requiredPermissions.every((permission) => grantedPermissions.has(permission));
  }
}
