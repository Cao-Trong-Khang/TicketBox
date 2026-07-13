import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { ArtistBioPanel } from './components/ArtistBioPanel';

const concertId = '11111111-1111-4111-8111-111111111111';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('AI artist biography UI', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders artist_bio only when supplied by public detail', async () => {
    localStorage.setItem('accessToken', 'audience-token');
    localStorage.setItem('userRoles', JSON.stringify(['AUDIENCE']));
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/ticket-types') ? json([]) : json({
      id: concertId,
      title: 'Concert',
      artistName: 'Artist',
      description: null,
      venueName: 'Venue',
      venueAddress: null,
      bannerUrl: null,
      seatingSvg: null,
      startsAt: '2026-08-20T12:30:00.000Z',
      endsAt: null,
      performanceStartAt: '2026-08-20T20:30:00.000Z',
      artist_bio: 'A completed artist biography.',
    })));

    renderAt(`/concerts/${concertId}`);
    expect(await screen.findByText('A completed artist biography.')).toBeInTheDocument();
  });

  it('rejects an oversized PDF before upload', async () => {
    localStorage.setItem('accessToken', 'organizer-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
    vi.stubGlobal('fetch', vi.fn(() => json([])));
    renderAt(`/admin/concerts/${concertId}/artist-bio`);
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'press-kit.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Press kit PDF/), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('10 MB');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it('displays and saves the generated biography through updateArtistBio', async () => {
    const document = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([document]))
      .mockImplementationOnce(() => json({ ...document, generated_bio: 'Generated biography' }))
      .mockImplementationOnce(() => json({ generated_bio: 'Edited artist biography' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ArtistBioPanel concertId={concertId} />);
    const editor = await screen.findByLabelText('Artist biography');
    expect(editor).toHaveValue('Generated biography');
    expect(screen.getByRole('button', { name: 'Save biography' })).toBeDisabled();

    fireEvent.change(editor, { target: { value: '  Edited artist biography  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save biography' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toContain('/documents/doc-1/bio');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ generated_bio: 'Edited artist biography' }),
    });
    expect(editor).toHaveValue('Edited artist biography');
    expect(screen.getByRole('button', { name: 'Save biography' })).toBeDisabled();
  });

  it('keeps biography visible but disables mutations in read-only mode', async () => {
    const document = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => json([document]))
      .mockImplementationOnce(() => json({ ...document, generated_bio: 'Generated biography' })));

    render(<ArtistBioPanel concertId={concertId} isReadonly />);
    expect(await screen.findByText('press-kit.pdf')).toBeInTheDocument();
    expect(await screen.findByLabelText('Artist biography')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save biography' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled();
    expect(screen.getByLabelText(/Press kit PDF/)).toBeDisabled();
  });

  it('regenerates a failed document and selects the new processing attempt', async () => {
    const failed = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'failed', uploaded_at: '2026-01-01T00:00:00.000Z', failure_reason: 'AI unavailable' };
    const queued = { document_id: 'doc-2', file_name: 'press-kit.pdf', status: 'uploaded', uploaded_at: '2026-01-01T00:01:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([failed]))
      .mockImplementationOnce(() => json(failed))
      .mockImplementationOnce(() => json({ document_id: 'doc-2', status: 'uploaded' }, 202))
      .mockImplementationOnce(() => json(queued));
    vi.stubGlobal('fetch', fetchMock);

    render(<ArtistBioPanel concertId={concertId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Regenerate' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[2][0]).toContain('/documents/doc-1/regenerate');
    expect(screen.getByRole('status')).toHaveTextContent('in progress');
  });

  it('keeps polling every four seconds while a document remains processing', async () => {
    const processing = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'generating', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const intervalSpy = vi.spyOn(window, 'setInterval');
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => json([processing]))
      .mockImplementationOnce(() => json(processing)));

    render(<ArtistBioPanel concertId={concertId} />);
    expect(await screen.findByRole('status')).toHaveTextContent('every 4 seconds');
    expect(intervalSpy.mock.calls.some(([, delay]) => delay === 4000)).toBe(true);
  });

  it('shows the generated biography automatically after upload without a history click', async () => {
    const generating = { document_id: 'doc-new', file_name: 'press-kit.pdf', status: 'generating', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const done = { ...generating, status: 'done', generated_bio: 'Biography appeared automatically.' };
    let poll: (() => void) | undefined;
    const originalSetInterval = window.setInterval.bind(window);
    vi.spyOn(window, 'setInterval').mockImplementation(((callback: TimerHandler, delay?: number) => {
      if (delay === 4000) {
        poll = callback as () => void;
        return 1;
      }
      return originalSetInterval(callback, delay);
    }) as typeof window.setInterval);
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([]))
      .mockImplementationOnce(() => json({ document_id: 'doc-new', status: 'uploaded' }, 202))
      .mockImplementationOnce(() => json(generating))
      .mockImplementationOnce(() => json(generating))
      .mockImplementationOnce(() => json(done));
    vi.stubGlobal('fetch', fetchMock);
    const onBiographyReady = vi.fn();

    render(<ArtistBioPanel concertId={concertId} onBiographyReady={onBiographyReady} />);
    fireEvent.change(screen.getByLabelText(/Press kit PDF/), {
      target: { files: [new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('status')).toHaveTextContent('in progress');
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    await act(async () => { poll?.(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(screen.queryByLabelText('Artist biography')).not.toBeInTheDocument();

    await act(async () => { poll?.(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(onBiographyReady).toHaveBeenCalledWith('Biography appeared automatically.');
    expect(screen.getByLabelText('Artist biography')).toHaveValue('Biography appeared automatically.');
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeInTheDocument();
  });
});
