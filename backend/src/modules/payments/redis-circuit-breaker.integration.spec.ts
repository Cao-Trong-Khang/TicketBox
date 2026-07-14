import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { RedisCircuitBreakerService } from './redis-circuit-breaker.service';
import { ProviderInfrastructureError } from './providers/provider-errors';

const integrationTest = process.env.RUN_PAYMENT_INTEGRATION === '1' ? test : test.skip;

function createInstance(redisUrl = 'redis://localhost:6379') {
  const config = new ConfigService({
    REDIS_URL: redisUrl,
    PAYMENT_CIRCUIT_FAILURE_THRESHOLD: 2,
    PAYMENT_CIRCUIT_OPEN_MS: 50,
    PAYMENT_CIRCUIT_PROBE_MS: 500,
  });
  const redis = new RedisCacheService(config);
  const circuit = new RedisCircuitBreakerService(redis, config);
  return { redis, circuit };
}

async function clear(redis: RedisCacheService): Promise<void> {
  await redis.evalStrict(
    "return redis.call('del', KEYS[1], KEYS[2], KEYS[3], KEYS[4])",
    [
      'ticketbox:payments:circuit:vnpay',
      'ticketbox:payments:circuit:vnpay:probe',
      'ticketbox:payments:circuit:momo',
      'ticketbox:payments:circuit:momo:probe',
    ],
    [],
  );
}

integrationTest('Redis shares provider-isolated circuit transitions across instances', async () => {
  const first = createInstance();
  const second = createInstance();
  try {
    await clear(first.redis);
    for (let index = 0; index < 2; index++) {
      await assert.rejects(first.circuit.execute('vnpay', async () => {
        throw new ProviderInfrastructureError('outage', 'transport');
      }));
    }
    assert.equal((await second.circuit.availability('vnpay')).status, 'temporarily_unavailable');
    assert.equal((await second.circuit.availability('momo')).status, 'available');

    await new Promise((resolve) => setTimeout(resolve, 70));
    let release!: () => void;
    const blocker = new Promise<void>((resolve) => { release = resolve; });
    const probe = first.circuit.execute('vnpay', async () => { await blocker; return 'recovered'; });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await assert.rejects(second.circuit.execute('vnpay', async () => 'duplicate-probe'));
    release();
    assert.equal(await probe, 'recovered');
    assert.equal((await second.circuit.availability('vnpay')).status, 'available');
  } finally {
    await clear(first.redis).catch(() => undefined);
    first.redis.onModuleDestroy();
    second.redis.onModuleDestroy();
  }
});

integrationTest('Redis failure makes circuit admission fail closed', async () => {
  const instance = createInstance('redis://127.0.0.1:1');
  try {
    await assert.rejects(
      instance.circuit.execute('vnpay', async () => 'must-not-run'),
      (error: unknown) => typeof error === 'object' && error !== null &&
        'getStatus' in error && (error as { getStatus(): number }).getStatus() === 503,
    );
  } finally {
    instance.redis.onModuleDestroy();
  }
});
