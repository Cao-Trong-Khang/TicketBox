import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

test('HealthService identifies TicketBox API', () => {
  const service = new HealthService(new ConfigService());
  const health = service.getHealth();

  assert.equal(health.service, 'TicketBox API');
  assert.equal(health.status, 'ok');
  assert.equal(health.dependencies.postgres.configured, true);
  assert.equal(health.dependencies.redis.configured, true);
  assert.equal(health.dependencies.kafka.configured, true);
});
