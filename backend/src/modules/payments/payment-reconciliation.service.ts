import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentStatus, PaymentProvider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentFactory } from './payment.factory';
import { PaymentsService } from './payments.service';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);
  private readonly batchSize: number;
  private readonly staleMs: number;
  constructor(private readonly prisma: PrismaService, private readonly factory: PaymentFactory, private readonly payments: PaymentsService, private readonly circuits: RedisCircuitBreakerService, config: ConfigService) {
    this.batchSize = Number(config.get('PAYMENT_RECONCILIATION_BATCH_SIZE', 25));
    this.staleMs = Number(config.get('PAYMENT_RECONCILIATION_STALE_MS', 60_000));
  }
  @Cron('*/30 * * * * *')
  async reconcile(): Promise<void> {
    const now = new Date();
    const stale = new Date(now.getTime() - this.staleMs);
    const candidates = await this.prisma.paymentTransaction.findMany({
      where: { status: { in: [PaymentStatus.INITIATED, PaymentStatus.PENDING, PaymentStatus.TIMEOUT] }, updatedAt: { lte: stale }, OR: [{ reconciliationLeaseUntil: null }, { reconciliationLeaseUntil: { lt: now } }] },
      orderBy: { updatedAt: 'asc' }, take: this.batchSize,
    });
    for (const candidate of candidates) {
      const leaseUntil = new Date(Date.now() + 30_000);
      const claimed = await this.prisma.paymentTransaction.updateMany({ where: { id: candidate.id, OR: [{ reconciliationLeaseUntil: null }, { reconciliationLeaseUntil: { lt: now } }] }, data: { reconciliationLeaseUntil: leaseUntil, reconciliationAttempts: { increment: 1 } } });
      if (claimed.count !== 1) continue;
      try {
        const providerName = candidate.provider === PaymentProvider.MOMO ? 'momo' : 'vnpay';
        const provider = this.factory.getProvider(providerName);
        const result = provider.queryPayment ? await this.circuits.execute(providerName, () => provider.queryPayment!({
          providerRequestId: candidate.providerRequestId,
          providerTransactionId: candidate.providerTransactionId,
          initiatedAt: candidate.createdAt,
          amountVnd: candidate.amountVnd,
        })) : null;
        if (result && result.outcome !== 'pending') await this.payments.applyResult(candidate.id, result);
      } catch (error) { this.logger.warn(`Payment reconciliation failed paymentId=${candidate.id}: ${String(error)}`); }
      finally { await this.prisma.paymentTransaction.update({ where: { id: candidate.id }, data: { reconciliationLeaseUntil: null, lastReconciledAt: new Date() } }).catch(() => undefined); }
    }
  }
}
