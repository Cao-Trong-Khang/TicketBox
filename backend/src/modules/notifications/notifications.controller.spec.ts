import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotificationFactory } from './notification.factory';
import type {
  NotificationChannelName,
  NotificationProvider,
} from './notification.types';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

function makeProvider(name: NotificationChannelName): NotificationProvider {
  return {
    name,
    async send() {
      return {
        messageId: `${name}-test-message`,
        channel: name,
        status: 'sent',
      };
    },
  };
}

function makeController(): NotificationsController {
  const factory = new NotificationFactory([
    makeProvider('email'),
    makeProvider('push'),
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
