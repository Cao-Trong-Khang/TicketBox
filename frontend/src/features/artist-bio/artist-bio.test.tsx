import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { ArtistBioPanel } from './components/ArtistBioPanel';

const concertId = '11111111-1111-4111-8111-111111111111';
const BIOGRAPHY_LABEL = 'Ti\u1ec3u s\u1eed ngh\u1ec7 s\u0129 do AI t\u1ea1o';
const SAVE_BIOGRAPHY = 'L\u01b0u ti\u1ec3u s\u1eed';
const REGENERATE = 'T\u1ea1o l\u1ea1i ti\u1ec3u s\u1eed';
const UPLOAD = 'T\u1ea3i l\u00ean';
const REMOVE_FILE = 'G\u1ee1 b\u1ecf file';
const DELETE_DOCUMENT = 'X\u00f3a';

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

  it('removes a selected PDF before upload without deleting document history', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json([])));
    render(<ArtistBioPanel concertId={concertId} />);
    const input = screen.getByLabelText(/Press kit PDF/) as HTMLInputElement;
    const file = new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/Đã chọn: press-kit\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: REMOVE_FILE })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }));
    expect(screen.queryByText(/Đã chọn: press-kit\.pdf/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REMOVE_FILE })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: UPLOAD })).toBeDisabled();
    expect(input.value).toBe('');
  });

  it('displays and saves the generated biography through updateArtistBio', async () => {
    const onBiographySaved = vi.fn();
    const document = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([document]))
      .mockImplementationOnce(() => json({ ...document, generated_bio: 'Generated biography' }))
      .mockImplementationOnce(() => json({ generated_bio: 'Edited artist biography' }));
    vi.stubGlobal('fetch', fetchMock);

    render(<ArtistBioPanel concertId={concertId} onBiographySaved={onBiographySaved} />);
    const editor = await screen.findByRole('textbox', { name: BIOGRAPHY_LABEL });
    expect(editor).toHaveValue('Generated biography');
    expect(screen.getByRole('button', { name: SAVE_BIOGRAPHY })).toBeEnabled();
    expect(onBiographySaved).not.toHaveBeenCalled();

    fireEvent.change(editor, { target: { value: '  Edited artist biography  ' } });
    fireEvent.click(screen.getByRole('button', { name: SAVE_BIOGRAPHY }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toContain('/documents/doc-1/bio');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ generated_bio: 'Edited artist biography' }),
    });
    expect(editor).toHaveValue('Edited artist biography');
    expect(onBiographySaved).toHaveBeenCalledWith('Edited artist biography');
    expect(screen.getByRole('button', { name: SAVE_BIOGRAPHY })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('l\u01b0u ti\u1ec3u s\u1eed');
  });

  it('selects and polls the document uploaded during concert creation', async () => {
    const older = { document_id: 'doc-old', file_name: 'old.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const created = { document_id: 'doc-new', file_name: 'new.pdf', status: 'generating', uploaded_at: '2026-01-01T00:01:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([older]))
      .mockImplementationOnce(() => json(created));
    vi.stubGlobal('fetch', fetchMock);

    render(<ArtistBioPanel concertId={concertId} initialDocumentId='doc-new' />);

    expect(await screen.findByRole('status')).toHaveTextContent('4 gi\u00e2y');
    expect(fetchMock.mock.calls[1][0]).toContain('/documents/doc-new');
    expect(screen.getByText('new.pdf')).toBeInTheDocument();
  });

  it('keeps biography visible but disables mutations in read-only mode', async () => {
    const document = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => json([document]))
      .mockImplementationOnce(() => json({ ...document, generated_bio: 'Generated biography' })));

    render(<ArtistBioPanel concertId={concertId} isReadonly />);
    expect(await screen.findByText('press-kit.pdf')).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: BIOGRAPHY_LABEL })).toBeDisabled();
    expect(screen.getByRole('button', { name: SAVE_BIOGRAPHY })).toBeDisabled();
    expect(screen.getByRole('button', { name: REGENERATE })).toBeDisabled();
    expect(screen.getByLabelText(/Press kit PDF/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: new RegExp(DELETE_DOCUMENT) })).not.toBeInTheDocument();
  });

  it('deletes a history item and selects the next remaining document', async () => {
    const first = { document_id: 'doc-1', file_name: 'first.pdf', status: 'done', uploaded_at: '2026-01-01T00:01:00.000Z' };
    const second = { document_id: 'doc-2', file_name: 'second.pdf', status: 'done', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => json([first, second]))
      .mockImplementationOnce(() => json({ ...first, generated_bio: 'First biography' }))
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
      .mockImplementationOnce(() => json({ ...second, generated_bio: 'Second biography' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<ArtistBioPanel concertId={concertId} />);
    expect(await screen.findByRole('textbox', { name: BIOGRAPHY_LABEL })).toHaveValue('First biography');
    fireEvent.click(screen.getByRole('button', { name: `${DELETE_DOCUMENT} first.pdf` }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[2][0]).toContain('/documents/doc-1');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'DELETE' });
    expect(screen.queryByText('first.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('second.pdf')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: BIOGRAPHY_LABEL })).toHaveValue('Second biography');
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
    fireEvent.click(await screen.findByRole('button', { name: REGENERATE }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[2][0]).toContain('/documents/doc-1/regenerate');
    expect(screen.getByRole('status')).toHaveTextContent('\u0111ang x\u1eed l\u00fd');
  });

  it('keeps polling every four seconds while a document remains processing', async () => {
    const processing = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'generating', uploaded_at: '2026-01-01T00:00:00.000Z' };
    const intervalSpy = vi.spyOn(window, 'setInterval');
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(() => json([processing]))
      .mockImplementationOnce(() => json(processing)));

    render(<ArtistBioPanel concertId={concertId} />);
    expect(await screen.findByRole('status')).toHaveTextContent('4 gi\u00e2y');
    await waitFor(() => {
      expect(intervalSpy.mock.calls.some(([, delay]) => delay === 4000)).toBe(true);
    });
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
    render(<ArtistBioPanel concertId={concertId} />);
    fireEvent.change(screen.getByLabelText(/Press kit PDF/), {
      target: { files: [new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: UPLOAD }));
    expect(await screen.findByRole('status')).toHaveTextContent('\u0111ang x\u1eed l\u00fd');
    await waitFor(() => expect(poll).toBeTypeOf('function'));

    await act(async () => { poll?.(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(screen.queryByRole('textbox', { name: BIOGRAPHY_LABEL })).not.toBeInTheDocument();

    await act(async () => { poll?.(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(screen.getByRole('textbox', { name: BIOGRAPHY_LABEL })).toHaveValue('Biography appeared automatically.');
    expect(screen.getByRole('button', { name: REGENERATE })).toBeInTheDocument();
  });
});
