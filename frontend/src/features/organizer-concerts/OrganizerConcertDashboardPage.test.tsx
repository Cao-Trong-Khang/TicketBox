import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertDashboardPage } from './pages/OrganizerConcertDashboardPage';

describe('OrganizerConcertDashboardPage', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders organizer concert cards with banner, venue metadata, and organizer-only actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'concert-1',
            status: 'PUBLISHED',
            lifecycleStatus: 'UPCOMING',
            title: 'Organizer Concert',
            artistName: 'Artist',
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/dashboard.jpg',
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
            createdAt: '2099-07-01T12:00:00.000Z',
            updatedAt: '2099-07-01T12:00:00.000Z',
          },
        ]),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/organizer/concerts']}>
        <Routes>
          <Route path="/organizer/concerts" element={<OrganizerConcertDashboardPage />} />
          <Route path="/organizer/concerts/:id/edit" element={<div>Edit page</div>} />
          <Route path="/organizer/concerts/:id/revenue" element={<div>Revenue page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const banner = (await screen.findByAltText('Organizer Concert')) as HTMLImageElement;
    expect(banner.src).toBe('http://localhost:3000/uploads/banners/dashboard.jpg');
    expect(screen.getByText('Venue, Address')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Doanh thu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Doanh thu' }));
    expect(await screen.findByText('Revenue page')).toBeInTheDocument();
  });

  it('navigates to the existing edit page from the organizer card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'concert-1',
            status: 'PUBLISHED',
            lifecycleStatus: 'UPCOMING',
            title: 'Organizer Concert',
            artistName: 'Artist',
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/dashboard.jpg',
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
            createdAt: '2099-07-01T12:00:00.000Z',
            updatedAt: '2099-07-01T12:00:00.000Z',
          },
        ]),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/organizer/concerts']}>
        <Routes>
          <Route path="/organizer/concerts" element={<OrganizerConcertDashboardPage />} />
          <Route path="/organizer/concerts/:id/edit" element={<div>Edit page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Sửa' });
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(await screen.findByText('Edit page')).toBeInTheDocument();
  });

  it('keeps the existing cancel flow and updates feedback after successful cancel', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 'concert-1',
            status: 'PUBLISHED',
            lifecycleStatus: 'UPCOMING',
            title: 'Organizer Concert',
            artistName: 'Artist',
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/dashboard.jpg',
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
            createdAt: '2099-07-01T12:00:00.000Z',
            updatedAt: '2099-07-01T12:00:00.000Z',
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'concert-1',
          status: 'CANCELLED',
          lifecycleStatus: 'UPCOMING',
          title: 'Organizer Concert',
          artistName: 'Artist',
          description: null,
          venueName: 'Venue',
          venueAddress: 'Address',
          bannerUrl: '/uploads/banners/dashboard.jpg',
          seatingSvg: null,
          startsAt: '2099-08-01T12:00:00.000Z',
          endsAt: '2099-08-01T15:00:00.000Z',
          performanceStartAt: '2099-08-01T19:00:00.000Z',
          createdAt: '2099-07-01T12:00:00.000Z',
          updatedAt: '2099-07-01T13:00:00.000Z',
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts']}>
        <Routes>
          <Route path="/organizer/concerts" element={<OrganizerConcertDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const cancelButton = await screen.findByRole('button', { name: 'Hủy' });
    fireEvent.click(cancelButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/organizer/concerts/concert-1/cancel');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(await screen.findByText('Concert đã được hủy.')).toBeInTheDocument();
    expect(screen.getByText('Đã hủy')).toBeInTheDocument();
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
