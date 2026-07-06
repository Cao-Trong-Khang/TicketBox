import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { resolveAssetUrl } from '../../../lib/assets';
import type { ApiError } from '../../../lib/api-client';
import { orderHistoryDataSource } from '../history-api';
import type { OrderHistoryDataSource } from '../history-api';
import {
  formatOrderHistoryAmount,
  formatOrderHistoryDate,
  formatOrderHistoryTicketSummary,
  formatOrderHistoryVenue,
  getOrderHistoryStatusLabel,
} from '../history-formatters';
import type { OrderHistoryItem } from '../history-types';

type OrderHistoryPageProps = { dataSource?: OrderHistoryDataSource };

export function OrderHistoryPage({ dataSource = orderHistoryDataSource }: OrderHistoryPageProps) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setOrders(await dataSource.listOrders());
    } catch (err: unknown) {
      setError(toApiError(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    dataSource.listOrders()
      .then((data) => { if (isActive) setOrders(data); })
      .catch((err: unknown) => { if (isActive) setError(toApiError(err)); })
      .finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, [dataSource]);

  return (
    <section className="order-history-page" aria-labelledby="order-history-title">
      <div className="order-history-container">
        <header className="order-history-header">
          <p className="eyebrow">TicketBox</p>
          <h1 id="order-history-title">Lịch sử đơn hàng</h1>
          <p>Theo dõi các đơn đã tạo, trạng thái thanh toán và thông tin concert của bạn.</p>
        </header>

        {isLoading && <p className="order-history-loading" role="status">Đang tải lịch sử đơn hàng...</p>}
        {!isLoading && error && (
          <div className="order-history-error">
            <Alert tone="error">{formatError(error)}</Alert>
            <Button type="button" className="alert-action" onClick={fetchOrders}>Thử lại</Button>
          </div>
        )}
        {!isLoading && !error && orders.length === 0 && (
          <div className="order-history-empty" role="status">
            <p>Chưa có đơn hàng nào.</p>
            <Button type="button" onClick={() => navigate('/concerts')}>Khám phá concert</Button>
          </div>
        )}
        {!isLoading && !error && orders.length > 0 && (
          <div className="order-history-grid">
            {orders.map((order) => <OrderHistoryCard key={order.orderId} order={order} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function OrderHistoryCard({ order }: { order: OrderHistoryItem }) {
  const [hasImageError, setHasImageError] = useState(false);
  const bannerUrl = resolveAssetUrl(order.bannerUrl);
  const showBanner = Boolean(bannerUrl) && !hasImageError;

  return (
    <article className="order-history-card">
      {showBanner ? (
        <img className="order-history-banner" src={bannerUrl ?? undefined} alt={order.concertTitle} onError={() => setHasImageError(true)} />
      ) : (
        <div className="order-history-banner order-history-banner-empty" aria-label="Chưa có hình ảnh">Chưa có hình ảnh</div>
      )}
      <div className="order-history-content">
        <div className="order-history-topline">
          <div>
            <p className="order-history-code">Mã đơn {order.orderCode}</p>
            <h2 className="order-history-title">{order.concertTitle}</h2>
          </div>
          <span className={`order-history-status order-history-status-${order.status}`}>{getOrderHistoryStatusLabel(order.status)}</span>
        </div>
        <div className="order-history-meta">
          <p><span className="order-history-label">Ngày tạo:</span><span>{formatOrderHistoryDate(order.createdAt)}</span></p>
          <p><span className="order-history-label">Thời gian diễn:</span><span>{formatOrderHistoryDate(order.performanceStartAt)}</span></p>
          <p><span className="order-history-label">Địa điểm:</span><span>{formatOrderHistoryVenue(order)}</span></p>
          <p><span className="order-history-label">Vé:</span><span>{formatOrderHistoryTicketSummary(order.tickets)}</span></p>
        </div>
        <div className="order-history-footer">
          <strong>{formatOrderHistoryAmount(order.totalAmountVnd)}</strong>
          <span>{getStatusHint(order.status)}</span>
        </div>
      </div>
    </article>
  );
}

function getStatusHint(status: OrderHistoryItem['status']): string {
  return {
    PENDING: 'Đang chờ xử lý thanh toán',
    PAID: 'Đơn đã hoàn tất thanh toán',
    FAILED: 'Thanh toán chưa thành công',
    EXPIRED: 'Đơn đã quá thời gian thanh toán',
    CANCELLED: 'Đơn đã được hủy',
  }[status];
}

function formatError(error: ApiError): string {
  if (error.status === 404) return 'Lịch sử đơn hàng chưa sẵn sàng trên backend. Vui lòng thử lại sau.';
  return error.message || 'Không thể tải lịch sử đơn hàng.';
}

function toApiError(error: unknown): ApiError {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = error as { status?: unknown; message?: unknown; data?: unknown };
    return {
      status: typeof value.status === 'number' ? value.status : 0,
      message: typeof value.message === 'string' ? value.message : 'Không thể tải lịch sử đơn hàng.',
      data: value.data,
    };
  }
  return { status: 0, message: 'Không thể tải lịch sử đơn hàng.' };
}