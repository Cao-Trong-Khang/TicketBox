import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App health status', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          service: 'TicketBox API',
          status: 'ok',
          timestamp: new Date().toISOString(),
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('displays backend health when the API responds', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('Backend online')).toBeInTheDocument());
    expect(screen.getByText('TicketBox API')).toBeInTheDocument();
  });
});
