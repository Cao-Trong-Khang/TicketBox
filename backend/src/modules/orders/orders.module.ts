import { Module } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisCacheModule } from '../redis-cache/redis-cache.module';
import { OrderExpirationService } from './order-expiration.service';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [PrismaModule, RedisCacheModule, RateLimitModule, RbacModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService],
  exports: [OrdersService],
})
export class OrdersModule {}
