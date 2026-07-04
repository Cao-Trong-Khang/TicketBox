import { CalendarDays, FileText, MapPin, Music2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { resolveAssetUrl } from '../../../lib/assets';
import { createOrder } from '../../orders/api';
import { userHasRole } from '../../auth/session';
import { formatConcertDate, getConcertDetail, getConcertTicketTypes } from '../api';
import { TicketTypeCard } from '../components/TicketTypeCard';
import { TicketSelectionSummary } from '../components/TicketSelectionSummary';
import { ConcertDetail, TicketType } from '../types';

type SelectionState = Record<string, number>;

export function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [concertDetail, setConcertDetail] = useState<ConcertDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [hasBannerError, setHasBannerError] = useState(false);
  const [selections, setSelections] = useState<SelectionState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<ApiError | null>(null);

  useEffect(() => {
    let isActive = true;

    const request = id
      ? Promise.all([getConcertDetail(id), getConcertTicketTypes(id)])
      : Promise.reject({ status: 404, message: 'Sự kiện không tồn tại' });

    request
      .then(([detail, types]) => {
        if (!isActive) {
          return;
        }

        setConcertDetail(detail);
        setTicketTypes(types);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (!isActive) {
          return;
        }

        const apiError = toApiError(err);
        if (apiError.status === 404) {
          setNotFound(true);
        } else {
          setError(apiError);
        }
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  const retry = async () => {
    if (!id) {
      setNotFound(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setHasBannerError(false);

    try {
      const [detail, types] = await Promise.all([getConcertDetail(id), getConcertTicketTypes(id)]);
      setConcertDetail(detail);
      setTicketTypes(types);
    } catch (err: unknown) {
      const apiError = toApiError(err);
      if (apiError.status === 404) {
        setNotFound(true);
      } else {
        setError(apiError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleIncrease = (ticketTypeId: string) => {
    setSelections(prev => {
      const ticketType = ticketTypes.find(t => t.id === ticketTypeId);
      if (!ticketType) return prev;

      const currentQty = prev[ticketTypeId] ?? 0;
      const maxQty = Math.min(ticketType.availableQuantity, ticketType.perUserLimit);

      if (currentQty >= maxQty) return prev;

      return { ...prev, [ticketTypeId]: currentQty + 1 };
    });
    setSubmissionError(null);
  };

  const handleDecrease = (ticketTypeId: string) => {
    setSelections(prev => {
      const currentQty = prev[ticketTypeId] ?? 0;
      if (currentQty <= 0) return prev;

      return { ...prev, [ticketTypeId]: currentQty - 1 };
    });
    setSubmissionError(null);
  };

  const handleContinue = async () => {
    if (!id || isSubmitting) return;

    const idempotencyKey = crypto.randomUUID();
    const items = ticketTypes
      .filter(t => selections[t.id] && selections[t.id] > 0)
      .map(t => ({
        ticketTypeId: t.id,
        quantity: selections[t.id],
      }));

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const response = await createOrder({
        concertId: id,
        idempotencyKey,
        items,
      });
      navigate(`/orders/${response.orderId}`, { state: { order: response } });
    } catch (err: unknown) {
      const apiError = toApiError(err);
      setSubmissionError(apiError);
      setIsSubmitting(false);
    }
  };

  const getSelectedItems = () => {
    return ticketTypes
      .filter(t => selections[t.id] > 0)
      .map(t => ({
        ticketType: t,
        quantity: selections[t.id],
        lineTotal: t.priceVnd * selections[t.id],
      }));
  };

  const getTotalQuantity = () => Object.values(selections).reduce((sum, qty) => sum + qty, 0);

  const getTotalAmount = () => {
    return ticketTypes.reduce((sum, t) => {
      const qty = selections[t.id] ?? 0;
      return sum + t.priceVnd * qty;
    }, 0);
  };

  if (isLoading) {
    return <p className="concerts-loading">Đang tải thông tin sự kiện...</p>;
  }

  if (notFound) {
    return <p className="concerts-empty">Sự kiện không tồn tại</p>;
  }

  if (error) {
    return (
      <div className="concerts-error">
        <Alert tone="error">{error.message || 'Không thể tải thông tin sự kiện.'}</Alert>
        <Button type="button" className="alert-action" onClick={retry}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (!concertDetail) {
    return <p className="concerts-empty">Sự kiện không tồn tại</p>;
  }

  const bannerUrl = resolveAssetUrl(concertDetail.bannerUrl);
  const shouldShowBanner = Boolean(bannerUrl) && !hasBannerError;
  const isOrganizer = userHasRole('ORGANIZER');

  return (
    <section className="concert-detail-page" aria-labelledby="concert-detail-title">
      <div className="concert-detail-container">
        <div className="concert-header">
          {shouldShowBanner ? (
            <img
              className="concert-card-banner"
              src={bannerUrl ?? undefined}
              alt={concertDetail.title}
              onError={() => setHasBannerError(true)}
            />
          ) : (
            <div className="concert-card-banner concert-card-banner-empty" aria-label="Chưa có hình ảnh" />
          )}

          <div className="concert-info">
            <p className="eyebrow">TicketBox</p>
            <h1 id="concert-detail-title">{concertDetail.title}</h1>
            {concertDetail.artistName && (
              <p>
                <Music2 size={18} aria-hidden="true" />
                <span>{concertDetail.artistName}</span>
              </p>
            )}
            <p>
              <CalendarDays size={18} aria-hidden="true" />
              <span>{formatConcertDate(concertDetail.performanceStartAt)}</span>
            </p>
            <p>
              <CalendarDays size={18} aria-hidden="true" />
              <span>
                Mở bán vé: {formatConcertDate(concertDetail.startsAt)}
                {concertDetail.endsAt ? ` - ${formatConcertDate(concertDetail.endsAt)}` : ''}
              </span>
            </p>
            <p>
              <MapPin size={18} aria-hidden="true" />
              <span>
                {concertDetail.venueName}
                {concertDetail.venueAddress ? `, ${concertDetail.venueAddress}` : ''}
              </span>
            </p>
          </div>
        </div>

        {isOrganizer && id && (
          <section className="concert-admin-tools" aria-label="Công cụ Organizer">
            <div>
              <p className="eyebrow">Organizer tools</p>
              <h2>AI Artist Bio</h2>
              <p>Upload press kit PDF để tạo hoặc cập nhật tiểu sử nghệ sĩ cho concert này.</p>
            </div>
            <Button type="button" onClick={() => navigate(`/admin/concerts/${id}/artist-bio`)}>
              <FileText size={18} aria-hidden="true" />
              Quản lý AI Artist Bio
            </Button>
          </section>
        )}

        {concertDetail.description && (
          <section className="concert-description" aria-label="Mô tả sự kiện">
            <h2>Thông tin sự kiện</h2>
            <p>{concertDetail.description}</p>
          </section>
        )}

        {concertDetail.artist_bio && (
          <section className="concert-description artist-biography" aria-label="Tiểu sử nghệ sĩ">
            <h2>Tiểu sử nghệ sĩ</h2>
            <p>{concertDetail.artist_bio}</p>
          </section>
        )}
        <section aria-label="Sơ đồ chỗ ngồi">
          <h2>Sơ đồ chỗ ngồi</h2>
          {concertDetail.seatingSvg ? (
            <div className="concert-seatmap">
              {/*
                XSS safety note: seatingSvg is currently backend-controlled TicketBox data.
                If this ever becomes organizer/user-uploaded content, sanitize it before rendering.
              */}
              <div dangerouslySetInnerHTML={{ __html: concertDetail.seatingSvg }} />
            </div>
          ) : (
            <div className="concert-seatmap-placeholder">Chưa có sơ đồ chỗ ngồi</div>
          )}
        </section>

        <section className="concert-tickets-section" aria-labelledby="ticket-types-title">
          <h2 id="ticket-types-title">HẠNG VÉ HIỆN CÓ</h2>
          {ticketTypes.length === 0 ? (
            <p className="concerts-empty">Chưa có hạng vé đang mở bán.</p>
          ) : (
            <div className="ticket-types-list">
              {ticketTypes.map((ticketType) => (
                <TicketTypeCard
                  key={ticketType.id}
                  ticketType={ticketType}
                  quantity={selections[ticketType.id] ?? 0}
                  onIncrease={() => handleIncrease(ticketType.id)}
                  onDecrease={() => handleDecrease(ticketType.id)}
                />
              ))}
            </div>
          )}
        </section>

        {submissionError && (
          <div className="order-error-container">
            {submissionError.status === 401 ? (
              <div>
                <Alert tone="error">{submissionError.message || 'Vui lòng đăng nhập để đặt vé'}</Alert>
                <Button
                  type="button"
                  className="alert-action"
                  onClick={() => navigate('/login')}
                >
                  Đăng nhập
                </Button>
              </div>
            ) : submissionError.status === 409 ? (
              <div>
                <Alert tone="error">{submissionError.message}</Alert>
                <p className="order-error-hint">Vui lòng làm mới để xem tính khả dụng mới nhất.</p>
              </div>
            ) : (
              <Alert tone="error">{submissionError.message || 'Có lỗi xảy ra'}</Alert>
            )}
          </div>
        )}

        <TicketSelectionSummary
          selectedItems={getSelectedItems()}
          totalQuantity={getTotalQuantity()}
          totalAmount={getTotalAmount()}
          onContinue={handleContinue}
          isSubmitting={isSubmitting}
        />
      </div>
    </section>
  );
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return error as ApiError;
  }

  return {
    status: 0,
    message: 'Không thể tải thông tin sự kiện.',
  };
}
