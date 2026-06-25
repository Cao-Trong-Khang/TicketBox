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
    expect(screen.getByRole('button', { name: 'Quản lý vé' })).toBeInTheDocument();
    expect(screen.queryByText('Sắp ra mắt')).not.toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: 'Cấu hình vé' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo concert' }));

    expect(await screen.findByText('Vui lòng nhập tên concert.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng chọn thời gian bắt đầu.')).toBeInTheDocument();
  });

  it('blocks concert creation when no local ticket type is configured', async () => {
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

    expect(
      await screen.findByText('Vui lòng cấu hình ít nhất một loại vé trước khi tạo concert.'),
    ).toBeInTheDocument();
  });

  it('creates a concert, creates ticket types, activates them, then navigates to edit page', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerTicketTypeDetail()))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          ...createOrganizerTicketTypeDetail(),
          status: 'ACTIVE',
        }),
      )
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/new');

    fireEvent.change(screen.getByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));

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
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types',
        expect.any(Object),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types/99999999-9999-4999-8999-999999999999/activate',
        expect.any(Object),
      ),
    );
    expect(await screen.findByRole('heading', { name: /Chỉnh sửa Organizer Draft Concert/i })).toBeInTheDocument();
  });

  it('rejects duplicate local ticket codes before final submit', async () => {
    renderApp('/organizer/concerts/new');

    fireEvent.change(screen.getByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));

    fireEvent.change(screen.getByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé VIP' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '900000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));

    expect(
      await screen.findByText('Mã loại vé đang bị trùng trong danh sách cấu hình cục bộ.'),
    ).toBeInTheDocument();
  });

  it('keeps concert form values unchanged after adding a local ticket type', async () => {
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
    fireEvent.change(screen.getByLabelText('Mô tả'), {
      target: { value: 'Draft description' },
    });
    fireEvent.change(screen.getByLabelText('Banner URL'), {
      target: { value: 'https://example.test/banner.jpg' },
    });
    fireEvent.change(screen.getByLabelText('Seating SVG'), {
      target: { value: '<svg />' },
    });

    fireEvent.change(screen.getByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));

    expect(screen.getByLabelText('Tên concert')).toHaveValue('Organizer Draft Concert');
    expect(screen.getByLabelText('Nghệ sĩ')).toHaveValue('TicketBox Artist');
    expect(screen.getByLabelText('Địa điểm')).toHaveValue('TicketBox Arena');
    expect(screen.getByLabelText('Địa chỉ')).toHaveValue('District 1');
    expect(screen.getByLabelText('Bắt đầu')).toHaveValue('2026-08-20T19:30');
    expect(screen.getByLabelText('Kết thúc')).toHaveValue('2026-08-20T22:30');
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Draft description');
    expect(screen.getByLabelText('Banner URL')).toHaveValue('https://example.test/banner.jpg');
    expect(screen.getByLabelText('Seating SVG')).toHaveValue('<svg />');

    expect(screen.getByLabelText('Mã loại vé')).toHaveValue('');
    expect(screen.getByLabelText('Tên loại vé')).toHaveValue('');
    expect(screen.getByLabelText('Giá vé (VND)')).toHaveValue('');
    expect(screen.getByLabelText('Tổng số vé')).toHaveValue('');
    expect(screen.getByLabelText('Giới hạn mỗi người')).toHaveValue('');
  });

  it('shows recovery guidance when concert creation succeeds but ticket setup fails', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse({ message: 'Duplicate code' }, 409));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/new');

    fireEvent.change(screen.getByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm loại vé' }));

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

    expect(
      await screen.findByText(
        'Concert đã được tạo nhưng một số loại vé chưa hoàn tất. Vui lòng kiểm tra lại trong trang Quản lý vé.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đi đến Quản lý vé' })).toBeInTheDocument();
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

  it('renders organizer ticket-type management route with list data', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerTicketTypes()));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types');

    expect(await screen.findByRole('heading', { name: /Quản lý vé - Organizer Draft Concert/i })).toBeInTheDocument();
    expect(screen.getByText('Vé thường')).toBeInTheDocument();
    expect(screen.getByText('500.000 ₫')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Bắt đầu bán')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Kết thúc bán')).not.toBeInTheDocument();
  });

  it('validates organizer ticket-type form before submit', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types');

    await screen.findByRole('heading', { name: /Quản lý vé - Organizer Draft Concert/i });
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạo loại vé' })[1]);

    expect(await screen.findByText('Vui lòng nhập mã loại vé.')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập giá vé.')).toBeInTheDocument();
  });

  it('creates and then activates an organizer ticket type', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse([]))
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerTicketTypeDetail()))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          ...createOrganizerTicketTypeDetail(),
          status: 'ACTIVE',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types');

    fireEvent.change(await screen.findByLabelText('Mã loại vé'), {
      target: { value: 'GA' },
    });
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường' },
    });
    fireEvent.change(screen.getByLabelText('Giá vé (VND)'), {
      target: { value: '500000' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Giới hạn mỗi người'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạo loại vé' })[1]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types',
        expect.any(Object),
      ),
    );
    expect(await screen.findByText('Đã tạo loại vé mới. Backend hiện mặc định trạng thái INACTIVE.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types/99999999-9999-4999-8999-999999999999/activate',
        expect.any(Object),
      ),
    );
    expect(await screen.findByText('Loại vé đã được kích hoạt.')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('updates an organizer ticket type from edit mode', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerConcertDetail()))
      .mockImplementationOnce(() => mockJsonResponse(createOrganizerTicketTypes()))
      .mockImplementationOnce(() =>
        mockJsonResponse({
          ...createOrganizerTicketTypeDetail(),
          name: 'Vé thường cập nhật',
          totalQuantity: 150,
          availableQuantity: 145,
          updatedAt: '2026-06-24T12:00:00.000Z',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types');

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }));
    fireEvent.change(screen.getByLabelText('Tên loại vé'), {
      target: { value: 'Vé thường cập nhật' },
    });
    fireEvent.change(screen.getByLabelText('Tổng số vé'), {
      target: { value: '150' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu loại vé' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/organizer/concerts/77777777-7777-4777-8777-777777777777/ticket-types/99999999-9999-4999-8999-999999999999',
        expect.any(Object),
      ),
    );
    expect(await screen.findByText('Đã cập nhật loại vé.')).toBeInTheDocument();
    expect(screen.getByText('Vé thường cập nhật')).toBeInTheDocument();
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

function createOrganizerTicketTypes() {
  return [createOrganizerTicketTypeDetail()];
}

function createOrganizerTicketTypeDetail() {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    code: 'GA',
    name: 'Vé thường',
    priceVnd: 500000,
    totalQuantity: 100,
    reservedQuantity: 0,
    soldQuantity: 0,
    availableQuantity: 100,
    perUserLimit: 4,
    saleStartAt: '2026-08-01T03:00:00.000Z',
    saleEndAt: '2026-08-20T12:00:00.000Z',
    status: 'INACTIVE',
    createdAt: '2026-06-24T10:00:00.000Z',
    updatedAt: '2026-06-24T10:00:00.000Z',
  };
}
