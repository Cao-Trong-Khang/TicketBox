import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConcertsModule } from './modules/concerts/concerts.module';
import { HealthModule } from './modules/health/health.module';
import { OrdersModule } from './modules/orders/orders.module';
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
    ConcertsModule,
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
