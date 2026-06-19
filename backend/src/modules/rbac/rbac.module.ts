import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacController } from './rbac.controller';
import { RbacTestController } from './rbac-test.controller';
import { RbacService } from './rbac.service';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RbacController, RbacTestController],
  providers: [PermissionService, PermissionsGuard, RbacService, RolesGuard],
  exports: [PermissionService, PermissionsGuard, RbacService, RolesGuard],
})
export class RbacModule {}
