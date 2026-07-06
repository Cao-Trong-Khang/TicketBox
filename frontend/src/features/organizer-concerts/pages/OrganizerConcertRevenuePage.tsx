import { CalendarDays, MapPin, Music2, Ticket, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api-client';
import { resolveAssetUrl } from '../../../lib/assets';
import { formatConcertDate, formatVnd } from '../../concerts/api';
import { getOrganizerConcertRevenue } from '../api';
import { getOrganizerStatusLabel, getOrganizerStatusVariant } from '../status-helpers';
import { OrganizerConcertRevenue } from '../types';

export function OrganizerConcertRevenuePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [revenue, setRevenue] = useState<OrganizerConcertRevenue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasBannerError, setHasBannerError] = useState(false);

  useEffect(() => {
    if (!id) {
      setError({
        status: 404,
        message: 'Không tìm thấy concert organizer này.',
      });
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    getOrganizerConcertRevenue(id)
      .then((data) => {
        if (!isActive) {
          return;
        }

        setRevenue(data);
        setHasBannerError(false);
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
  }, [id]);

  const bannerUrl = resolveAssetUrl(revenue?.concert.bannerUrl);
  const shouldShowBanner = Boolean(bannerUrl) && !hasBannerError;
  const statusLabel = revenue ? getOrganizerStatusLabel(revenue.concert) : '';
  const statusVariant = revenue ? getOrganizerStatusVariant(revenue.concert) : 'upcoming';
  const summaryItems = useMemo(
    () =>
      revenue
        ? [
            {
              label: 'Tổng doanh thu',
              value: formatVnd(revenue.summary.totalRevenueVnd),
            },
            {
              label: 'Đơn đã thanh toán',
              value: revenue.summary.paidOrderCount.toLocaleString('vi-VN'),
            },
            {
              label: 'Vé đã bán',
              value: revenue.summary.totalSoldQuantity.toLocaleString('vi-VN'),
            },
            {
              label: 'Vé đang giữ',
              value: revenue.summary.totalReservedQuantity.toLocaleString('vi-VN'),
            },
            {
              label: 'Vé còn lại',
              value: revenue.summary.totalAvailableQuantity.toLocaleString('vi-VN'),
            },
            {
              label: 'Tỷ lệ bán',
              value: formatPercent(revenue.summary.soldRate),
            },
          ]
        : [],
    [revenue],
  );

  if (isLoading) {
    return (
      <section className="organizer-dashboard-page" aria-labelledby="organizer-revenue-title">
        <div className="organizer-dashboard-container">
          <header className="organizer-dashboard-header">
            <div>
              <p className="eyebrow">Kênh organizer</p>
              <h1 id="organizer-revenue-title">Doanh thu concert</h1>
              <p>Đang tải số liệu bán vé và doanh thu cho concert này.</p>
            </div>
          </header>
          <p className="concerts-loading">Đang tải dashboard doanh thu...</p>
        </div>
      </section>
    );
  }

  if (error || !revenue) {
    return (
      <section className="organizer-dashboard-page" aria-labelledby="organizer-revenue-title">
        <div className="organizer-dashboard-container">
          <header className="organizer-dashboard-header">
            <div>
              <p className="eyebrow">Kênh organizer</p>
              <h1 id="organizer-revenue-title">Doanh thu concert</h1>
            </div>
            <Link to="/organizer/concerts" className="organizer-dashboard-link">
              Quay lại dashboard
            </Link>
          </header>

          <div className="organizer-dashboard-note">
            <p>{toErrorMessage(error)}</p>
            {error?.status === 401 && (
              <Link to="/login" className="organizer-dashboard-link">
                Đi đến đăng nhập
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="organizer-dashboard-page" aria-labelledby="organizer-revenue-title">
      <div className="organizer-dashboard-container organizer-revenue-layout">
        <header className="organizer-dashboard-header">
          <div>
            <p className="eyebrow">Kênh organizer</p>
            <h1 id="organizer-revenue-title">Doanh thu concert</h1>
            <p>Theo dõi doanh thu đã thanh toán, lượng vé đã bán và tình trạng tồn kho theo từng loại vé.</p>
          </div>

          <div className="organizer-toolbar" aria-label="Revenue page actions">
            <Link to="/organizer/concerts" className="organizer-dashboard-link">
              Quay lại dashboard
            </Link>
            <Button type="button" onClick={() => navigate(`/organizer/concerts/${revenue.concert.id}/edit`)}>
              Sửa concert
            </Button>
          </div>
        </header>

        <section className="concert-header organizer-revenue-hero" aria-label="Concert revenue header">
          {shouldShowBanner ? (
            <img
              className="concert-card-banner"
              src={bannerUrl ?? undefined}
              alt={revenue.concert.title}
              onError={() => setHasBannerError(true)}
            />
          ) : (
            <div className="concert-card-banner concert-card-banner-empty" aria-label="Chưa có hình ảnh" />
          )}

          <div className="concert-info">
            <div className="organizer-dashboard-card-header">
              <div>
                <p className="eyebrow">Concert</p>
                <h2 className="organizer-revenue-concert-title">{revenue.concert.title}</h2>
              </div>
              <span className={`organizer-status organizer-status--${statusVariant}`}>{statusLabel}</span>
            </div>

            {revenue.concert.artistName && (
              <p className="concert-card-artist organizer-revenue-artist">
                <Music2 size={18} aria-hidden="true" />
                <span>{revenue.concert.artistName}</span>
              </p>
            )}

            <p>
              <CalendarDays size={18} aria-hidden="true" />
              <span>{formatConcertDate(revenue.concert.performanceStartAt)}</span>
            </p>
            <p>
              <MapPin size={18} aria-hidden="true" />
              <span>
                {revenue.concert.venueName}
                {revenue.concert.venueAddress ? `, ${revenue.concert.venueAddress}` : ''}
              </span>
            </p>
            <p>
              <Ticket size={18} aria-hidden="true" />
              <span>Tổng số vé: {revenue.summary.totalTicketQuantity.toLocaleString('vi-VN')}</span>
            </p>
            <p>
              <Wallet size={18} aria-hidden="true" />
              <span>Doanh thu đã thanh toán: {formatVnd(revenue.summary.totalRevenueVnd)}</span>
            </p>
          </div>
        </section>

        {revenue.summary.paidOrderCount === 0 && (
          <Alert tone="success">
            Chưa có đơn thanh toán thành công. Dashboard vẫn hiển thị số vé đã giữ, đã bán và còn lại theo dữ liệu hiện có.
          </Alert>
        )}

        <section aria-labelledby="organizer-revenue-summary-title">
          <div className="organizer-panel-header">
            <h2 id="organizer-revenue-summary-title" className="organizer-section-title">
              Tổng quan
            </h2>
            <p className="organizer-section-copy">
              Các chỉ số này chỉ tính doanh thu từ đơn đã thanh toán thành công, tách biệt với vé đang được giữ chỗ.
            </p>
          </div>

          <div className="organizer-revenue-summary-grid">
            {summaryItems.map((item) => (
              <article key={item.label} className="organizer-revenue-summary-card">
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="organizer-editor-panel" aria-labelledby="organizer-revenue-breakdown-title">
          <div className="organizer-panel-header">
            <h2 id="organizer-revenue-breakdown-title" className="organizer-section-title">
              Chi tiết theo loại vé
            </h2>
            <p className="organizer-section-copy">
              So sánh giá bán, số lượng đã bán, số vé đang giữ và doanh thu của từng ticket type.
            </p>
          </div>

          {revenue.ticketTypes.length === 0 ? (
            <div className="organizer-dashboard-note organizer-inline-note">
              <p>Concert này chưa có loại vé nào để thống kê.</p>
            </div>
          ) : (
            <div className="organizer-ticket-type-list">
              {revenue.ticketTypes.map((ticketType) => (
                <article key={ticketType.id} className="organizer-ticket-type-card">
                  <div className="organizer-ticket-type-card-topline">
                    <div>
                      <h3>{ticketType.name}</h3>
                      <p className="organizer-ticket-code">{ticketType.code}</p>
                    </div>
                    <span className="organizer-placeholder-tag">{formatPercent(ticketType.soldRate)} đã bán</span>
                  </div>

                  <div className="organizer-ticket-type-meta organizer-revenue-ticket-grid">
                    <p>
                      <strong>Giá</strong>
                      <span>{formatVnd(ticketType.priceVnd)}</span>
                    </p>
                    <p>
                      <strong>Tổng số lượng</strong>
                      <span>{ticketType.totalQuantity.toLocaleString('vi-VN')}</span>
                    </p>
                    <p>
                      <strong>Đã bán</strong>
                      <span>{ticketType.soldQuantity.toLocaleString('vi-VN')}</span>
                    </p>
                    <p>
                      <strong>Đang giữ</strong>
                      <span>{ticketType.reservedQuantity.toLocaleString('vi-VN')}</span>
                    </p>
                    <p>
                      <strong>Còn lại</strong>
                      <span>{ticketType.availableQuantity.toLocaleString('vi-VN')}</span>
                    </p>
                    <p>
                      <strong>Doanh thu</strong>
                      <span>{formatVnd(ticketType.revenueVnd)}</span>
                    </p>
                  </div>
                </article>
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
    message: 'Không thể tải dashboard doanh thu.',
  };
}

function toErrorMessage(error: ApiError | null): string {
  if (!error) {
    return 'Không thể tải dashboard doanh thu.';
  }

  if (error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }

  if (error.status === 403) {
    return 'Tài khoản này không có quyền organizer.';
  }

  if (error.status === 404) {
    return 'Không tìm thấy concert organizer này.';
  }

  return error.message || 'Không thể tải dashboard doanh thu.';
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}
