import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../shared/prisma/prisma.module';
import { PermissionService } from './permission.service';
import { PermissionsGuard } from './permissions.guard';
import { RbacTestController } from './rbac-test.controller';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [RbacTestController],
  providers: [PermissionService, PermissionsGuard],
  exports: [PermissionService, PermissionsGuard],
})
export class RbacModule {}
