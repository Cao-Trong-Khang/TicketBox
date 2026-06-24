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

  it('stores access token and routes audience login to concerts after successful profile lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse({ accessToken: 'jwt-token' }))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          id: 'user-1',
          email: 'audience@example.com',
          roles: ['AUDIENCE'],
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(createConcerts()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/login', expect.any(Object)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/me', expect.any(Object)));
    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('jwt-token'));
    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
  });

  it('redirects organizer login to organizer dashboard after profile lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse({ accessToken: 'jwt-token' }))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          id: 'user-2',
          email: 'organizer@example.com',
          roles: ['ORGANIZER'],
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcerts()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'organizer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/auth/me', expect.any(Object)));
    expect(await screen.findByRole('heading', { name: 'Concert của bạn' })).toBeInTheDocument();
  });

  it('falls back to concerts when auth profile lookup fails after successful login', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse({ accessToken: 'jwt-token' }))
      .mockImplementationOnce(() => mockJsonResponse({ message: 'Unauthorized' }, 401))
      .mockImplementationOnce(() => mockJsonResponse(createConcerts()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/login');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'audience@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(localStorage.getItem('accessToken')).toBe('jwt-token'));
    expect(await screen.findByRole('heading', { name: 'Concert sắp diễn ra' })).toBeInTheDocument();
  });

  it('renders the organizer dashboard route with concert list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse(createOrganizerConcerts())));

    renderApp('/organizer/concerts');

    expect(await screen.findByRole('heading', { name: 'Concert của bạn' })).toBeInTheDocument();
    expect(screen.getByText('Organizer Draft Concert')).toBeInTheDocument();
    expect(screen.getByText('TicketBox Artist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo concert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
    expect(screen.getAllByText('Sắp ra mắt')).toHaveLength(1);
  });

  it('shows organizer empty state when no concerts are returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => mockJsonResponse([])));

    renderApp('/organizer/concerts');

    expect(await screen.findByText('Bạn chưa có concert nào trong kênh organizer.')).toBeInTheDocument();
  });

  it('shows organizer login guidance for 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        mockJsonResponse({ message: 'Unauthorized' }, 401),
      ),
    );

    renderApp('/organizer/concerts');

    expect(
      await screen.findByText('Vui lòng đăng nhập để truy cập kênh organizer'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đi đến đăng nhập' })).toHaveAttribute('href', '/login');
  });

  it('shows organizer permission guidance for 403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => mockJsonResponse({ message: 'Forbidden' }, 403)),
    );

    renderApp('/organizer/concerts');

    expect(await screen.findByText('Tài khoản này không có quyền organizer')).toBeInTheDocument();
  });

  it('renders the organizer create route and validates required fields', async () => {
    renderApp('/organizer/concerts/new');

    expect(screen.getByRole('heading', { name: 'Tạo concert mới' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(await screen.findByText('Vui lòng nhập tên concert.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn thời gian bắt đầu.')).toBeInTheDocument();
  });

  it('creates a concert then navigates to edit page when id is available', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/new');

    fireEvent.change(screen.getByLabelText('Tên concert'), {
      target: { value: 'Organizer Draft Concert' },
    });
    fireEvent.change(screen.getByLabelText('Nghệ sĩ'), {
      target: { value: 'TicketBox Artist' },
    });
    fireEvent.change(screen.getByLabelText('Địa điểm'), {
      target: { value: 'TicketBox Arena' },
    });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), {
      target: { value: 'District 1' },
    });
    fireEvent.change(screen.getByLabelText('Bắt đầu'), {
      target: { value: '2026-08-20T19:30' },
    });
    fireEvent.change(screen.getByLabelText('Kết thúc'), {
      target: { value: '2026-08-20T22:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts',
        expect.any(Object),
      ),
    );
    expect(await screen.findByRole('heading', { name: /Chỉnh sửa Organizer Draft Concert/i })).toBeInTheDocument();
  });

  it('loads published concert edit page as read-only and shows the MVP note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        mockJsonResponse({
          ...createOrganizerConcertDetail(),
          status: 'PUBLISHED',
        }),
      ),
    );

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/edit');

    expect(await screen.findByText('Concert đã publish, chưa hỗ trợ chỉnh sửa trong MVP.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Publish concert' })).not.toBeInTheDocument();
  });

  it('publishes a draft concert from the edit page', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          ...createOrganizerConcertDetail(),
          status: 'PUBLISHED',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/edit');

    fireEvent.click(await screen.findByRole('button', { name: 'Publish concert' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/publish',
        expect.any(Object),
      ),
    );
    expect(await screen.findByText('Concert đã được publish.')).toBeInTheDocument();
    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
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

function createOrganizerConcerts() {
  return [
    {
      id: '77777777-7777-4777-8777-777777777777',
      status: 'DRAFT',
      title: 'Organizer Draft Concert',
      artistName: 'TicketBox Artist',
      venueName: 'TicketBox Arena',
      startsAt: '2026-08-20T12:30:00.000Z',
      endsAt: '2026-08-20T15:30:00.000Z',
      createdAt: '2026-06-24T10:00:00.000Z',
      updatedAt: '2026-06-24T10:00:00.000Z',
    },
  ];
}

function createOrganizerConcertDetail() {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    status: 'DRAFT',
    title: 'Organizer Draft Concert',
    artistName: 'TicketBox Artist',
    description: 'Draft description',
    venueName: 'TicketBox Arena',
    venueAddress: 'District 1',
    bannerUrl: '',
    seatingSvg: '',
    startsAt: '2026-08-20T12:30:00.000Z',
    endsAt: '2026-08-20T15:30:00.000Z',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T10:00:00.000Z',
  };
}
