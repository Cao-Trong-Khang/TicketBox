import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConcertStatus, TicketTypeStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { CreateOrderRequestDto } from './dto/create-order.request.dto';
import { CreateOrderResponseDto } from './dto/create-order.response.dto';
import { OrderHistoryItemDto } from './dto/order-history.response.dto';
import { CheckoutLockService } from './checkout-lock.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
    private readonly checkoutLocks: CheckoutLockService,
  ) {}
  async getOrderHistory(userId: string): Promise<OrderHistoryItemDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      select: {
        id: true,
        orderCode: true,
        status: true,
        createdAt: true,
        totalAmountVnd: true,
        concert: {
          select: {
            title: true,
            performanceStartAt: true,
            startsAt: true,
            venueName: true,
            venueAddress: true,
            bannerUrl: true,
          },
        },
        items: {
          select: {
            quantity: true,
            ticketType: { select: { name: true } },
          },
        },
      },
    });

    return orders.map((order) => ({
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      performanceStartAt: (
        order.concert.performanceStartAt ?? order.concert.startsAt
      ).toISOString(),
      concertTitle: order.concert.title,
      venueName: order.concert.venueName,
      venueAddress: order.concert.venueAddress,
      bannerUrl: order.concert.bannerUrl,
      totalAmountVnd: order.totalAmountVnd,
      tickets: order.items.map((item) => ({
        ticketTypeName: item.ticketType.name,
        quantity: item.quantity,
      })),
    }));
  }

  async createOrder(
    userId: string,
    dto: CreateOrderRequestDto,
  ): Promise<CreateOrderResponseDto> {
    // [3.1] Check idempotency FIRST (before transaction)
    const existingOrder = await this.prisma.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey: dto.idempotencyKey,
        },
      },
      include: { items: { select: { ticketTypeId: true, quantity: true } } },
    });

    // [3.2] If found, return immediately
    if (existingOrder) {
      this.assertExactReplay(existingOrder, dto);
      return this.toCreateOrderResponseDto(existingOrder);
    }

    // [3.3, 3.4] Validate & reject duplicate ticketTypeIds before transaction
    const ticketTypeIds = dto.items.map((item) => item.ticketTypeId);
    const uniqueTypeIds = new Set(ticketTypeIds);
    if (uniqueTypeIds.size !== ticketTypeIds.length) {
      throw new BadRequestException('Duplicate ticketTypeIds not allowed');
    }

    const lockScopes = [`quota:${userId}:${dto.concertId}`, ...ticketTypeIds.map((id) => `inventory:${id}`)];
    const order = await this.checkoutLocks.withLocks(lockScopes, () => this.withSerializableRetry(() => this.prisma.$transaction(async (tx) => {
      const replay = await tx.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey } },
        include: { items: { select: { ticketTypeId: true, quantity: true } } },
      });
      if (replay) {
        this.assertExactReplay(replay, dto);
        return replay;
      }
      // [4.1] Validate Concert
      const concert = await tx.concert.findUnique({
        where: { id: dto.concertId },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (!concert) {
        throw new NotFoundException('Concert not found');
      }

      if (concert.status !== ConcertStatus.PUBLISHED) {
        throw new ConflictException('Concert is not published');
      }

      const now = new Date();

      if (concert.startsAt > now) {
        throw new ConflictException('Ticket sales have not started for this concert');
      }

      if (concert.endsAt !== null && concert.endsAt < now) {
        throw new ConflictException('Ticket sales have ended for this concert');
      }

      for (const ticketTypeId of [...ticketTypeIds].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${dto.concertId}:${ticketTypeId}`}, 0))`;
        await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${ticketTypeId}::uuid FOR UPDATE`;
      }

      // Fetch authoritative locked ticket types.
      const ticketTypes = await tx.ticketType.findMany({
        where: {
          id: { in: ticketTypeIds },
          concertId: dto.concertId,
        },
      });

      if (ticketTypes.length !== ticketTypeIds.length) {
        throw new NotFoundException('One or more ticket types not found');
      }

      const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.id, tt]));

      // [4.4-4.6] Validate each ticket type
      for (const item of dto.items) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;

        // [4.4] Status check
        if (ticketType.status !== TicketTypeStatus.ACTIVE) {
          throw new ConflictException('Ticket type is not active');
        }

        // [4.5] Quantity validation
        if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
          throw new BadRequestException('Quantity must be a positive integer');
        }

        // Check individual quantity against perUserLimit
        if (item.quantity > ticketType.perUserLimit) {
          throw new ConflictException(
            `Quantity exceeds per-user limit for this ticket type (max: ${ticketType.perUserLimit})`,
          );
        }
      }

      // [5.1-5.3] Query existing active orders for per-user limits
      for (const item of dto.items) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;

        const existingOrderItems = await tx.orderItem.aggregate({
          _sum: { quantity: true },
          where: {
            ticketTypeId: item.ticketTypeId,
            order: {
              userId,
              OR: [
                { status: OrderStatus.PAID },
                { status: OrderStatus.PENDING, expiresAt: { gt: now } },
              ],
            },
          },
        });

        const existingQty = existingOrderItems._sum.quantity || 0;
        const totalQty = existingQty + item.quantity;

        if (totalQty > ticketType.perUserLimit) {
          throw new ConflictException(
            `Per-user limit exceeded for this ticket type (current: ${existingQty}, requested: ${item.quantity}, limit: ${ticketType.perUserLimit})`,
          );
        }
      }

      // [6.1-6.3] Reserve all ticket types (raw SQL conditional update)
      for (const item of dto.items) {
        const reservedCount = await tx.$executeRaw`
          UPDATE ticket_types
          SET reserved_quantity = reserved_quantity + ${item.quantity}
          WHERE id = ${item.ticketTypeId}::uuid
            AND concert_id = ${dto.concertId}::uuid
            AND (total_quantity - reserved_quantity - sold_quantity) >= ${item.quantity}
        `;

        if (reservedCount === 0) {
          throw new ConflictException('Not enough tickets available');
        }
      }

      // [7.1] Generate orderCode
      const orderCode = this.generateOrderCode();

      // [7.2] Calculate totalAmountVnd
      let totalAmountVnd = 0;
      for (const item of dto.items) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
        totalAmountVnd += item.quantity * ticketType.priceVnd;
      }

      // [7.3] Create Order
      const createdOrder = await tx.order.create({
        data: {
          orderCode,
          userId,
          concertId: dto.concertId,
          status: OrderStatus.PENDING,
          totalAmountVnd,
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000), // now + 15 minutes
          idempotencyKey: dto.idempotencyKey,
        },
      });

      // [7.4-7.5] Create OrderItems
      for (const item of dto.items) {
        const ticketType = ticketTypeMap.get(item.ticketTypeId)!;
        const subtotalVnd = item.quantity * ticketType.priceVnd;

        await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            unitPriceVnd: ticketType.priceVnd,
            subtotalVnd,
          },
        });
      }

      return createdOrder;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }), 3));

    // [8.1] Post-transaction: invalidate Redis cache
    await this.redisCache.del(`concerts:${dto.concertId}:ticket-types`);

    return this.toCreateOrderResponseDto(order);
  }

  private generateOrderCode(): string {
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const random = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `TBX${timestamp}${random}`;
  }

  private assertExactReplay(
    order: { concertId: string; items: Array<{ ticketTypeId: string; quantity: number }> },
    dto: CreateOrderRequestDto,
  ): void {
    const persisted = order.items
      .map((item) => item.ticketTypeId + ':' + item.quantity)
      .sort()
      .join('|');
    const requested = dto.items
      .map((item) => item.ticketTypeId + ':' + item.quantity)
      .sort()
      .join('|');
    if (order.concertId !== dto.concertId || persisted !== requested) {
      throw new ConflictException({
        code: 'ORDER_IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key was used for a different checkout request',
      });
    }
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
        if (!retryable || attempt >= attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.floor(Math.random() * 30)));
      }
    }
  }

  private toCreateOrderResponseDto(order: {
    id: string;
    orderCode: string;
    status: OrderStatus;
    totalAmountVnd: number;
    expiresAt: Date;
  }): CreateOrderResponseDto {
    return {
      orderId: order.id,
      orderCode: order.orderCode,
      status: order.status,
      totalAmountVnd: order.totalAmountVnd,
      expiresAt: order.expiresAt.toISOString(),
    };
  }
}
