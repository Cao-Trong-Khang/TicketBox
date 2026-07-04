import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcertDetailPage } from './pages/ConcertDetailPage';

describe('ConcertDetailPage banner display', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            id: 'concert-1',
            title: 'Concert detail',
            artistName: 'Artist',
            description: null,
            artist_bio: null,
            venueName: 'Venue',
            venueAddress: 'Address',
            bannerUrl: '/uploads/banners/detail.jpg',
            seatingSvg: null,
            startsAt: '2099-08-01T12:00:00.000Z',
            endsAt: '2099-08-01T15:00:00.000Z',
            performanceStartAt: '2099-08-01T19:00:00.000Z',
          }),
        )
        .mockResolvedValueOnce(jsonResponse([])),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders backend-relative banner URLs as full image sources', async () => {
    render(
      <MemoryRouter initialEntries={['/concerts/concert-1']}>
        <Routes>
          <Route path="/concerts/:id" element={<ConcertDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const image = (await screen.findByAltText('Concert detail')) as HTMLImageElement;
    expect(image.src).toBe('http://localhost:3000/uploads/banners/detail.jpg');
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
