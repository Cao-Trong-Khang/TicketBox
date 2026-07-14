import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
import { ProviderBusinessError, ProviderInfrastructureError } from './providers/provider-errors';

class ScriptedRedis {
  state = new Map<string, { state: string; failures: number; openedAt?: number }>();
  probes = new Map<string, string>();

  async getStrict(key: string): Promise<string | null> {
    const record = this.state.get(key);
    return record ? JSON.stringify(record) : null;
  }

  async evalStrict(_script: string, keys: string[], args: Array<string | number>): Promise<string | number> {
    const [stateKey, probeKey] = keys;
    if (String(args[1]) === 'success' || String(args[1]) === 'failure') {
      const [token, outcome, threshold, now] = args;
      if (token && this.probes.get(probeKey) !== token) return 0;
      const current = this.state.get(stateKey) ?? { state: 'closed', failures: 0 };
      if (outcome === 'success') this.state.set(stateKey, { state: 'closed', failures: 0 });
      else {
        const failures = current.failures + 1;
        this.state.set(stateKey, failures >= Number(threshold) || current.state === 'half_open'
          ? { state: 'open', failures, openedAt: Number(now) }
          : { state: 'closed', failures });
      }
      if (token) this.probes.delete(probeKey);
      return 1;
    }
    const [now, openMs, _probeMs, token] = args;
    const current = this.state.get(stateKey) ?? { state: 'closed', failures: 0 };
    if (current.state === 'closed') return JSON.stringify(['admit', '']);
    if (current.state === 'open' && Number(now) - (current.openedAt ?? 0) < Number(openMs)) {
      return JSON.stringify(['reject', '1']);
    }
    if (this.probes.has(probeKey)) return JSON.stringify(['reject', '1']);
    this.probes.set(probeKey, String(token));
    this.state.set(stateKey, { ...current, state: 'half_open' });
    return JSON.stringify(['admit', token]);
  }
}

function createCircuit(redis: ScriptedRedis): RedisCircuitBreakerService {
  const config = new ConfigService({
    PAYMENT_CIRCUIT_FAILURE_THRESHOLD: 2,
    PAYMENT_CIRCUIT_OPEN_MS: 10,
    PAYMENT_CIRCUIT_PROBE_MS: 1000,
  });
  return new RedisCircuitBreakerService(redis as never, config);
}

test('only infrastructure failures open one provider circuit', async () => {
  const redis = new ScriptedRedis();
  const circuit = createCircuit(redis);
  await assert.rejects(circuit.execute('vnpay', async () => { throw new ProviderBusinessError('declined'); }));
  assert.equal((await circuit.availability('vnpay')).status, 'available');
  for (let index = 0; index < 2; index++) {
    await assert.rejects(circuit.execute('vnpay', async () => { throw new ProviderInfrastructureError('timeout', 'timeout'); }));
  }
  assert.equal((await circuit.availability('vnpay')).status, 'temporarily_unavailable');
  assert.equal((await circuit.availability('momo')).status, 'available');
});

test('half-open admission has one token-owned probe and closes on success', async () => {
  const redis = new ScriptedRedis();
  const circuit = createCircuit(redis);
  redis.state.set('ticketbox:payments:circuit:vnpay', { state: 'open', failures: 2, openedAt: Date.now() - 20 });
  let release!: () => void;
  const blocker = new Promise<void>((resolve) => { release = resolve; });
  const probe = circuit.execute('vnpay', async () => { await blocker; return 'ok'; });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(circuit.execute('vnpay', async () => 'second'));
  release();
  assert.equal(await probe, 'ok');
  assert.equal((await circuit.availability('vnpay')).status, 'available');
});
