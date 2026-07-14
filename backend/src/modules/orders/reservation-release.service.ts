import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { RedisCacheService } from '../redis-cache/redis-cache.service';

type ReleaseTarget = typeof OrderStatus.FAILED | typeof OrderStatus.EXPIRED;

@Injectable()
export class ReservationReleaseService {
  constructor(private readonly redisCache: RedisCacheService) {}

  async releasePending(
    tx: Prisma.TransactionClient,
    orderId: string,
    target: ReleaseTarget,
  ): Promise<{ released: boolean; concertId: string | null }> {
    await tx.$queryRawUnsafe('SELECT id FROM orders WHERE id = $1::uuid FOR UPDATE', orderId);
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { ticketTypeId: 'asc' } } },
    });
    if (!order || order.status !== OrderStatus.PENDING) {
      return { released: false, concertId: order?.concertId ?? null };
    }
    const won = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: target },
    });
    if (won.count !== 1) return { released: false, concertId: order.concertId };
    for (const item of order.items) {
      await tx.$queryRawUnsafe('SELECT id FROM ticket_types WHERE id = $1::uuid FOR UPDATE', item.ticketTypeId);
      const released = await tx.$executeRawUnsafe(
        'UPDATE ticket_types SET reserved_quantity = reserved_quantity - $1 WHERE id = $2::uuid AND reserved_quantity >= $1',
        item.quantity,
        item.ticketTypeId,
      );
      if (released !== 1) throw new Error('RESERVATION_COUNTER_INVARIANT_VIOLATION');
    }
    return { released: true, concertId: order.concertId };
  }

  async invalidateAvailability(concertId: string | null): Promise<void> {
    if (concertId) await this.redisCache.del('concerts:' + concertId + ':ticket-types');
  }
}
