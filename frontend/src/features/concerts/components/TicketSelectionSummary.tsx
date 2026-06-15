import { Button } from '../../../components/ui/Button';
import { formatVnd } from '../api';
import { TicketType } from '../types';

type SelectedItem = {
  ticketType: TicketType;
  quantity: number;
  lineTotal: number;
};

type TicketSelectionSummaryProps = {
  selectedItems: SelectedItem[];
  totalQuantity: number;
  totalAmount: number;
  onContinue: () => void;
};

export function TicketSelectionSummary({
  selectedItems,
  totalQuantity,
  totalAmount,
  onContinue,
}: TicketSelectionSummaryProps) {
  return (
    <section className="ticket-selection-summary" aria-labelledby="summary-title">
      <h2 id="summary-title">CHI TIẾT ĐẶT VÉ</h2>

      {selectedItems.length === 0 ? (
        <p className="concerts-empty">Chưa chọn vé nào</p>
      ) : (
        <>
          <div className="summary-items">
            {selectedItems.map(item => (
              <div key={item.ticketType.id} className="summary-item">
                <div className="summary-item-info">
                  <span className="summary-item-name">{item.ticketType.name}</span>
                  <span className="summary-item-qty">x{item.quantity}</span>
                </div>
                <div className="summary-item-prices">
                  <span className="summary-item-unit-price">{formatVnd(item.ticketType.priceVnd)}</span>
                  <span className="summary-item-line-total">{formatVnd(item.lineTotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="summary-total">
            <div className="summary-total-qty">Tổng: {totalQuantity} vé</div>
            <div className="summary-total-amount">{formatVnd(totalAmount)}</div>
          </div>
        </>
      )}

      <Button
        type="button"
        className="summary-continue-button"
        onClick={onContinue}
        disabled={totalQuantity === 0}
      >
        Tiếp tục đặt vé
      </Button>
    </section>
  );
}
