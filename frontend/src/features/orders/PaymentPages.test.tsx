import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderPendingPage } from './pages/OrderPendingPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';

const paymentApi = vi.hoisted(() => ({
  createPayment: vi.fn(),
  getPaymentProviders: vi.fn(),
  getPaymentStatus: vi.fn(),
}));

vi.mock('../../api/payment', () => paymentApi);

const order = {
  orderId: 'order-1', orderCode: 'ORD-1', status: 'PENDING',
  totalAmountVnd: 150000, expiresAt: '2026-07-15T10:00:00.000Z',
};

function renderSuccess(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/payments/success" element={<PaymentSuccessPage />} /></Routes>
    </MemoryRouter>,
  );
}

function renderPending() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/orders/pending', state: { order } }]}>
      <Routes><Route path="/orders/pending" element={<OrderPendingPage />} /></Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('authoritative payment pages', () => {
  it('does not accept forged browser success parameters as settlement proof', async () => {
    renderSuccess('/payments/success?vnp_ResponseCode=00&resultCode=0');
    expect(screen.getByRole('heading', { name: 'Thanh toan that bai' })).toBeInTheDocument();
    expect(paymentApi.getPaymentStatus).not.toHaveBeenCalled();
  });

  it.each([
    ['success', 'PAID', 'Thanh toan thanh cong'],
    ['failed', 'FAILED', 'Thanh toan that bai'],
    ['requires_review', 'EXPIRED', 'Thanh toan can kiem tra'],
  ])('renders backend status %s instead of redirect parameters', async (status, orderStatus, title) => {
    paymentApi.getPaymentStatus.mockResolvedValue({
      paymentId: 'pay-1', orderId: 'order-1', provider: 'vnpay',
      status, orderStatus, paymentUrl: null, failureCode: null,
    });
    renderSuccess('/payments/success?paymentId=pay-1&vnp_ResponseCode=00');
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(paymentApi.getPaymentStatus).toHaveBeenCalledWith('pay-1');
  });

  it('polls a pending payment until the backend reports paid', async () => {
    vi.useFakeTimers();
    paymentApi.getPaymentStatus
      .mockResolvedValueOnce({ paymentId: 'pay-1', orderId: 'order-1', provider: 'momo', status: 'timeout', orderStatus: 'PENDING', paymentUrl: null, failureCode: 'TIMEOUT' })
      .mockResolvedValueOnce({ paymentId: 'pay-1', orderId: 'order-1', provider: 'momo', status: 'success', orderStatus: 'PAID', paymentUrl: null, failureCode: null });
    renderSuccess('/payments/success?paymentId=pay-1');
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('heading', { name: 'Dang xac minh thanh toan' })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(screen.getByRole('heading', { name: 'Thanh toan thanh cong' })).toBeInTheDocument();
  });

  it('disables one unavailable provider and guides the user to the alternative', async () => {
    paymentApi.getPaymentProviders.mockResolvedValue([
      { provider: 'vnpay', status: 'temporarily_unavailable', retryAfterSeconds: 12 },
      { provider: 'momo', status: 'available' },
    ]);
    renderPending();
    expect(await screen.findByRole('status')).toHaveTextContent('VNPAY đang tạm gián đoạn');
    expect(screen.getByRole('radio', { name: 'VNPay' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'MoMo' })).toBeEnabled();
  });

  it('retains the same initiation key across a transport retry', async () => {
    paymentApi.getPaymentProviders.mockResolvedValue([
      { provider: 'vnpay', status: 'available' },
      { provider: 'momo', status: 'available' },
    ]);
    paymentApi.createPayment
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ paymentId: 'pay-1', orderId: 'order-1', provider: 'vnpay', status: 'pending', paymentUrl: null, failureCode: null });
    renderPending();
    const vnpay = await screen.findByRole('radio', { name: 'VNPay' });
    fireEvent.click(vnpay);
    const payButton = screen.getAllByRole('button')[0];
    fireEvent.click(payButton);
    await waitFor(() => expect(paymentApi.createPayment).toHaveBeenCalledTimes(1));
    fireEvent.click(payButton);
    await waitFor(() => expect(paymentApi.createPayment).toHaveBeenCalledTimes(2));
    expect(paymentApi.createPayment.mock.calls[0][0].idempotencyKey)
      .toBe(paymentApi.createPayment.mock.calls[1][0].idempotencyKey);
  });
});
