import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RbacModule } from './rbac/rbac.module';
import { AppConfigModule } from './shared/config/app-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    AppConfigModule,
    AuthModule,
    RbacModule,
    HealthModule,
  ],
})
export class AppModule {}
