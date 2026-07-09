import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertCreatePage } from './pages/OrganizerConcertCreatePage';
import { OrganizerConcertEditPage } from './pages/OrganizerConcertEditPage';

describe('Organizer concert banner upload flows', () => {
  beforeEach(() => {
    class MockFileReader {
      public result: string | ArrayBuffer | null = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;

      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,preview`;
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as typeof FileReader);
    localStorage.setItem('accessToken', 'test-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('keeps form state and skips concert creation when banner upload fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ message: 'Không thể tải banner lên lúc này. Vui lòng thử lại.' }, 503),
    );

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/new']}>
        <Routes>
          <Route path="/organizer/concerts/new" element={<OrganizerConcertCreatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    fillRequiredConcertFields();
    addTicketDraft();
    const file = new File(['banner'], 'banner.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Chọn banner concert'), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(
      await screen.findByText('Không thể tải banner lên lúc này. Vui lòng thử lại.'),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Tên concert') as HTMLInputElement).value).toBe(
      'Concert timing test',
    );
  });

  it('uploads replacement banner before updating an existing concert', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: 'concert-1',
        status: 'PUBLISHED',
        lifecycleStatus: 'UPCOMING',
        title: 'Existing concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: '/uploads/banners/existing.jpg',
        seatingSvg: null,
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:00:00.000Z',
      }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ bannerUrl: '/uploads/banners/replaced.jpg' }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'concert-1',
        status: 'PUBLISHED',
        lifecycleStatus: 'UPCOMING',
        title: 'Existing concert',
        artistName: 'Artist',
        description: null,
        venueName: 'Venue',
        venueAddress: 'Address',
        bannerUrl: '/uploads/banners/replaced.jpg',
        seatingSvg: null,
        startsAt: '2099-08-01T12:00:00.000Z',
        endsAt: '2099-08-01T15:00:00.000Z',
        performanceStartAt: '2099-08-01T19:00:00.000Z',
        createdAt: '2099-08-01T10:00:00.000Z',
        updatedAt: '2099-08-01T10:05:00.000Z',
      }));

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/11111111-1111-4111-8111-111111111111/edit']}>
        <Routes>
          <Route path="/organizer/concerts/:id/edit" element={<OrganizerConcertEditPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByDisplayValue('Existing concert');

    const file = new File(['banner'], 'replacement.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Replace banner'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      const preview = screen.getByAltText('Banner preview') as HTMLImageElement;
      expect(preview.src).toContain('data:image/png;base64,preview');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));

    expect(fetchMock.mock.calls[3][0]).toBe('http://localhost:3000/organizer/concerts/banners');
    expect(fetchMock.mock.calls[4][0]).toBe('http://localhost:3000/organizer/concerts/11111111-1111-4111-8111-111111111111');
    expect(JSON.parse(String(fetchMock.mock.calls[4][1]?.body))).toMatchObject({
      bannerUrl: '/uploads/banners/replaced.jpg',
    });
  });

  it('persists a completed AI biography into concert description automatically', async () => {
    const concertId = '11111111-1111-4111-8111-111111111111';
    const concert = {
      id: concertId, status: 'PUBLISHED', lifecycleStatus: 'UPCOMING', title: 'AI concert', artistName: 'Artist',
      description: null, venueName: 'Venue', venueAddress: 'Address', bannerUrl: null, seatingSvg: null,
      startsAt: '2099-08-01T12:00:00.000Z', endsAt: '2099-08-01T15:00:00.000Z', performanceStartAt: '2099-08-01T19:00:00.000Z',
      createdAt: '2099-08-01T10:00:00.000Z', updatedAt: '2099-08-01T10:00:00.000Z',
    };
    const document = { document_id: 'doc-1', file_name: 'press-kit.pdf', status: 'done', uploaded_at: '2099-08-01T10:01:00.000Z', generated_bio: 'Persisted AI description' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(concert))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([document]))
      .mockResolvedValueOnce(jsonResponse(document))
      .mockResolvedValueOnce(jsonResponse({ ...concert, description: 'Persisted AI description', updatedAt: '2099-08-01T10:02:00.000Z' }))
      .mockResolvedValueOnce(jsonResponse([document]))
      .mockResolvedValueOnce(jsonResponse(document));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={[{ pathname: `/organizer/concerts/${concertId}/edit`, state: { artistBioDocumentId: 'doc-1' } }]}>
        <Routes><Route path={'/organizer/concerts/:id/edit'} element={<OrganizerConcertEditPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('Persisted AI description')).toBeInTheDocument();
    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({ description: 'Persisted AI description' });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'AI Artist Bio đã được lưu vào Mô tả và đồng bộ với trang chi tiết concert.',
    );
  });

  it('uploads a selected press kit only after concert creation and navigates to edit', async () => {
    const concertId = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: concertId }))
      .mockResolvedValueOnce(jsonResponse({ id: 'ticket-1' }))
      .mockResolvedValueOnce(jsonResponse({ document_id: 'doc-1', status: 'uploaded' }, 202))
      .mockResolvedValueOnce(jsonResponse({ id: 'ticket-1', status: 'ACTIVE' }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/new']}>
        <Routes>
          <Route path="/organizer/concerts/new" element={<OrganizerConcertCreatePage />} />
          <Route path="/organizer/concerts/:id/edit" element={<p>Edit destination</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fillRequiredConcertFields();
    addTicketDraft();
    const pdf = new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/Press kit PDF cho AI Artist Bio/), { target: { files: [pdf] } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(await screen.findByText('Edit destination')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/organizer/concerts');
    const uploadCall = fetchMock.mock.calls.find(([url]) => url === `http://localhost:3000/admin/concerts/${concertId}/documents`);
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('still navigates after a press-kit queue failure and completes ticket setup', async () => {
    const concertId = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: concertId }))
      .mockResolvedValueOnce(jsonResponse({ id: 'ticket-1' }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Queue unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ id: 'ticket-1', status: 'ACTIVE' }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/new']}>
        <Routes>
          <Route path="/organizer/concerts/new" element={<OrganizerConcertCreatePage />} />
          <Route path="/organizer/concerts/:id/edit" element={<p>Recovered edit destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fillRequiredConcertFields();
    addTicketDraft();
    fireEvent.change(screen.getByLabelText(/Press kit PDF cho AI Artist Bio/), { target: { files: [new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(await screen.findByText('Recovered edit destination')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/ticket-types/ticket-1/activate'))).toBe(true);
  });

  it.each([
    ['ticket setup only', 202],
    ['ticket setup and press-kit queue', 503],
  ])('keeps the concert recoverable when %s fails', async (_label, bioStatus) => {
    const concertId = '11111111-1111-4111-8111-111111111111';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: concertId }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Ticket setup failed' }, 503))
      .mockResolvedValueOnce(bioStatus === 202
        ? jsonResponse({ document_id: 'doc-1', status: 'uploaded' }, 202)
        : jsonResponse({ message: 'Queue unavailable' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/organizer/concerts/new']}>
        <Routes>
          <Route path="/organizer/concerts/new" element={<OrganizerConcertCreatePage />} />
          <Route path="/organizer/concerts/:id/edit" element={<p>Partial recovery destination</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fillRequiredConcertFields();
    addTicketDraft();
    fireEvent.change(screen.getByLabelText(/Press kit PDF cho AI Artist Bio/), { target: { files: [new File(['%PDF demo'], 'press-kit.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(await screen.findByText('Partial recovery destination')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/documents'))).toBe(true);
  });
});

function fillRequiredConcertFields() {
  fireEvent.change(screen.getByLabelText('Tên concert'), {
    target: { value: 'Concert timing test' },
  });
  fireEvent.change(screen.getByLabelText('Nghệ sĩ'), {
    target: { value: 'Artist' },
  });
  fireEvent.change(screen.getByLabelText('Địa điểm'), {
    target: { value: 'Venue' },
  });
  fireEvent.change(screen.getByLabelText('Địa chỉ'), {
    target: { value: 'Address' },
  });
  fireEvent.change(screen.getByLabelText('Bắt đầu mở bán vé'), {
    target: { value: '2099-08-20T09:00' },
  });
  fireEvent.change(screen.getByLabelText('Kết thúc mở bán vé'), {
    target: { value: '2099-08-20T19:00' },
  });
  fireEvent.change(screen.getByLabelText('Thời gian bắt đầu concert'), {
    target: { value: '2099-08-20T20:00' },
  });
}

function addTicketDraft() {
  fireEvent.change(screen.getByLabelText('Mã loại vé'), {
    target: { value: 'GA' },
  });
  fireEvent.change(screen.getByLabelText('Tên loại vé'), {
    target: { value: 'General Admission' },
  });
  fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
    target: { value: '500000' },
  });
  fireEvent.change(screen.getByLabelText('Tổng số vé'), {
    target: { value: '100' },
  });
  fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
    target: { value: '2' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}
