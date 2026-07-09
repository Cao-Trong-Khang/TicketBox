import { CalendarDays, MapPin, Music2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { resolveAssetUrl } from '../../../lib/assets';
import { formatConcertDate, formatPrice } from '../api';
import { Concert } from '../types';

type ConcertCardProps = {
  concert: Concert;
  onNavigate: (id: string) => void;
};

export function ConcertCard({ concert, onNavigate }: ConcertCardProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const handleNavigate = () => onNavigate(concert.id);
  const bannerUrl = resolveAssetUrl(concert.bannerUrl);
  const shouldShowBanner = Boolean(bannerUrl) && !hasImageError;

  return (
    <article className="concert-card">
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
        <div>
          <h2 className="concert-card-title">{concert.title}</h2>
          {concert.artistName && (
            <p className="concert-card-artist">
              <Music2 size={17} aria-hidden="true" />
              <span>{concert.artistName}</span>
            </p>
          )}
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

        <div className="concert-card-footer">
          <strong>{formatPrice(concert.minPriceVnd)}</strong>
          <Button type="button" className="concert-card-action" onClick={handleNavigate}>
            Xem chi tiết
          </Button>
        </div>
      </div>
    </article>
  );
}
