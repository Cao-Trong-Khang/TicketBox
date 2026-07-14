import { Injectable, Logger } from '@nestjs/common';

type AuditValue = string | number | boolean | null | undefined;

@Injectable()
export class PaymentObservabilityService {
  private readonly logger = new Logger('PaymentAudit');
  private readonly counters = new Map<string, number>();
  private readonly allowedFields = new Set([
    'paymentId', 'orderId', 'provider', 'status', 'outcome', 'reason',
    'latencyMs', 'retryable', 'duplicate', 'released', 'state',
  ]);

  record(event: string, fields: Record<string, AuditValue> = {}): void {
    this.counters.set(event, (this.counters.get(event) ?? 0) + 1);
    const safeFields = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) => this.allowedFields.has(key) && value !== undefined),
    );
    this.logger.log(JSON.stringify({ event, ...safeFields }));
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.freeze(Object.fromEntries(this.counters));
  }
}
