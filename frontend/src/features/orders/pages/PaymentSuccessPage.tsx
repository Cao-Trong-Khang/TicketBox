import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../../lib/api-client';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const momoResultCode = searchParams.get('resultCode');
  
  const infoText = searchParams.get('vnp_OrderInfo') || searchParams.get('orderInfo') || '';
  const uuidMatch = infoText.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  const extractedOrderId = uuidMatch ? uuidMatch[0] : null;

  const orderId = extractedOrderId || searchParams.get('orderId') || searchParams.get('orderCode') || searchParams.get('vnp_TxnRef') || 'N/A';

  const isSuccess = vnpResponseCode === '00' || momoResultCode === '0' || searchParams.get('status') === 'success';

  useEffect(() => {
    if (isSuccess && orderId !== 'N/A') {
      const provider = vnpResponseCode ? 'vnpay' : 'momo';
      const transactionId = searchParams.get('vnp_TransactionNo') || searchParams.get('transId') || undefined;
      apiFetch('/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({ orderId, provider, transactionId }),
      }).catch((err) => {
        console.error('Failed to confirm payment on backend:', err);
      });
    }
  }, [isSuccess, orderId, vnpResponseCode, searchParams]);

  return (
    <section className="payment-success-page" style={{ padding: '60px 20px', minHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="payment-success-container" style={{ maxWidth: '480px', width: '100%', background: 'white', padding: '40px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        {isSuccess ? (
          <>
            <div style={{ display: 'inline-flex', alignSelf: 'center', padding: '16px', background: '#ecfdf5', borderRadius: '50%', marginBottom: '24px' }}>
              <CheckCircle2 color="#059669" size={48} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#065f46', marginBottom: '12px' }}>Thanh Toán Thành Công!</h1>
            <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
              Cảm ơn bạn đã lựa chọn TicketBox! Vé xem concert của bạn đã được xuất và sẵn sàng sử dụng.
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'inline-flex', alignSelf: 'center', padding: '16px', background: '#fef2f2', borderRadius: '50%', marginBottom: '24px' }}>
              <AlertCircle color="#dc2626" size={48} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#991b1b', marginBottom: '12px' }}>Thanh Toán Thất Bại</h1>
            <p style={{ color: '#4b5563', fontSize: '15px', marginBottom: '24px', lineHeight: '1.5' }}>
              Đã có lỗi xảy ra trong quá trình xử lý giao dịch. Vui lòng thử lại hoặc liên hệ hỗ trợ.
            </p>
          </>
        )}

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '32px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Mã giao dịch:</span>
            <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{orderId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '14px' }}>Trạng thái:</span>
            <span style={{ fontWeight: '700', color: isSuccess ? '#059669' : '#dc2626', fontSize: '14px' }}>
              {isSuccess ? 'ĐÃ THANH TOÁN' : 'THẤT BẠI'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button type="button" onClick={() => navigate('/orders')} style={{ width: '100%', padding: '12px', fontWeight: '600' }}>
            Xem vé của tôi
          </Button>
          <Button type="button" className="btn-ghost" onClick={() => navigate('/concerts')} style={{ width: '100%', padding: '12px', fontWeight: '500', color: '#4b5563' }}>
            Về danh sách sự kiện
          </Button>
        </div>
      </div>
    </section>
  );
}
