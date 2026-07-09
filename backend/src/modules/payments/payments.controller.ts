import { Controller, Post, Body, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { PaymentFactory } from './payment.factory';
import type { CreatePaymentRequest, CreatePaymentResponse } from './payment.types';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, PaymentStatus, TicketStatus } from '@prisma/client';
import * as crypto from 'node:crypto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentFactory: PaymentFactory,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async createPayment(@Body() request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const provider = this.paymentFactory.getProvider(request.provider);
    return provider.createPayment(request);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    const orderId = body.orderId || body.vnp_TxnRef || (body.rawPayload && body.rawPayload.orderId);
    const provider = body.provider || 'vnpay';
    const status = body.status || 'completed';
    const providerTransactionId = body.providerTransactionId || body.vnp_TransactionNo || `tx-${crypto.randomUUID()}`;

    if (orderId && status === 'completed') {
      await this.processOrderFulfillment(orderId, provider, providerTransactionId);
    }
    return { status: 'ok' };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Body() body: { orderId: string; provider: string; transactionId?: string }) {
    const { orderId, provider, transactionId } = body;
    await this.processOrderFulfillment(orderId, provider, transactionId || `tx-${crypto.randomUUID()}`);
    return { status: 'success' };
  }

  private async processOrderFulfillment(orderId: string, providerName: string, providerTransactionId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let order = await this.prisma.order.findFirst({
      where: {
        OR: [
          isUuid ? { id: orderId } : undefined,
          { orderCode: orderId },
        ].filter(Boolean) as any,
      },
      include: {
        items: { include: { ticketType: true } },
        user: true,
        concert: true,
      },
    });

    if (!order) {
      const transaction = await this.prisma.paymentTransaction.findFirst({
        where: { providerTransactionId: providerTransactionId },
        include: {
          order: {
            include: {
              items: { include: { ticketType: true } },
              user: true,
              concert: true,
            },
          },
        },
      });
      if (transaction) {
        order = transaction.order;
      }
    }

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.PAID) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
        },
      });

      await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          provider: providerName.toUpperCase() === 'MOMO' ? 'MOMO' : 'VNPAY',
          providerTransactionId,
          idempotencyKey: `pay-confirm-${order.id}-${crypto.randomUUID().substring(0, 8)}`,
          status: PaymentStatus.SUCCESS,
          amountVnd: order.totalAmountVnd,
          requestedAt: new Date(),
          confirmedAt: new Date(),
        },
      });

      let ticketSeq = 1000 + Math.floor(Math.random() * 9000);
      for (const item of order.items) {
        for (let k = 0; k < item.quantity; k++) {
          const ticketCode = `TK-${order.orderCode}-${item.ticketType.code}-${ticketSeq++}`;
          const qrHash = crypto.randomUUID().replace(/-/g, '');

          await tx.ticket.create({
            data: {
              ticketCode,
              qrHash,
              orderId: order.id,
              orderItemId: item.id,
              ownerUserId: order.userId,
              concertId: order.concertId,
              ticketTypeId: item.ticketTypeId,
              status: TicketStatus.ACTIVE,
            },
          });
        }

        await tx.$executeRaw`
          UPDATE ticket_types
          SET reserved_quantity = GREATEST(0, reserved_quantity - ${item.quantity}),
              sold_quantity = sold_quantity + ${item.quantity}
          WHERE id = ${item.ticketTypeId}::uuid
        `;
      }
    });

    try {
      await this.notificationsService.send(
        {
          userId: order.userId,
          type: 'ticket_purchase',
          data: {
            email: order.user.email,
            orderCode: order.orderCode,
            concertTitle: order.concert.title,
            amount: order.totalAmountVnd,
          },
        },
        ['email', 'push', 'sms', 'zalo'],
      );
    } catch (err) {
      console.error('Failed to send notification upon payment success:', err);
    }
  }
}
