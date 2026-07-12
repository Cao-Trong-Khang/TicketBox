import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationFactory } from './notification.factory';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CircuitBreaker } from '../../shared/circuit-breaker/circuit-breaker';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';

function makeCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30000, halfOpenSuccessThreshold: 2 });
}

function makeController(): NotificationsController {
  const factory = new NotificationFactory([
    new EmailProvider({
      circuitBreaker: makeCircuitBreaker(),
      config: {
        host: 'localhost',
        port: 1025,
        user: '',
        password: '',
        fromAddress: 'noreply@ticketbox.local',
      },
    }),
    new PushProvider({
      circuitBreaker: makeCircuitBreaker(),
      config: {
        serverKey: 'test-server-key',
        projectId: 'ticketbox-test',
      },
    }),
  ]);
  const service = new NotificationsService(factory);
  return new NotificationsController(service);
}

test('NotificationsController sends to all channels when none specified', async () => {
  const controller = makeController();

  const response = await controller.send({
    userId: 'user-1',
    type: 'ticket_purchase',
    data: { email: 'buyer@example.com', deviceToken: 'token-abc' },
  });

  assert.equal(response.results.length, 2);
  assert.ok(response.results.some((r) => r.channel === 'email'));
  assert.ok(response.results.some((r) => r.channel === 'push'));
});

test('NotificationsController sends to specified channel only', async () => {
  const controller = makeController();

  const response = await controller.send({
    userId: 'user-2',
    type: 'event_reminder',
    data: { email: 'attendee@example.com' },
    channels: ['email'],
  });

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].channel, 'email');
  assert.equal(response.results[0].status, 'sent');
});
