import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function createConcerts() {
  return [
    {
      id: 'concert-1',
      title: 'Anh Trai Say Hi Concert 2026',
      artistName: 'Anh Trai Say Hi',
      description: null,
      venueName: 'Nhà thi đấu',
      venueAddress: 'Hà Nội',
      bannerUrl: null,
      startsAt: '2026-07-01T20:00:00.000Z',
      endsAt: '2026-07-01T23:00:00.000Z',
      minPriceVnd: 800000,
    },
  ];
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

  it('renders login page from the root route', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('renders login page', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('redirects unauthenticated users away from concerts page to login', async () => {
    renderApp('/concerts');

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('hides header navigation links before login', () => {
    renderApp('/login');

    const header = screen.getByRole('banner');

    expect(within(header).queryByRole('link', { name: 'Concerts' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument();
    expect(within(header).queryByRole('link', { name: 'Đăng ký' })).not.toBeInTheDocument();
  });

  it('renders register page', () => {
    renderApp('/register');

    expect(screen.getByRole('heading', { name: 'Đăng ký' })).toBeInTheDocument();
  });

  it('stores token and redirects audience user after login', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      mockJsonResponse({
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'audience@example.com',
          displayName: null,
          status: 'ACTIVE',
          roles: ['AUDIENCE'],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'audience@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(localStorage.getItem('accessToken')).toBe('jwt-token'),
    );

    expect(localStorage.getItem('userRoles')).toBe(JSON.stringify(['AUDIENCE']));

    expect(
      await screen.findByRole('heading', { name: 'Concert sắp diễn ra' }),
    ).toBeInTheDocument();
  });

  it('redirects organizer user to organizer page after login', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      mockJsonResponse({
        accessToken: 'organizer-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-2',
          email: 'organizer@example.com',
          displayName: null,
          status: 'ACTIVE',
          roles: ['ORGANIZER'],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'organizer@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() =>
      expect(localStorage.getItem('accessToken')).toBe('organizer-token'),
    );

    expect(localStorage.getItem('userRoles')).toBe(JSON.stringify(['ORGANIZER']));

    expect(
      await screen.findByRole('heading', { name: 'Admin Dashboard' }),
    ).toBeInTheDocument();
  });

  it('blocks check-in staff accounts', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() =>
      mockJsonResponse({
        accessToken: 'staff-token',
        refreshToken: 'staff-refresh-token',
        user: {
          id: 'user-3',
          email: 'staff@example.com',
          displayName: null,
          status: 'ACTIVE',
          roles: ['CHECKIN_STAFF'],
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'staff@example.com' },
    });

    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(
      await screen.findByText('Tài khoản nhân viên check-in chỉ dùng trên ứng dụng mobile.'),
    ).toBeInTheDocument();

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(localStorage.getItem('userRoles')).toBeNull();
  });

  it('redirects non-organizers away from organizer routes', async () => {
    localStorage.setItem('accessToken', 'audience-token');
    localStorage.setItem('userRoles', JSON.stringify(['AUDIENCE']));

    renderApp('/organizer/concerts');

    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Concert của bạn' })).not.toBeInTheDocument();
  });

  it('navigates to the organizer dashboard from the concert management card', async () => {
    localStorage.setItem('accessToken', 'organizer-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse([])));

    renderApp('/admin/dashboard');

    fireEvent.click(await screen.findByRole('button', { name: /Concert Management/i }));

    expect(await screen.findByRole('heading', { name: 'Concert của bạn' })).toBeInTheDocument();
  });
});