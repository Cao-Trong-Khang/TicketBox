import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

function mockJsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('frontend auth shell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders the concerts route from home redirect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse(createConcerts())));

    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
    expect(await screen.findByText('Anh Trai Say Hi Concert 2026')).toBeInTheDocument();
    expect(screen.getByText('Từ 800.000 ₫')).toBeInTheDocument();
    expect(screen.queryByText('Backend online')).not.toBeInTheDocument();
    expect(screen.queryByText('Concert discovery')).not.toBeInTheDocument();
  });

  it('renders the login route', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
  });

  it('renders the register route', () => {
    renderApp('/register');

    expect(screen.getByRole('heading', { name: 'Đăng ký' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên hiển thị')).toBeInTheDocument();
    expect(screen.getByLabelText('Xác nhận mật khẩu')).toBeInTheDocument();
  });

  it('sends successful registration to login without storing a token', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      mockJsonResponse({
        id: 'user-1',
        email: 'audience@example.com',
        displayName: 'Audience User',
        status: 'ACTIVE',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/register');

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Audience User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/register', expect.any(Object)));
    expect(localStorage.getItem('accessToken')).toBeNull();

    await screen.findByText('Đăng ký thành công. Bạn sẽ được chuyển sang màn hình đăng nhập.');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument());
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('stores access token and routes home after successful login', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse({ accessToken: 'jwt-token' }))
      .mockImplementationOnce(() => mockJsonResponse(createConcerts()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.any(Object)));
    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('jwt-token'));
    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
  });
});

function createConcerts() {
  return [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Anh Trai Say Hi Concert 2026',
      artistName: 'Various Artists',
      description: 'Concert description',
      venueName: 'Sân vận động Mỹ Đình',
      venueAddress: 'Nam Từ Liêm, Hà Nội',
      bannerUrl: null,
      startsAt: '2026-08-20T12:30:00.000Z',
      endsAt: '2026-08-20T15:30:00.000Z',
      minPriceVnd: 800000,
    },
  ];
}
