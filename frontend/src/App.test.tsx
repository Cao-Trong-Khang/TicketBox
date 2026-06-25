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

  it('stores tokens and routes audience users to concerts after successful login', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        mockJsonResponse({
          accessToken: 'jwt-token',
          refreshToken: 'refresh-token',
          user: { id: 'user-1', email: 'audience@example.com', displayName: null, status: 'ACTIVE', roles: ['AUDIENCE'] },
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(createConcerts()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.any(Object)));
    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('jwt-token'));
    expect(localStorage.getItem('refreshToken')).toBe('refresh-token');
    expect(localStorage.getItem('userRoles')).toBe(JSON.stringify(['AUDIENCE']));
    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
  });

  it('routes organizers to the admin dashboard after successful login', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      mockJsonResponse({
        accessToken: 'organizer-token',
        refreshToken: 'organizer-refresh-token',
        user: { id: 'user-2', email: 'organizer@example.com', displayName: null, status: 'ACTIVE', roles: ['ORGANIZER'] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'organizer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('organizer-token'));
    expect(localStorage.getItem('userRoles')).toBe(JSON.stringify(['ORGANIZER']));
    expect(await screen.findByRole('heading', { name: 'Admin Dashboard' })).toBeInTheDocument();
  });
  it('blocks Check-in Staff-only accounts from the web app', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      mockJsonResponse({
        accessToken: 'staff-token',
        refreshToken: 'staff-refresh-token',
        user: { id: 'user-3', email: 'staff@example.com', displayName: null, status: 'ACTIVE', roles: ['CHECKIN_STAFF'] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'staff@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.any(Object)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('userRoles')).toBeNull();
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
