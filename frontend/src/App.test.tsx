import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app/App';
import { RoleCode, UserProfile } from './features/auth/types';

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

function loginResponse(roles: RoleCode[]) {
  return {
    access_token: 'jwt-token',
    refresh_token: 'refresh-token',
    user: userProfile(roles),
  };
}

function userProfile(roles: RoleCode[]): UserProfile {
  return {
    id: 'user-1',
    email: 'user@example.com',
    fullName: 'Ticket User',
    phone: null,
    status: 'ACTIVE',
    roles,
  };
}

function storeSession(roles: RoleCode[]) {
  localStorage.setItem('accessToken', 'jwt-token');
  localStorage.setItem('refreshToken', 'refresh-token');
  localStorage.setItem('ticketboxUser', JSON.stringify(userProfile(roles)));
}

describe('frontend auth and RBAC routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('redirects anonymous root traffic to login', () => {
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('sends successful registration to login without storing a token', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      mockJsonResponse({
        id: 'user-1',
        email: 'audience@example.com',
        fullName: 'Audience User',
        phone: null,
        status: 'ACTIVE',
        roles: ['AUDIENCE'],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/register');

    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Audience User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/register', expect.any(Object)),
    );
    expect(localStorage.getItem('accessToken')).toBeNull();

    await screen.findByText('Đăng ký thành công. Bạn sẽ được chuyển sang màn hình đăng nhập.');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument());
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('redirects audience users to concerts after login and renders audience navigation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => mockJsonResponse(loginResponse(['AUDIENCE'])));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('jwt-token'));
    expect(screen.getByRole('heading', { name: 'Concerts' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Tickets' })).toBeInTheDocument();
  });

  it('redirects organizer users to admin dashboard and shows organizer navigation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => mockJsonResponse(loginResponse(['ORGANIZER'])));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'organizer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByRole('link', { name: 'Concert Management' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revenue Stats' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'VIP CSV Import' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Artist Bio' })).toBeInTheDocument();
  });

  it('redirects gate staff users to check-in and shows gate staff navigation', async () => {
    const fetchMock = vi.fn().mockImplementation(() => mockJsonResponse(loginResponse(['GATE_STAFF'])));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'gate@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await screen.findByRole('heading', { name: 'QR Scanner' });
    expect(screen.getByRole('link', { name: 'VIP Guest List' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offline Scan Log' })).toBeInTheDocument();
  });

  it('guards admin, check-in, and my tickets routes', () => {
    storeSession(['AUDIENCE']);
    const { rerender } = renderApp('/admin/dashboard');

    expect(screen.getByRole('heading', { name: 'Concerts' })).toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={['/checkin']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Concerts' })).toBeInTheDocument();

    localStorage.clear();
    rerender(
      <MemoryRouter initialEntries={['/tickets/my']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('clears invalid sessions when backend returns unauthorized', async () => {
    storeSession(['AUDIENCE']);
    const fetchMock = vi.fn().mockImplementation(() =>
      mockJsonResponse({ error: 'Unauthorized', message: 'Invalid token', status_code: 401 }, 401),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/tickets/my');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));

    await waitFor(() => expect(localStorage.getItem('accessToken')).toBeNull());
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
