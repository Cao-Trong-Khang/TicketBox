import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertForm } from './components/OrganizerConcertForm';

describe('OrganizerConcertForm', () => {
  beforeEach(() => {
    class MockFileReader {
      static readonly EMPTY = 0;
      static readonly LOADING = 1;
      static readonly DONE = 2;

      public result: string | ArrayBuffer | null = null;
      public onload: null | (() => void) = null;
      public onerror: null | (() => void) = null;

      readAsDataURL(file: File) {
        this.result = `data:${file.type};base64,preview`;
        this.onload?.();
      }

      async readAsText(file: File) {
        this.result = await file.text();
        this.onload?.();
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the updated timing labels for sale window and performance start', () => {
    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    expect(screen.getByLabelText('Bắt đầu mở bán vé')).toBeInTheDocument();
    expect(screen.getByLabelText('Kết thúc mở bán vé')).toBeInTheDocument();
    expect(screen.getByLabelText('Thời gian bắt đầu concert')).toBeInTheDocument();
  });

  it('validates that concert performance starts after the sale window closes', async () => {
    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

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
      target: { value: '2026-08-20T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Kết thúc mở bán vé'), {
      target: { value: '2026-08-20T19:00' },
    });
    fireEvent.change(screen.getByLabelText('Thời gian bắt đầu concert'), {
      target: { value: '2026-08-20T18:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(
      await screen.findByText(
        'Thời gian bắt đầu concert phải sau thời gian kết thúc mở bán vé.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a local preview after selecting a valid banner image', async () => {
    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    const file = new File(['banner'], 'banner.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Chọn banner concert'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      const preview = screen.getByAltText('Banner preview') as HTMLImageElement;
      expect(preview.src).toContain('data:image/jpeg;base64,preview');
    });
  });

  it('shows an error when selecting an oversized banner image', async () => {
    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    const file = new File(['banner'], 'banner.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5_242_881 });

    fireEvent.change(screen.getByLabelText('Chọn banner concert'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('File phải nhỏ hơn hoặc bằng 5 MB.')).toBeInTheDocument();
  });

  it('shows an error when selecting an SVG banner image', async () => {
    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    const file = new File(['<svg />'], 'banner.svg', { type: 'image/svg+xml' });

    fireEvent.change(screen.getByLabelText('Chọn banner concert'), {
      target: { files: [file] },
    });

    expect(
      await screen.findByText('Chỉ chấp nhận file JPEG, PNG hoặc WebP.'),
    ).toBeInTheDocument();
  });

  it('preserves existing seatingSvg when no new SVG file is selected during edit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <OrganizerConcertForm
        initialValues={{
          title: 'Existing concert',
          artistName: 'Artist',
          description: '',
          venueName: 'Venue',
          venueAddress: 'Address',
          bannerUrl: '',
          seatingSvg: '<svg><rect width="10" height="10"></rect></svg>',
          startsAt: '2099-08-20T09:00',
          endsAt: '2099-08-20T19:00',
          performanceStartAt: '2099-08-20T20:00',
        }}
        submitLabel="Lưu thay đổi"
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      seatingSvg: '<svg><rect width="10" height="10"></rect></svg>',
    });
  });

  it('reads an uploaded SVG file and submits it as seatingSvg', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <OrganizerConcertForm submitLabel="Tạo concert" onSubmit={onSubmit} />,
    );

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

    const file = new File(['<svg><rect width="10" height="10" /></svg>'], 'map.svg', {
      type: 'image/svg+xml',
    });

    fireEvent.change(screen.getByLabelText('Tải file SVG'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Xem trước sơ đồ chỗ ngồi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      seatingSvg: '<svg><rect width="10" height="10"></rect></svg>',
    });
  });
});