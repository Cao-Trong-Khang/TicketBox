import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';

function renderApp(initialEntry: string | { pathname: string; state?: unknown } = '/') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
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
      )
      .mockImplementationOnce(() => mockJsonResponse([]));

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
      await screen.findByRole('heading', { name: 'Concert của bạn' }),
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

  it('redirects the legacy admin dashboard path to the organizer dashboard', async () => {
    localStorage.setItem('accessToken', 'organizer-token');
    localStorage.setItem('userRoles', JSON.stringify(['ORGANIZER']));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse([])));

    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Concert của bạn' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đơn hàng của tôi' })).not.toBeInTheDocument();
  });

  it('shows audience history navigation and renders the history route', async () => {
    localStorage.setItem('accessToken', 'audience-token');
    localStorage.setItem('userRoles', JSON.stringify(['AUDIENCE']));
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse([])));

    renderApp('/orders');

    expect(screen.getByRole('link', { name: 'Đơn hàng của tôi' })).toHaveAttribute('href', '/orders');
    expect(screen.getByRole('link', { name: 'Sự kiện' })).toHaveAttribute('href', '/concerts');
    expect(await screen.findByRole('heading', { name: 'Lịch sử đơn hàng' })).toBeInTheDocument();
    expect(await screen.findByText('Chưa có đơn hàng nào.')).toBeInTheDocument();
  });

  it('keeps the pending order detail route behavior unchanged', async () => {
    localStorage.setItem('accessToken', 'audience-token');
    localStorage.setItem('userRoles', JSON.stringify(['AUDIENCE']));

    renderApp({
      pathname: '/orders/order-1',
      state: {
        order: {
          orderId: 'order-1',
          orderCode: 'ORD-999',
          status: 'PENDING',
          totalAmountVnd: 990000,
          expiresAt: '2026-07-06T15:00:00.000Z',
        },
      },
    });

    expect(await screen.findByRole('heading', { name: 'Đơn hàng của bạn' })).toBeInTheDocument();
    expect(screen.getByText('ORD-999')).toBeInTheDocument();
  });
});
