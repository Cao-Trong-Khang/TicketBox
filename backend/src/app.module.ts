import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { AuditLogModule } from './modules/audit/audit-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { ArtistBioModule } from './modules/artist-bio/artist-bio.module';
import { CheckInModule } from './modules/check-in/check-in.module';
import { ConcertsModule } from './modules/concerts/concerts.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { RedisCacheModule } from './modules/redis-cache/redis-cache.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { VipImportsModule } from './modules/vip-imports/vip-imports.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.DOCKER_RUNTIME === 'true',
      envFilePath: ['.env', '../.env', 'backend/.env'],
    }),
    AppConfigModule,
    RedisCacheModule,
    TicketsModule,
    ScheduleModule.forRoot(),
    AuditLogModule,
    AuthModule,
    ArtistBioModule,
    RbacModule,
    CheckInModule,
    ConcertsModule,
    VipImportsModule,
    OrdersModule,
    RateLimitModule,
    HealthModule,
    PaymentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
