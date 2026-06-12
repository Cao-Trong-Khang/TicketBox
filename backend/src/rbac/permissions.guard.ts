import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../auth/types';
import { PermissionService } from './permission.service';
import { PERMISSIONS_KEY } from './rbac.constants';

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Authenticated user is required for permission checks');
    }

    const hasPermissions = await this.permissionService.userHasPermissions(
      userId,
      requiredPermissions,
    );

    if (!hasPermissions) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
