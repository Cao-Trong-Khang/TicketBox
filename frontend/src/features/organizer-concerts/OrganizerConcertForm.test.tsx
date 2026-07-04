import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertForm } from './components/OrganizerConcertForm';

describe('OrganizerConcertForm', () => {
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
});
