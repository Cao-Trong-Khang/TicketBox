import { formatConcertDate, formatVnd } from '../api';
import { TicketType } from '../types';

type TicketTypeCardProps = {
  ticketType: TicketType;
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
};

export function TicketTypeCard({ ticketType, quantity, onIncrease, onDecrease }: TicketTypeCardProps) {
  const isSoldOut = ticketType.availableQuantity === 0;
  const maxQty = Math.min(ticketType.availableQuantity, ticketType.perUserLimit);
  const canIncrease = !isSoldOut && quantity < maxQty;
  const canDecrease = quantity > 0;

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

      {isSoldOut ? (
        <div className="ticket-quantity-selector ticket-quantity-selector--disabled">
          <span>Hết vé</span>
        </div>
      ) : (
        <div className="ticket-quantity-selector">
          <button
            className="ticket-qty-button"
            type="button"
            onClick={onDecrease}
            disabled={!canDecrease}
            aria-label="Giảm số lượng vé"
          >
            −
          </button>
          <span className="ticket-qty-display">{quantity}</span>
          <button
            className="ticket-qty-button"
            type="button"
            onClick={onIncrease}
            disabled={!canIncrease}
            aria-label="Tăng số lượng vé"
          >
            +
          </button>
        </div>
      )}
    </article>
  );
}
