import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OrderStatus, PaymentProvider as PrismaPaymentProvider, PaymentStatus, Prisma, TicketStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentFactory } from './payment.factory';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
import type { NormalizedPaymentResult, PaymentProviderName } from './payment.types';
import type { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { isProviderInfrastructureError } from './providers/provider-errors';
import { ReservationReleaseService } from '../orders/reservation-release.service';
import { PaymentObservabilityService } from './payment-observability.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendOrigin: string;
  private readonly apiOrigin: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: PaymentFactory,
    private readonly circuits: RedisCircuitBreakerService,
    private readonly releases: ReservationReleaseService,
    private readonly observability: PaymentObservabilityService,
    config: ConfigService,
  ) {
    this.frontendOrigin = config.get('FRONTEND_ORIGIN', 'http://localhost:5173').split(',')[0];
    this.apiOrigin = config.get('PUBLIC_API_ORIGIN', 'http://localhost:3000');
  }

  async initiate(userId: string, dto: InitiatePaymentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId }, include: { user: { select: { email: true } } } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== userId) throw new ForbiddenException('Order does not belong to the authenticated user');
    if (order.status !== OrderStatus.PENDING || order.expiresAt <= new Date()) throw new ConflictException('Order is not payable');

    const fingerprint = createHash('sha256').update(`${userId}|${order.id}|${dto.provider}|${order.totalAmountVnd}`).digest('hex');
    const providerRequestId = `tbx_${crypto.randomUUID().replace(/-/g, '')}`;
    const leaseUntil = new Date(Date.now() + 30_000);
    let payment;
    let ownsInitiationLease = true;
    try {
      payment = await this.prisma.paymentTransaction.create({ data: {
        orderId: order.id, provider: this.toPrismaProvider(dto.provider), idempotencyKey: dto.idempotencyKey,
        providerRequestId, requestFingerprint: fingerprint, amountVnd: order.totalAmountVnd,
        status: PaymentStatus.INITIATED, initiationLeaseUntil: leaseUntil,
      } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.paymentTransaction.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (!existing || existing.requestFingerprint !== fingerprint) throw new ConflictException({ code: 'PAYMENT_IDEMPOTENCY_CONFLICT', message: 'Idempotency key was used for another payment' });
      this.logger.log(`payment_initiation_replay paymentId=${existing.id}`);
      this.observability.record('payment_initiation_replay', { paymentId: existing.id, provider: dto.provider });
      payment = existing;
      if (existing.status !== PaymentStatus.INITIATED || existing.paymentUrl) return this.toStatus(existing);
      const recovered = await this.prisma.paymentTransaction.updateMany({
        where: {
          id: existing.id,
          status: PaymentStatus.INITIATED,
          OR: [{ initiationLeaseUntil: null }, { initiationLeaseUntil: { lt: new Date() } }],
        },
        data: { initiationLeaseUntil: leaseUntil },
      });
      ownsInitiationLease = recovered.count === 1;
      if (!ownsInitiationLease) return this.toStatus(existing);
    }

    if (!ownsInitiationLease) return this.toStatus(payment);
    const provider = this.factory.getProvider(dto.provider);
    try {
      const providerStartedAt = Date.now();
      const response = await this.circuits.execute(dto.provider, () => provider.createPayment({
        orderId: order.id, amountVnd: order.totalAmountVnd, providerRequestId: payment.providerRequestId,
        returnUrl: `${this.frontendOrigin}/payments/success?paymentId=${payment.id}`,
        webhookUrl: `${this.apiOrigin}/payments/webhooks/${dto.provider}`, customerEmail: order.user.email,
      }));
      this.observability.record('payment_provider_latency', { provider: dto.provider, latencyMs: Date.now() - providerStartedAt, outcome: 'success' });
      await this.prisma.paymentTransaction.updateMany({
        where: { id: payment.id, status: PaymentStatus.INITIATED, initiationLeaseUntil: leaseUntil },
        data: { status: PaymentStatus.PENDING, paymentUrl: response.paymentUrl, initiationLeaseUntil: null },
      });
      const updated = await this.prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } });
      return this.toStatus(updated);
    } catch (error) {
      const retryable = error instanceof ServiceUnavailableException || isProviderInfrastructureError(error);
      this.observability.record('payment_provider_latency', { provider: dto.provider, outcome: 'failed', retryable });
      await this.prisma.paymentTransaction.updateMany({
        where: { id: payment.id, status: PaymentStatus.INITIATED, initiationLeaseUntil: leaseUntil },
        data: {
          status: retryable ? PaymentStatus.TIMEOUT : PaymentStatus.FAILED,
          failureCode: retryable ? 'PROVIDER_UNAVAILABLE_OR_TIMEOUT' : 'PROVIDER_INITIATION_FAILED',
          initiationLeaseUntil: null,
        },
      });
      if (isProviderInfrastructureError(error)) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_PROVIDER_UNAVAILABLE',
          provider: dto.provider,
          retryAfterSeconds: 5,
          message: 'Payment provider request timed out or is temporarily unavailable',
        });
      }
      throw error;
    }
  }

  async getStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.paymentTransaction.findUnique({ where: { id: paymentId }, include: { order: { select: { userId: true, status: true } } } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.userId !== userId) throw new ForbiddenException('Payment does not belong to the authenticated user');
    return { ...this.toStatus(payment), orderStatus: payment.order.status };
  }

  async getAvailability() {
    return Promise.all(this.factory.listProviders().map((provider) => this.circuits.availability(provider)));
  }

  async handleWebhook(providerName: PaymentProviderName, payload: Record<string, unknown>) {
    let result: NormalizedPaymentResult;
    try {
      result = this.factory.getProvider(providerName).verifyAndParseWebhook(payload);
    } catch (error) {
      this.observability.record('payment_signature_rejected', { provider: providerName, reason: error instanceof Error ? error.message : 'invalid' });
      throw error;
    }
    if (result.provider !== providerName || !result.providerRequestId) throw new ConflictException('Invalid provider callback reference');
    const payment = await this.prisma.paymentTransaction.findUnique({ where: { providerRequestId: result.providerRequestId } });
    if (!payment || payment.provider !== this.toPrismaProvider(providerName) || payment.amountVnd !== result.amountVnd) {
      this.observability.record('payment_transition_conflict', { provider: providerName, reason: 'callback_mismatch' });
      throw new ConflictException('Payment callback does not match persisted attempt');
    }
    if (result.outcome === 'pending') return { status: 'accepted' };
    await this.applyResult(payment.id, result);
    return { status: 'accepted' };
  }

  async applyResult(paymentId: string, result: NormalizedPaymentResult): Promise<void> {
    const concertId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM payment_transactions WHERE id = ${paymentId}::uuid FOR UPDATE`;
      const payment = await tx.paymentTransaction.findUnique({ where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Payment not found');
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId}::uuid FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: payment.orderId }, include: { items: { orderBy: { ticketTypeId: 'asc' } } } });
      if (!order) throw new NotFoundException('Order not found');
      if (payment.status === PaymentStatus.SUCCESS || payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.REQUIRES_REVIEW) {
        this.observability.record('payment_duplicate_result', { paymentId, status: payment.status, duplicate: true });
        return null;
      }

      if (result.outcome === 'success') {
        if (order.status !== OrderStatus.PENDING || order.expiresAt <= new Date()) {
          await tx.paymentTransaction.update({ where: { id: payment.id }, data: { status: PaymentStatus.REQUIRES_REVIEW, providerTransactionId: result.providerTransactionId, confirmedAt: new Date(), failureCode: 'LATE_SUCCESS_AFTER_ORDER_CLOSED' } });
          this.observability.record('payment_requires_review', { paymentId, orderId: order.id, reason: 'late_success' });
          return null;
        }
        for (const item of order.items) await tx.$queryRaw`SELECT id FROM ticket_types WHERE id = ${item.ticketTypeId}::uuid FOR UPDATE`;
        const won = await tx.order.updateMany({ where: { id: order.id, status: OrderStatus.PENDING }, data: { status: OrderStatus.PAID, paidAt: new Date() } });
        if (won.count !== 1) return null;
        await tx.paymentTransaction.update({ where: { id: payment.id }, data: { status: PaymentStatus.SUCCESS, providerTransactionId: result.providerTransactionId, confirmedAt: new Date(), failureCode: null } });
        for (const item of order.items) {
          await tx.$executeRaw`UPDATE ticket_types SET reserved_quantity = reserved_quantity - ${item.quantity}, sold_quantity = sold_quantity + ${item.quantity} WHERE id = ${item.ticketTypeId}::uuid AND reserved_quantity >= ${item.quantity}`;
          for (let index = 0; index < item.quantity; index++) {
            const ticketCode = `TK-${order.orderCode}-${item.id.slice(0, 8)}-${index + 1}`;
            const qrHash = createHash('sha256').update(`${ticketCode}|${order.userId}`).digest('hex');
            await tx.ticket.create({ data: { ticketCode, qrHash, orderId: order.id, orderItemId: item.id, ownerUserId: order.userId, concertId: order.concertId, ticketTypeId: item.ticketTypeId, status: TicketStatus.ACTIVE } });
          }
        }
        return order.concertId;
      } else {
        await tx.paymentTransaction.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED, providerTransactionId: result.providerTransactionId, confirmedAt: new Date(), failureCode: 'PROVIDER_DECLINED' } });
        const release = await this.releases.releasePending(tx, order.id, OrderStatus.FAILED);
        this.observability.record('payment_reservation_release', { paymentId, orderId: order.id, released: release.released });
        return release.released ? release.concertId : null;
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.releases.invalidateAvailability(concertId);
    if (result.outcome === 'success' && concertId) {
      this.observability.record('payment_fulfillment_committed', { paymentId, outcome: 'success' });
    }
  }

  private toStatus(payment: { id: string; orderId: string; provider: PrismaPaymentProvider; status: PaymentStatus; paymentUrl: string | null; failureCode: string | null }) {
    return { paymentId: payment.id, orderId: payment.orderId, provider: payment.provider.toLowerCase(), status: payment.status.toLowerCase(), paymentUrl: payment.paymentUrl, failureCode: payment.failureCode };
  }
  private toPrismaProvider(provider: PaymentProviderName) { return provider === 'momo' ? PrismaPaymentProvider.MOMO : PrismaPaymentProvider.VNPAY; }
}
