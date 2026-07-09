import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

@Injectable()
export class OrderExpirationService {
  private readonly logger = new Logger(OrderExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {}

  @Cron('*/60 * * * * *')
  async expireOverdueOrders() {
    try {
      const now = new Date();

      const candidates = await this.prisma.order.findMany({
        where: { status: 'PENDING', expiresAt: { lte: now } },
        include: { items: true },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      });

      const total = candidates.length;
      let expired = 0;
      let skipped = 0;
      let failed = 0;

      for (const order of candidates) {
        try {
          const res = await this.expireOrder(order as any);
          if (res === 'expired') expired++;
          else skipped++;
        } catch (err) {
          failed++;
          this.logger.warn(`Failed to expire order ${order.id}: ${err}`);
        }
      }

      this.logger.log(
        `Expiration job completed: ${total} candidates, ${expired} expired, ${skipped} skipped, ${failed} failed`,
      );
    } catch (err) {
      this.logger.error('Expiration job failed', err as any);
    }
  }

  private async expireOrder(order: any): Promise<'expired' | 'skipped'> {
    return await this.prisma.$transaction(async (tx) => {
      const update = await tx.order.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });

      if (update.count === 0) return 'skipped';

      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE ticket_types
          SET reserved_quantity = GREATEST(0, reserved_quantity - ${item.quantity})
          WHERE id = ${item.ticketTypeId}::uuid
        `;
      }

      // post-transaction cache invalidation
      try {
        await this.redisCache.del(`concerts:${order.concertId}:ticket-types`);
      } catch (err) {
        this.logger.warn('Redis cache invalidation failed for order ' + order.id, err as any);
      }

      return 'expired';
    });
  }
}
