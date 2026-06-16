import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { CreateOrderResponse } from '../types';

export function OrderPendingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order as CreateOrderResponse | undefined;

  if (!order) {
    return (
      <section className="order-pending-page">
        <div className="order-pending-container">
          <h1>Đơn hàng của bạn</h1>
          <p className="order-empty-message">Không có dữ liệu đơn hàng. Vui lòng quay lại danh sách sự kiện.</p>
          <Button type="button" onClick={() => navigate('/concerts')}>
            Quay lại danh sách sự kiện
          </Button>
        </div>
      </section>
    );
  }

  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(order.totalAmountVnd);

  const expiresAtDate = new Date(order.expiresAt);
  const formattedExpiry = new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(expiresAtDate);

  return (
    <section className="order-pending-page">
      <div className="order-pending-container">
        <h1>Đơn hàng của bạn</h1>
        <div className="order-details">
          <div className="order-detail-item">
            <span className="order-detail-label">Mã đơn hàng:</span>
            <span className="order-detail-value">{order.orderCode}</span>
          </div>
          <div className="order-detail-item">
            <span className="order-detail-label">Trạng thái:</span>
            <span className="order-detail-value">{order.status}</span>
          </div>
          <div className="order-detail-item">
            <span className="order-detail-label">Tổng tiền:</span>
            <span className="order-detail-value">{formattedAmount}</span>
          </div>
          <div className="order-detail-item">
            <span className="order-detail-label">Hết hạn lúc:</span>
            <span className="order-detail-value">{formattedExpiry}</span>
          </div>
        </div>
        <Button type="button" onClick={() => navigate('/concerts')} className="order-back-button">
          Quay lại danh sách sự kiện
        </Button>
      </div>
    </section>
  );
}
