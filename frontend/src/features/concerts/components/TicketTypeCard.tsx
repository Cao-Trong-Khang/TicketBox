import { Button } from '../../../components/ui/Button';
import { formatConcertDate, formatVnd } from '../api';
import { TicketType } from '../types';

type TicketTypeCardProps = {
  ticketType: TicketType;
};

export function TicketTypeCard({ ticketType }: TicketTypeCardProps) {
  const isSoldOut = ticketType.availableQuantity === 0;
  const saleEndLabel = ticketType.saleEndAt
    ? formatConcertDate(ticketType.saleEndAt)
    : 'Không giới hạn';

  return (
    <article className={`ticket-type-card ${isSoldOut ? 'ticket-type-card--sold-out' : ''}`}>
      <div className="ticket-type-card-main">
        <div>
          <h3>
            {ticketType.name} ({ticketType.code})
          </h3>
          <p className="ticket-type-card-period">
            {formatConcertDate(ticketType.saleStartAt)} — {saleEndLabel}
          </p>
        </div>

        <strong>{formatVnd(ticketType.priceVnd)}</strong>
      </div>

      <div className="ticket-type-card-details">
        {isSoldOut ? (
          <span className="ticket-type-badge">Hết vé</span>
        ) : (
          <span>Còn {ticketType.availableQuantity.toLocaleString('vi-VN')} vé</span>
        )}
        <span>Max {ticketType.perUserLimit} vé/người</span>
        <span>Tổng {ticketType.totalQuantity.toLocaleString('vi-VN')} vé</span>
      </div>

      <Button className="ticket-type-card-button" type="button" disabled>
        Chọn vé
      </Button>
    </article>
  );
}
