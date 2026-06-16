import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { CheckInModule } from './modules/check-in/check-in.module';
import { ConcertsModule } from './modules/concerts/concerts.module';
import { HealthModule } from './modules/health/health.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RedisCacheModule } from './modules/redis-cache/redis-cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    AppConfigModule,
    RedisCacheModule,
    AuthModule,
    RbacModule,
    CheckInModule,
    ConcertsModule,
    HealthModule,
  ],
})
export class AppModule {}
