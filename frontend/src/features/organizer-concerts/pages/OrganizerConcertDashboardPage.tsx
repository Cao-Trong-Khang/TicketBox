import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { getOrganizerConcerts } from '../api';
import { OrganizerConcertListItem } from '../types';

export function OrganizerConcertDashboardPage() {
  const [concerts, setConcerts] = useState<OrganizerConcertListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let isActive = true;

    getOrganizerConcerts()
      .then((data) => {
        if (!isActive) {
          return;
        }

        setConcerts(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        setError(toApiError(err));
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const fetchConcerts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      setConcerts(await getOrganizerConcerts());
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="organizer-dashboard-page" aria-labelledby="organizer-dashboard-title">
      <div className="organizer-dashboard-container">
        <header className="organizer-dashboard-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-dashboard-title">Concert của bạn</h1>
            <p>Quản lý danh sách concert đã tạo và chuẩn bị cho các bước vận hành tiếp theo.</p>
          </div>

          <div className="organizer-toolbar" aria-label="Organizer actions">
            <Button type="button" className="organizer-placeholder-button" disabled>
              Tạo concert
              <span className="organizer-placeholder-tag">Sắp ra mắt</span>
            </Button>
          </div>
        </header>

        {isLoading && <p className="concerts-loading">Đang tải kênh organizer...</p>}

        {!isLoading && error?.status === 401 && (
          <div className="organizer-dashboard-note">
            <p>Vui lòng đăng nhập để truy cập kênh organizer</p>
            <Link to="/login" className="organizer-dashboard-link">
              Đi đến đăng nhập
            </Link>
          </div>
        )}

        {!isLoading && error?.status === 403 && (
          <div className="organizer-dashboard-note">
            <p>Tài khoản này không có quyền organizer</p>
          </div>
        )}

        {!isLoading && error && error.status !== 401 && error.status !== 403 && (
          <div className="concerts-error">
            <Alert tone="error">{error.message || 'Không thể tải kênh organizer.'}</Alert>
            <Button type="button" className="alert-action" onClick={fetchConcerts}>
              Thử lại
            </Button>
          </div>
        )}

        {!isLoading && !error && concerts.length === 0 && (
          <div className="organizer-dashboard-note">
            <p>Bạn chưa có concert nào trong kênh organizer.</p>
          </div>
        )}

        {!isLoading && !error && concerts.length > 0 && (
          <div className="organizer-dashboard-list">
            {concerts.map((concert) => (
              <article key={concert.id} className="organizer-concert-card">
                <div className="organizer-concert-card-main">
                  <div>
                    <div className="organizer-concert-card-topline">
                      <h2>{concert.title}</h2>
                      <span
                        className={`organizer-status organizer-status--${concert.status.toLowerCase()}`}
                      >
                        {concert.status}
                      </span>
                    </div>
                    <p className="organizer-concert-subtitle">
                      {concert.artistName || 'Đang cập nhật nghệ sĩ'}
                    </p>
                  </div>

                  <div className="organizer-concert-meta">
                    <p>{concert.venueName}</p>
                    <p>{formatDateRange(concert.startsAt, concert.endsAt)}</p>
                  </div>
                </div>

                <div className="organizer-concert-actions" aria-label={`Concert actions for ${concert.title}`}>
                  <Button type="button" className="organizer-placeholder-button" disabled>
                    Sửa
                    <span className="organizer-placeholder-tag">Sắp ra mắt</span>
                  </Button>
                  <Button type="button" className="organizer-placeholder-button" disabled>
                    Quản lý vé
                    <span className="organizer-placeholder-tag">Sắp ra mắt</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function formatDateRange(startsAt: string, endsAt: string | null): string {
  const formatter = new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });

  const startLabel = formatter.format(new Date(startsAt));

  if (!endsAt) {
    return startLabel;
  }

  return `${startLabel} - ${formatter.format(new Date(endsAt))}`;
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể tải kênh organizer.',
  };
}
