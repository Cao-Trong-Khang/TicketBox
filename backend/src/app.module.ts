import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { GateStaffAssignmentModule } from './modules/gate-staff/gate-staff-assignment.module';
import { HealthModule } from './modules/health/health.module';
import { RbacModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    AppConfigModule,
    AuthModule,
    RbacModule,
    GateStaffAssignmentModule,
    HealthModule,
  ],
})
export class AppModule {}
