import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationFactory } from './notification.factory';
import { NotificationsService } from './notifications.service';
import type {
  NotificationProvider,
  SendNotificationRequest,
  SendNotificationResponse,
} from './notification.types';

function makeProvider(
  name: 'email' | 'push',
  response: SendNotificationResponse,
): NotificationProvider {
  return {
    name,
    send: async (_request: SendNotificationRequest) => response,
  };
}

test('NotificationsService sends to all available channels', async () => {
  const factory = new NotificationFactory([
    makeProvider('email', { messageId: 'email_1', channel: 'email', status: 'sent' }),
    makeProvider('push', { messageId: 'push_1', channel: 'push', status: 'sent' }),
  ]);
  const service = new NotificationsService(factory);

  const results = await service.send(
    { userId: 'user-1', type: 'ticket_purchase', data: { email: 'test@example.com' } },
    ['email', 'push'],
  );

  assert.equal(results.length, 2);
  assert.equal(results[0].status, 'sent');
  assert.equal(results[1].status, 'sent');
});

test('NotificationsService handles provider failure gracefully', async () => {
  const failingProvider: NotificationProvider = {
    name: 'email',
    send: async () => {
      throw new Error('SMTP connection failed');
    },
  };
  const factory = new NotificationFactory([failingProvider]);
  const service = new NotificationsService(factory);

  const results = await service.send(
    { userId: 'user-1', type: 'ticket_purchase', data: {} },
    ['email'],
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].status, 'failed');
  assert.equal(results[0].channel, 'email');
});

test('NotificationsService validates request - missing userId', async () => {
  const factory = new NotificationFactory([]);
  const service = new NotificationsService(factory);

  await assert.rejects(
    () => service.send({ userId: '', type: 'ticket_purchase', data: {} }, []),
    /userId/,
  );
});

test('NotificationsService validates request - missing type', async () => {
  const factory = new NotificationFactory([]);
  const service = new NotificationsService(factory);

  await assert.rejects(
    () => service.send({ userId: 'user-1', type: '', data: {} }, []),
    /type/,
  );
});

test('NotificationsService lists available channels', () => {
  const factory = new NotificationFactory([
    makeProvider('email', { messageId: 'e', channel: 'email', status: 'sent' }),
    makeProvider('push', { messageId: 'p', channel: 'push', status: 'sent' }),
  ]);
  const service = new NotificationsService(factory);

  const channels = service.listChannels();

  assert.deepEqual(channels, ['email', 'push']);
});

test('NotificationFactory throws for unsupported channel', () => {
  const factory = new NotificationFactory([]);

  assert.throws(
    () => factory.getProvider('email'),
    /Unsupported notification channel/,
  );
});
