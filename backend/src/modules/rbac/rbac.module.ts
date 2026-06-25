import { Global, Module } from '@nestjs/common';
import { AuditLogModule } from '../audit/audit-log.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacTestController } from './rbac-test.controller';
import { RolesController } from './roles.controller';
import { RoleManagementService } from './role-management.service';

@Global()
@Module({
  imports: [AuditLogModule, PrismaModule],
  controllers: [RbacTestController, RolesController],
  providers: [PermissionService, PermissionsGuard, RoleManagementService],
  exports: [PermissionService, PermissionsGuard, RoleManagementService],
})
export class RbacModule {}