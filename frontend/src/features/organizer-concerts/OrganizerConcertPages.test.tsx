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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:3000/organizer/concerts/banners');
    expect(fetchMock.mock.calls[3][0]).toBe('http://localhost:3000/organizer/concerts/11111111-1111-4111-8111-111111111111');
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body))).toMatchObject({
      bannerUrl: '/uploads/banners/replaced.jpg',
    });
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
