import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OrderHistoryDataSource } from './history-api';
import type { OrderHistoryItem, OrderHistoryStatus } from './history-types';
import { OrderHistoryPage } from './pages/OrderHistoryPage';

function order(status: OrderHistoryStatus, index = 1): OrderHistoryItem {
  return {
    orderId: `order-${index}`,
    orderCode: `ORD-00${index}`,
    status,
    createdAt: '2026-07-06T10:00:00.000Z',
    performanceStartAt: '2026-07-08T13:00:00.000Z',
    concertTitle: `Concert ${status}`,
    venueName: 'Arena Center',
    venueAddress: 'Quận 1',
    bannerUrl: status === 'PAID' ? '/uploads/banners/paid.jpg' : null,
    totalAmountVnd: 1_200_000,
    tickets: [{ ticketTypeName: 'VIP', quantity: 2 }],
  };
}

function renderPage(dataSource: OrderHistoryDataSource) {
  return render(
    <MemoryRouter>
      <OrderHistoryPage dataSource={dataSource} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('OrderHistoryPage', () => {
  it('shows loading and then the empty state', async () => {
    let resolve!: (orders: OrderHistoryItem[]) => void;
    const pending = new Promise<OrderHistoryItem[]>((done) => { resolve = done; });
    renderPage({ listOrders: () => pending });

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải lịch sử đơn hàng...');
    resolve([]);

    expect(await screen.findByText('Chưa có đơn hàng nào.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Khám phá concert' })).toBeInTheDocument();
  });

  it('renders every status, localized details, and image fallback', async () => {
    const orders = (['PAID', 'PENDING', 'FAILED', 'EXPIRED', 'CANCELLED'] as OrderHistoryStatus[])
      .map((status, index) => order(status, index + 1));
    renderPage({ listOrders: () => Promise.resolve(orders) });

    expect(await screen.findByRole('heading', { name: 'Lịch sử đơn hàng' })).toBeInTheDocument();
    for (const label of ['Đã thanh toán', 'Chờ thanh toán', 'Thanh toán thất bại', 'Đã hết hạn', 'Đã hủy']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/1\.200\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 vé · 2 vé VIP/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Chưa có hình ảnh')).toHaveLength(4);

    fireEvent.error(screen.getByAltText('Concert PAID'));
    expect(screen.getAllByLabelText('Chưa có hình ảnh')).toHaveLength(5);
  });

  it('shows meaningful hints for terminal statuses', async () => {
    renderPage({ listOrders: () => Promise.resolve([order('FAILED'), order('EXPIRED', 2), order('CANCELLED', 3)]) });

    expect(await screen.findByText('Thanh toán chưa thành công')).toBeInTheDocument();
    expect(screen.getByText('Đơn đã quá thời gian thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đơn đã được hủy')).toBeInTheDocument();
  });

  it('opens a complete order detail dialog and closes it accessibly', async () => {
    renderPage({ listOrders: () => Promise.resolve([order('PAID')]) });

    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết đơn hàng' }));

    const dialog = screen.getByRole('dialog', { name: 'Concert PAID' });
    expect(dialog).toBeInTheDocument();
    const detail = within(dialog);
    expect(detail.getByText('Mã đơn ORD-001')).toBeInTheDocument();
    expect(detail.getByText('Đã thanh toán')).toBeInTheDocument();
    expect(detail.getByText('Arena Center, Quận 1')).toBeInTheDocument();
    expect(detail.getByRole('heading', { name: 'Thông tin vé' })).toBeInTheDocument();
    expect(detail.getByText('VIP')).toBeInTheDocument();
    expect(detail.getAllByText('2 vé').length).toBeGreaterThan(0);
    expect(detail.getByText(/1\.200\.000/)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('does not use localStorage fixtures and retries after an error', async () => {
    localStorage.setItem('order-history-fixture', JSON.stringify([{ orderCode: 'LOCAL-ONLY' }]));
    const listOrders = vi.fn()
      .mockRejectedValueOnce(new Error('not implemented'))
      .mockResolvedValueOnce([order('PAID')]);
    renderPage({ listOrders });

    expect(await screen.findByRole('alert')).toHaveTextContent('not implemented');
    expect(screen.queryByText('LOCAL-ONLY')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Concert PAID')).toBeInTheDocument();
    expect(listOrders).toHaveBeenCalledTimes(2);
  });
});