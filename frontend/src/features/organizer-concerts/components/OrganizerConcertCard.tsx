import { CalendarDays, MapPin, Music2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { resolveAssetUrl } from '../../../lib/assets';
import { formatConcertDate } from '../../concerts/api';
import { OrganizerConcertListItem } from '../types';

type OrganizerConcertCardProps = {
  concert: OrganizerConcertListItem;
  canCancel: boolean;
  canEdit: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  onEdit: () => void;
  statusLabel: string;
  statusVariant: string;
};

export function OrganizerConcertCard({
  concert,
  canCancel,
  canEdit,
  isCancelling,
  onCancel,
  onEdit,
  statusLabel,
  statusVariant,
}: OrganizerConcertCardProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const bannerUrl = resolveAssetUrl(concert.bannerUrl);
  const shouldShowBanner = Boolean(bannerUrl) && !hasImageError;

  return (
    <article className="concert-card organizer-dashboard-card">
      {shouldShowBanner ? (
        <img
          className="concert-card-banner"
          src={bannerUrl ?? undefined}
          alt={concert.title}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <div className="concert-card-banner concert-card-banner-empty" aria-label="Chưa có hình ảnh" />
      )}

      <div className="concert-card-content">
        <div className="organizer-dashboard-card-header">
          <div>
            <h2 className="concert-card-title">{concert.title}</h2>
            {concert.artistName && (
              <p className="concert-card-artist">
                <Music2 size={17} aria-hidden="true" />
                <span>{concert.artistName}</span>
              </p>
            )}
          </div>
          <span className={`organizer-status organizer-status--${statusVariant}`}>
            {statusLabel}
          </span>
        </div>

        <div className="concert-card-meta">
          <p>
            <CalendarDays size={17} aria-hidden="true" />
            <span>{formatConcertDate(concert.performanceStartAt)}</span>
          </p>
          <p className="concert-card-venue">
            <MapPin size={17} aria-hidden="true" />
            <span>
              {concert.venueName}
              {concert.venueAddress ? `, ${concert.venueAddress}` : ''}
            </span>
          </p>
        </div>

        <div className="concert-card-footer organizer-dashboard-card-footer">
          <div className="organizer-concert-actions" aria-label={`Concert actions for ${concert.title}`}>
            <Button type="button" disabled={!canEdit} onClick={onEdit}>
              Sửa
            </Button>
            <Button
              type="button"
              className="button-danger"
              disabled={!canCancel || isCancelling}
              onClick={onCancel}
            >
              {isCancelling ? 'Đang hủy...' : 'Hủy'}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
