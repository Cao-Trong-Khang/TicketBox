import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendNotification } from '../api/notification';
import type { SendNotificationRequest } from '../api/notification';

const BASE_REQUEST: SendNotificationRequest = {
  userId: 'user-1',
  type: 'ticket_purchase',
  data: { email: 'buyer@example.com', deviceToken: 'token-xyz' },
  channels: ['email', 'push'],
};

describe('sendNotification', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { messageId: 'email_abc', channel: 'email', status: 'sent' },
            { messageId: 'push_def', channel: 'push', status: 'sent' },
          ],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls POST /notifications with correct body', async () => {
    const result = await sendNotification(BASE_REQUEST);

    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/notifications');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['userId']).toBe('user-1');
    expect(body['type']).toBe('ticket_purchase');
    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe('sent');
  });

  it('returns failed results when provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { messageId: '', channel: 'email', status: 'failed', rawPayload: { error: 'SMTP down' } },
          ],
        }),
      }),
    );

    const result = await sendNotification({ ...BASE_REQUEST, channels: ['email'] });
    expect(result.results[0].status).toBe('failed');
  });

  it('throws when API returns error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'userId is required' }),
      }),
    );

    await expect(sendNotification({ ...BASE_REQUEST, userId: '' })).rejects.toThrow('userId is required');
  });
});
