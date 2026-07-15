import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { getPaymentStatus, PaymentResponse } from '../../../api/payment';

export function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentId = searchParams.get('paymentId') ?? sessionStorage.getItem('ticketbox:last-payment-id');
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(() => paymentId ? null : 'Không tìm thấy mã thanh toán.');

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    const poll = async () => {
      try {
        const value = await getPaymentStatus(paymentId);
        if (!active) return;
        setPayment(value);
        if (['initiated', 'pending', 'timeout'].includes(value.status)) setTimeout(poll, 2000);
      } catch { if (active) setError('Không thể kiểm tra trạng thái thanh toán.'); }
    };
    void poll();
    return () => { active = false; };
  }, [paymentId]);

  const success = payment?.status === 'success' && payment.orderStatus === 'PAID';
  const pending = !error && (!payment || ['initiated', 'pending', 'timeout'].includes(payment.status));
  const review = payment?.status === 'requires_review';
  const title = success ? 'Thanh toán thành công' : pending ? 'Đang xác minh thanh toán' : review ? 'Thanh toán cần kiểm tra' : 'Thanh toán thất bại';
  const message = success ? 'Vé của bạn đã được phát hành.' : pending ? 'Hệ thống đang đợi kết quả xác thực từ cổng thanh toán.' : review ? 'Giao dịch đến muộn và đang được kiểm tra. Hệ thống chưa phát hành vé.' : (error ?? 'Giao dịch không thành công. Vui lòng thử lại.');

  return <section style={{ padding: '60px 20px', minHeight: '60vh', display: 'flex', justifyContent: 'center' }}>
    <div style={{ maxWidth: 480, width: '100%', background: 'white', padding: 40, borderRadius: 12, textAlign: 'center' }}>
      {success ? <CheckCircle2 color="#059669" size={48} /> : <AlertCircle color={pending ? '#d97706' : '#dc2626'} size={48} />}
      <h1>{title}</h1><p>{message}</p>
      <p>Mã thanh toán: {paymentId ?? 'N/A'}</p>
      <Button type="button" onClick={() => navigate('/orders')} style={{ width: '100%' }}>Xem đơn hàng của tôi</Button>
      <Button type="button" onClick={() => navigate('/concerts')} style={{ width: '100%', marginTop: 12 }}>Về danh sách sự kiện</Button>
    </div>
  </section>;
}
