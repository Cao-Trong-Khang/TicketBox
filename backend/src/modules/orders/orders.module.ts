import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisCacheModule } from '../redis-cache/redis-cache.module';
import { OrderExpirationService } from './order-expiration.service';
import { RbacModule } from '../rbac/rbac.module';
import { CheckoutLockService } from './checkout-lock.service';
import { ReservationReleaseService } from './reservation-release.service';

@Module({
  imports: [PrismaModule, RedisCacheModule, RateLimitModule, RbacModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService, CheckoutLockService, ReservationReleaseService],
  exports: [OrdersService, ReservationReleaseService],
})
export class OrdersModule {}
