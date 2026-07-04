import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConcertCard } from './components/ConcertCard';

describe('ConcertCard', () => {
  it('uses performanceStartAt as the primary audience-facing event time', () => {
    render(
      <ConcertCard
        concert={{
          id: 'concert-1',
          title: 'Concert test',
          artistName: 'Artist',
          description: null,
          venueName: 'Venue',
          venueAddress: 'Address',
          bannerUrl: null,
          startsAt: '2026-07-01T13:00:00.000Z',
          endsAt: '2026-07-01T16:00:00.000Z',
          performanceStartAt: '2026-07-02T13:00:00.000Z',
          minPriceVnd: 800000,
        }}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText((text) => text.includes('2 tháng 7, 2026'))).toBeInTheDocument();
    expect(screen.queryByText((text) => text.includes('1 tháng 7, 2026'))).not.toBeInTheDocument();
  });

  it('resolves backend-relative banner URLs through the API base URL', () => {
    render(
      <ConcertCard
        concert={{
          id: 'concert-2',
          title: 'Concert with banner',
          artistName: 'Artist',
          description: null,
          venueName: 'Venue',
          venueAddress: 'Address',
          bannerUrl: '/uploads/banners/test-banner.jpg',
          startsAt: '2026-07-01T13:00:00.000Z',
          endsAt: '2026-07-01T16:00:00.000Z',
          performanceStartAt: '2026-07-02T13:00:00.000Z',
          minPriceVnd: 800000,
        }}
        onNavigate={vi.fn()}
      />,
    );

    const banner = screen.getByAltText('Concert with banner') as HTMLImageElement;
    expect(banner.src).toBe('http://localhost:3000/uploads/banners/test-banner.jpg');
  });
});
