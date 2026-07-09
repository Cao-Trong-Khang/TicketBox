import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertRevenuePage } from './pages/OrganizerConcertRevenuePage';

describe('OrganizerConcertRevenuePage', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders organizer revenue summary and ticket-type breakdown from fetched data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          concert: {
            id: 'concert-1',
            status: 'PUBLISHED',
            lifecycleStatus: 'UPCOMING',
            title: 'Revenue Concert',
            artistName: 'Artist',
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/revenue.jpg',
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
          },
          summary: {
            totalRevenueVnd: 4500000,
            totalSoldQuantity: 12,
            totalReservedQuantity: 3,
            totalAvailableQuantity: 85,
            totalTicketQuantity: 100,
            soldRate: 0.12,
            paidOrderCount: 4,
          },
          ticketTypes: [
            {
              id: 'ticket-type-vip',
              code: 'VIP',
              name: 'VIP',
              priceVnd: 1500000,
              totalQuantity: 50,
              reservedQuantity: 1,
              soldQuantity: 10,
              availableQuantity: 39,
              revenueVnd: 15000000,
              soldRate: 0.2,
              status: 'ACTIVE',
            },
            {
              id: 'ticket-type-ga',
              code: 'GA',
              name: 'General Admission',
              priceVnd: 500000,
              totalQuantity: 50,
              reservedQuantity: 2,
              soldQuantity: 2,
              availableQuantity: 46,
              revenueVnd: 1000000,
              soldRate: 0.04,
              status: 'ACTIVE',
            },
          ],
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/concert-1/revenue']}>
        <Routes>
          <Route path="/organizer/concerts/:id/revenue" element={<OrganizerConcertRevenuePage />} />
          <Route path="/organizer/concerts/:id/edit" element={<div>Edit page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Revenue Concert' })).toBeInTheDocument();
    expect(screen.getByText('4.500.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getAllByText('VIP')).toHaveLength(2);
    expect(screen.getByText('General Admission')).toBeInTheDocument();
    expect(screen.getByText('15.000.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('1.000.000 ₫')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa concert' })).not.toBeInTheDocument();
  });

  it('does not render the no-paid-orders banner when there are zero paid orders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({
          concert: {
            id: 'concert-1',
            status: 'PUBLISHED',
            lifecycleStatus: 'UPCOMING',
            title: 'Revenue Concert',
            artistName: 'Artist',
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/revenue.jpg',
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
          },
          summary: {
            totalRevenueVnd: 0,
            totalSoldQuantity: 0,
            totalReservedQuantity: 3,
            totalAvailableQuantity: 85,
            totalTicketQuantity: 100,
            soldRate: 0,
            paidOrderCount: 0,
          },
          ticketTypes: [],
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/concert-1/revenue']}>
        <Routes>
          <Route path="/organizer/concerts/:id/revenue" element={<OrganizerConcertRevenuePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Revenue Concert' })).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có đơn thanh toán thành công/i)).not.toBeInTheDocument();
    expect(screen.getByText('0 ₫')).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
