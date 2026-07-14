import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import type { PaymentAvailability, PaymentProviderName } from './payment.types';
import { isProviderInfrastructureError } from './providers/provider-errors';
import { PaymentObservabilityService } from './payment-observability.service';

type CircuitRecord = { state: 'closed' | 'open' | 'half_open'; failures: number; openedAt?: number };
type Admission = ['admit' | 'reject', string];

const ADMIT_SCRIPT = [
  "local raw = redis.call('get', KEYS[1])",
  "local record = raw and cjson.decode(raw) or {state='closed', failures=0}",
  "if record.state == 'closed' then return cjson.encode({'admit', ''}) end",
  "local now = tonumber(ARGV[1])",
  "local openMs = tonumber(ARGV[2])",
  "local probeMs = tonumber(ARGV[3])",
  "if record.state == 'open' and now - (record.openedAt or 0) < openMs then",
  "  return cjson.encode({'reject', tostring(math.ceil((openMs - (now - (record.openedAt or 0))) / 1000))})",
  "end",
  "local acquired = redis.call('set', KEYS[2], ARGV[4], 'PX', probeMs, 'NX')",
  "if not acquired then return cjson.encode({'reject', tostring(math.ceil(probeMs / 1000))}) end",
  "record.state = 'half_open'",
  "redis.call('set', KEYS[1], cjson.encode(record), 'PX', tonumber(ARGV[5]))",
  "return cjson.encode({'admit', ARGV[4]})",
].join('\n');

const RECORD_SCRIPT = [
  "local token = ARGV[1]",
  "if token ~= '' and redis.call('get', KEYS[2]) ~= token then return 0 end",
  "local raw = redis.call('get', KEYS[1])",
  "local record = raw and cjson.decode(raw) or {state='closed', failures=0}",
  "if ARGV[2] == 'success' then",
  "  record = {state='closed', failures=0}",
  "else",
  "  record.failures = (record.failures or 0) + 1",
  "  if record.state == 'half_open' or record.failures >= tonumber(ARGV[3]) then",
  "    record.state = 'open'; record.openedAt = tonumber(ARGV[4])",
  "  else record.state = 'closed' end",
  "end",
  "redis.call('set', KEYS[1], cjson.encode(record), 'PX', tonumber(ARGV[5]))",
  "if token ~= '' and redis.call('get', KEYS[2]) == token then redis.call('del', KEYS[2]) end",
  "return 1",
].join('\n');

@Injectable()
export class RedisCircuitBreakerService {
  private readonly threshold: number;
  private readonly openMs: number;
  private readonly probeMs: number;
  private readonly stateTtlMs = 86_400_000;

  constructor(private readonly redis: RedisCacheService, config: ConfigService, private readonly observability?: PaymentObservabilityService) {
    this.threshold = Number(config.get('PAYMENT_CIRCUIT_FAILURE_THRESHOLD', 5));
    this.openMs = Number(config.get('PAYMENT_CIRCUIT_OPEN_MS', 60_000));
    this.probeMs = Number(config.get('PAYMENT_CIRCUIT_PROBE_MS', 10_000));
  }

  async execute<T>(provider: PaymentProviderName, operation: () => Promise<T>): Promise<T> {
    const probeToken = await this.admit(provider);
    try {
      const value = await operation();
      await this.record(provider, probeToken, 'success');
      this.observability?.record('payment_circuit_outcome', { provider, outcome: 'success' });
      return value;
    } catch (error) {
      await this.record(provider, probeToken, isProviderInfrastructureError(error) ? 'failure' : 'success');
      this.observability?.record('payment_circuit_outcome', { provider, outcome: isProviderInfrastructureError(error) ? 'failure' : 'business_outcome' });
      throw error;
    }
  }

  async availability(provider: PaymentProviderName): Promise<PaymentAvailability> {
    const record = await this.read(provider);
    if (record.state !== 'open') return { provider, status: 'available' };
    const remaining = Math.max(0, this.openMs - (Date.now() - (record.openedAt ?? 0)));
    return {
      provider,
      status: remaining > 0 ? 'temporarily_unavailable' : 'available',
      retryAfterSeconds: Math.ceil(remaining / 1000),
    };
  }

  private async admit(provider: PaymentProviderName): Promise<string | null> {
    const token = randomUUID();
    try {
      const raw = await this.redis.evalStrict(
        ADMIT_SCRIPT,
        [this.key(provider), this.probeKey(provider)],
        [Date.now(), this.openMs, this.probeMs, token, this.stateTtlMs],
      );
      const [decision, value] = JSON.parse(String(raw)) as Admission;
      if (decision === 'reject') throw this.unavailable(provider, Number(value));
      return value || null;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw this.unavailable(provider, 5, 'PAYMENT_COORDINATION_UNAVAILABLE');
    }
  }

  private async record(provider: PaymentProviderName, token: string | null, outcome: 'success' | 'failure'): Promise<void> {
    try {
      await this.redis.evalStrict(
        RECORD_SCRIPT,
        [this.key(provider), this.probeKey(provider)],
        [token ?? '', outcome, this.threshold, Date.now(), this.stateTtlMs],
      );
    } catch {
      throw this.unavailable(provider, 5, 'PAYMENT_COORDINATION_UNAVAILABLE');
    }
  }

  private async read(provider: PaymentProviderName): Promise<CircuitRecord> {
    try {
      const raw = await this.redis.getStrict(this.key(provider));
      return raw ? JSON.parse(raw) as CircuitRecord : { state: 'closed', failures: 0 };
    } catch {
      throw this.unavailable(provider, 5, 'PAYMENT_COORDINATION_UNAVAILABLE');
    }
  }

  private key(provider: PaymentProviderName): string {
    return 'ticketbox:payments:circuit:' + provider;
  }
  private probeKey(provider: PaymentProviderName): string {
    return this.key(provider) + ':probe';
  }
  private unavailable(provider: PaymentProviderName, retryAfterSeconds: number, code = 'PAYMENT_PROVIDER_UNAVAILABLE') {
    return new ServiceUnavailableException({
      code, provider, retryAfterSeconds,
      message: 'Payment provider is temporarily unavailable',
    });
  }
}
