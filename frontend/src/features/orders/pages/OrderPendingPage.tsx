import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { CreateOrderResponse } from '../types';
import { createPayment, getPaymentProviders, ProviderAvailability } from '../../../api/payment';

export function OrderPendingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order as CreateOrderResponse | undefined;

  const [provider, setProvider] = useState<'vnpay' | 'momo' |null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ProviderAvailability[]>([]);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);

  useEffect(() => {
    getPaymentProviders()
      .then(setAvailability)
      .catch(() => setPayError('Không thể kiểm tra cổng thanh toán. Vui lòng thử lại.'))
      .finally(() => setAvailabilityLoaded(true));
  }, []);

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

  const handlePay = async () => {
    if (!provider) {
    setPayError('Vui lòng chọn một phương thức thanh toán trước khi tiếp tục.');
    return;
  }
    setIsPaying(true);
    setPayError(null);
    try {
      const storageKey = `ticketbox:payment-key:${order.orderId}:${provider}`;
      const idempotencyKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
      const response = await createPayment({ provider, orderId: order.orderId, idempotencyKey });
      sessionStorage.setItem('ticketbox:last-payment-id', response.paymentId);
      if (!response.paymentUrl) throw new Error('Thanh toan dang cho xu ly. Vui long kiem tra lai sau.');
      window.location.href = response.paymentUrl;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Có lỗi xảy ra trong quá trình thanh toán.');
      setIsPaying(false);
    }
  };

  const formattedAmount = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(order.totalAmountVnd);

  const isUnavailable = (name: 'vnpay' | 'momo') =>
    availability.some((item) => item.provider === name && item.status !== 'available');
  const unavailableProviders = availability.filter((item) => item.status !== 'available');
  const selectedProviderUnavailable = provider ? isUnavailable(provider) : false;

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
      <div className="order-pending-container" style={{ maxWidth: '600px', margin: '40px auto', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)', border: '1px solid #f1f5f9' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '20px', color: '#0f766e', textAlign: 'center' }}>Đơn hàng của bạn</h1>
        
        <div className="order-details" style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div className="order-detail-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="order-detail-label" style={{ color: '#64748b' }}>Mã đơn hàng:</span>
            <span className="order-detail-value" style={{ fontWeight: '600', color: '#1e293b' }}>{order.orderCode}</span>
          </div>
          <div className="order-detail-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="order-detail-label" style={{ color: '#64748b' }}>Trạng thái:</span>
            <span className="order-detail-value" style={{ fontWeight: 'bold', color: '#d97706' }}>{order.status}</span>
          </div>
          <div className="order-detail-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <span className="order-detail-label" style={{ color: '#64748b' }}>Tổng tiền:</span>
            <span className="order-detail-value" style={{ fontWeight: '700', color: '#0f766e' }}>{formattedAmount}</span>
          </div>
          <div className="order-detail-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
            <span className="order-detail-label" style={{ color: '#64748b' }}>Hết hạn lúc:</span>
            <span className="order-detail-value" style={{ color: '#ef4444', fontWeight: '500' }}>{formattedExpiry}</span>
          </div>
        </div>

        {order.status === 'PENDING' && (
          <div className="payment-method-selector" style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#334155' }}>Chọn phương thức thanh toán:</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                border: `2px solid ${provider === 'vnpay' ? '#0f766e' : '#cbd5e1'}`,
                borderRadius: '8px',
                background: provider === 'vnpay' ? '#f0fdfa' : '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                color: provider === 'vnpay' ? '#0f766e' : '#475569',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="radio"
                  name="paymentProvider"
                  value="vnpay"
                  checked={provider === 'vnpay'}
                  onChange={() => setProvider('vnpay')}
                  disabled={availability.some((item) => item.provider === 'vnpay' && item.status !== 'available')}
                  style={{ marginRight: '8px' }}
                />
                VNPay
              </label>

              <label style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                border: `2px solid ${provider === 'momo' ? '#0f766e' : '#cbd5e1'}`,
                borderRadius: '8px',
                background: provider === 'momo' ? '#f0fdfa' : '#fff',
                cursor: 'pointer',
                fontWeight: '600',
                color: provider === 'momo' ? '#0f766e' : '#475569',
                transition: 'all 0.15s ease'
              }}>
                <input
                  type="radio"
                  name="paymentProvider"
                  value="momo"
                  checked={provider === 'momo'}
                  onChange={() => setProvider('momo')}
                  disabled={availability.some((item) => item.provider === 'momo' && item.status !== 'available')}
                  style={{ marginRight: '8px' }}
                />
                MoMo
              </label>
            </div>
          </div>
        )}

        {availabilityLoaded && unavailableProviders.length > 0 && (
          <div role="status" style={{ padding: '12px', marginBottom: '16px', borderRadius: '8px', background: '#fff7ed', color: '#9a3412' }}>
            {unavailableProviders.length === 2
              ? 'Cả hai cổng thanh toán đang tạm gián đoạn. Đơn hàng vẫn được giữ; vui lòng thử lại sau.'
              : unavailableProviders[0].provider.toUpperCase() + ' đang tạm gián đoạn. Bạn có thể chọn cổng thanh toán còn lại.'}
            {unavailableProviders[0].retryAfterSeconds
              ? ' Thử lại sau khoảng ' + unavailableProviders[0].retryAfterSeconds + ' giây.'
              : ''}
          </div>
        )}

        {payError && (
          <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '16px', textAlign: 'center', fontWeight: '500' }}>{payError}</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {order.status === 'PENDING' && (
            <Button
              type="button"
              onClick={handlePay}
              disabled={isPaying || !provider || selectedProviderUnavailable}
              style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600' }}
            >
              {isPaying ? 'Đang chuyển đến cổng thanh toán...' : 'Thanh toán ngay'}
            </Button>
          )}
          <Button
            type="button"
            onClick={() => navigate('/concerts')}
            className="order-back-button"
            style={{ width: '100%', padding: '12px', fontWeight: '600', color: '#ffffff' }}
          >
            Quay lại danh sách sự kiện
          </Button>
        </div>
      </div>
    </section>
  );
}
