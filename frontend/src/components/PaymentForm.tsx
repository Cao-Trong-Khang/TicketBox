import { CreditCard, Loader } from 'lucide-react';
import { useId, useReducer, useRef } from 'react';
import { createPayment } from '../api/payment';
import type { InitiatePaymentRequest, PaymentResponse, PaymentProviderName } from '../api/payment';

type FormState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'success'; data: PaymentResponse }
  | { phase: 'error'; message: string };

type Action =
  | { type: 'submit' }
  | { type: 'success'; data: PaymentResponse }
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

export function PaymentForm() {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' });
  const abortRef = useRef<AbortController | null>(null);
  const idPrefix = useId();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.phase === 'submitting') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'submit' });

    const form = new FormData(e.currentTarget);
    const request: InitiatePaymentRequest = {
      provider: form.get('provider') as PaymentProviderName,
      orderId: String(form.get('orderId')),
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const data = await createPayment(request);
      dispatch({ type: 'success', data });
      // Tự động chuyển hướng sang trang thanh toán VNPAY/MoMo
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  if (state.phase === 'success') {
    return (
      <div className="result-card result-success">
        <h3>Payment created ✓</h3>
        <p className="result-label">Payment ID</p>
        <code className="result-value">{state.data.paymentId}</code>
        <p className="result-label">Payment URL</p>
        <a
          className="result-link"
          href={state.data.paymentUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open payment page →
        </a>
        <button className="btn btn-ghost" onClick={() => dispatch({ type: 'reset' })}>
          New payment
        </button>
      </div>
    );
  }

  return (
    <form className="api-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor={`${idPrefix}-provider`}>Provider</label>
        <select id={`${idPrefix}-provider`} name="provider" required>
          <option value="vnpay">VNPay</option>
          <option value="momo">MoMo</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-orderId`}>Order ID</label>
        <input
          id={`${idPrefix}-orderId`}
          name="orderId"
          type="text"
          placeholder="order-001"
          required
        />
      </div>

      {state.phase === 'error' && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}

      <button className="btn btn-primary" type="submit" disabled={state.phase === 'submitting'}>
        {state.phase === 'submitting' ? (
          <>
            <Loader size={16} className="spin" aria-hidden="true" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard size={16} aria-hidden="true" />
            Create payment
          </>
        )}
      </button>
    </form>
  );
}
