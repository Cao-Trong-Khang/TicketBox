import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { cancelOrganizerConcert, getOrganizerConcerts } from '../api';
import { OrganizerConcertCard } from '../components/OrganizerConcertCard';
import { OrganizerConcertListItem } from '../types';

export function OrganizerConcertDashboardPage() {
  const navigate = useNavigate();
  const [concerts, setConcerts] = useState<OrganizerConcertListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

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
    setActionError(null);

    try {
      setConcerts(await getOrganizerConcerts());
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async (concertId: string) => {
    setActionError(null);
    setFeedback(null);
    setPendingCancelId(concertId);

    try {
      const cancelledConcert = await cancelOrganizerConcert(concertId);
      setConcerts((current) =>
        current.map((concert) =>
          concert.id === concertId
            ? {
                ...concert,
                status: cancelledConcert.status,
                lifecycleStatus: cancelledConcert.lifecycleStatus,
                updatedAt: cancelledConcert.updatedAt,
              }
            : concert,
        ),
      );
      setFeedback('Concert đã được hủy.');
    } catch (err: unknown) {
      setActionError(toApiError(err));
    } finally {
      setPendingCancelId(null);
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
            <Button type="button" onClick={() => navigate('/organizer/concerts/new')}>
              Tạo concert
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

        {!isLoading && !error && feedback && <Alert tone="success">{feedback}</Alert>}
        {!isLoading && !error && actionError && (
          <Alert tone="error">{toActionErrorMessage(actionError)}</Alert>
        )}

        {!isLoading && !error && concerts.length === 0 && (
          <div className="organizer-dashboard-note">
            <p>Bạn chưa có concert nào trong kênh organizer.</p>
          </div>
        )}

        {!isLoading && !error && concerts.length > 0 && (
          <div className="concerts-grid organizer-dashboard-grid">
            {concerts.map((concert) => (
              <OrganizerConcertCard
                key={concert.id}
                concert={concert}
                canCancel={canCancelConcert(concert)}
                canEdit={canEditConcert(concert)}
                isCancelling={pendingCancelId === concert.id}
                onCancel={() => void handleCancel(concert.id)}
                onEdit={() => navigate(`/organizer/concerts/${concert.id}/edit`)}
                statusLabel={getOrganizerStatusLabel(concert)}
                statusVariant={getOrganizerStatusVariant(concert)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function canEditConcert(concert: OrganizerConcertListItem): boolean {
  return concert.status !== 'CANCELLED' && concert.lifecycleStatus === 'UPCOMING';
}

function canCancelConcert(concert: OrganizerConcertListItem): boolean {
  return concert.status !== 'CANCELLED' && concert.lifecycleStatus === 'UPCOMING';
}

function getOrganizerStatusLabel(concert: OrganizerConcertListItem): string {
  if (concert.status === 'CANCELLED') {
    return 'Đã hủy';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'Đang diễn ra';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'Đã kết thúc';
  }

  return 'Sắp diễn ra';
}

function getOrganizerStatusVariant(concert: OrganizerConcertListItem): string {
  if (concert.status === 'CANCELLED') {
    return 'cancelled';
  }

  if (concert.lifecycleStatus === 'ONGOING') {
    return 'ongoing';
  }

  if (concert.lifecycleStatus === 'ENDED') {
    return 'ended';
  }

  return 'upcoming';
}

function toActionErrorMessage(error: ApiError): string {
  if (error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (error.status === 403) {
    return 'Tài khoản này không có quyền organizer.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy concert organizer này.';
  }

  if (error.status === 409) {
    return error.message || 'Concert đang ở trạng thái không thể hủy.';
  }

  return error.message || 'Không thể cập nhật concert lúc này.';
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
