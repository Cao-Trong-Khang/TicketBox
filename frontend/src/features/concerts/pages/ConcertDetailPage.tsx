import { CalendarDays, MapPin, Music2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { formatConcertDate, getConcertDetail, getConcertTicketTypes } from '../api';
import { TicketTypeCard } from '../components/TicketTypeCard';
import { ConcertDetail, TicketType } from '../types';

export function ConcertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [concertDetail, setConcertDetail] = useState<ConcertDetail | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [hasBannerError, setHasBannerError] = useState(false);

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

  const shouldShowBanner = Boolean(concertDetail.bannerUrl) && !hasBannerError;

  return (
    <section className="concert-detail-page" aria-labelledby="concert-detail-title">
      <div className="concert-detail-container">
        <div className="concert-header">
          {shouldShowBanner ? (
            <img
              className="concert-card-banner"
              src={concertDetail.bannerUrl ?? undefined}
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
              <span>{formatConcertDate(concertDetail.startsAt)}</span>
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

        {concertDetail.description && (
          <section className="concert-description" aria-label="Mô tả sự kiện">
            <h2>Thông tin sự kiện</h2>
            <p>{concertDetail.description}</p>
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
                <TicketTypeCard key={ticketType.id} ticketType={ticketType} />
              ))}
            </div>
          )}
        </section>
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
