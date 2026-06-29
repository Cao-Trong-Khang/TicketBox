import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrganizerConcertForm } from './components/OrganizerConcertForm';

describe('OrganizerConcertForm', () => {
  afterEach(() => {
    cleanup();
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
});
