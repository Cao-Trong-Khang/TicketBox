import { Bell, Loader } from 'lucide-react';
import { useId, useReducer, useRef, useState } from 'react';
import { NOTIFICATION_TYPES, sendNotification } from '../api/notification';
import type {
  NotificationChannelName,
  SendNotificationRequest,
  SendNotificationResponse,
} from '../api/notification';

type FormState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'success'; data: SendNotificationResponse }
  | { phase: 'error'; message: string };

type Action =
  | { type: 'submit' }
  | { type: 'success'; data: SendNotificationResponse }
  | { type: 'error'; message: string }
  | { type: 'reset' };

function reducer(_state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'submit':
      return { phase: 'submitting' };
    case 'success':
      return { phase: 'success', data: action.data };
    case 'error':
      return { phase: 'error', message: action.message };
    case 'reset':
      return { phase: 'idle' };
  }
}

const ALL_CHANNELS: NotificationChannelName[] = ['email', 'push'];

export function NotificationForm() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' });
  const [channels, setChannels] = useState<NotificationChannelName[]>(['email', 'push']);
  const abortRef = useRef<AbortController | null>(null);
  const idPrefix = useId();

  function toggleChannel(channel: NotificationChannelName) {
    setChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.phase === 'submitting') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'submit' });

    const form = new FormData(e.currentTarget);
    const notifType = String(form.get('type'));
    const email = String(form.get('email') || '');
    const deviceToken = String(form.get('deviceToken') || '');

    const request: SendNotificationRequest = {
      userId: String(form.get('userId')),
      type: notifType,
      data: { email, deviceToken },
      channels: channels.length > 0 ? channels : undefined,
    };

    try {
      const data = await sendNotification(request, controller.signal);
      dispatch({ type: 'success', data });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  if (state.phase === 'success') {
    return (
      <div className="result-card result-success">
        <h3>Notifications sent ✓</h3>
        {state.data.results.map((r, i) => (
          <div key={i} className={`notif-result notif-${r.status}`}>
            <span className="notif-channel">{r.channel}</span>
            <span className="notif-status">{r.status}</span>
            {r.status === 'sent' && <code className="notif-id">{r.messageId}</code>}
            {r.status === 'failed' && (
              <small className="notif-err">
                {String((r.rawPayload as Record<string, unknown>)?.['error'] ?? 'failed')}
              </small>
            )}
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'reset' })}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="api-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${idPrefix}-userId`}>User ID</label>
        <input
          id={`${idPrefix}-userId`}
          name="userId"
          type="text"
          placeholder="user-123"
          defaultValue="user-123"
          required
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-type`}>Notification type</label>
        <select id={`${idPrefix}-type`} name="type" required>
          {NOTIFICATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Channels</label>
        <div className="checkbox-group">
          {ALL_CHANNELS.map((ch) => (
            <label key={ch} className="checkbox-label">
              <input
                type="checkbox"
                checked={channels.includes(ch)}
                onChange={() => toggleChannel(ch)}
              />
              {ch}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-email`}>Email (for email channel)</label>
        <input
          id={`${idPrefix}-email`}
          name="email"
          type="email"
          placeholder="user@example.com"
        />
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-deviceToken`}>Device token (for push channel)</label>
        <input
          id={`${idPrefix}-deviceToken`}
          name="deviceToken"
          type="text"
          placeholder="fcm-device-token"
        />
      </div>

      {state.phase === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <button
        className="btn btn-primary"
        type="submit"
        disabled={state.phase === 'submitting' || channels.length === 0}
      >
        {state.phase === 'submitting' ? (
          <>
            <Loader size={16} className="spin" aria-hidden="true" />
            Sending…
          </>
        ) : (
          <>
            <Bell size={16} aria-hidden="true" />
            Send notification
          </>
        )}
      </button>
    </form>
  );
}
