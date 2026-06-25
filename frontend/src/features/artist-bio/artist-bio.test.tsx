import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

describe('AI artist biography UI', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

  it('renders artist_bio only when supplied by public detail', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/ticket-types') ? json([]) : json({
      id: '11111111-1111-4111-8111-111111111111', title: 'Concert', artistName: 'Artist', description: null,
      venueName: 'Venue', venueAddress: null, bannerUrl: null, seatingSvg: null,
      startsAt: '2026-08-20T12:30:00.000Z', endsAt: null, artist_bio: 'A completed artist biography.',
    })));
    renderAt('/concerts/11111111-1111-4111-8111-111111111111');
    expect(await screen.findByRole('heading', { name: 'Tiểu sử nghệ sĩ' })).toBeInTheDocument();
    expect(screen.getByText('A completed artist biography.')).toBeInTheDocument();
  });

  it('rejects an oversized PDF before upload', async () => {
    localStorage.setItem('accessToken', 'organizer-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
    vi.stubGlobal('fetch', vi.fn(() => json([])));
    renderAt('/admin/concerts/11111111-1111-4111-8111-111111111111/artist-bio');
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'press-kit.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Press kit PDF/), { target: { files: [file] } });
    expect(await screen.findByText('Tệp PDF không được vượt quá 10 MB.')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
