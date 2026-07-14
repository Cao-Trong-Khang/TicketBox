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
  const [error, setError] = useState<string | null>(() => paymentId ? null : 'Khong tim thay ma thanh toan.');

  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    const poll = async () => {
      try {
        const value = await getPaymentStatus(paymentId);
        if (!active) return;
        setPayment(value);
        if (['initiated', 'pending', 'timeout'].includes(value.status)) setTimeout(poll, 2000);
      } catch { if (active) setError('Khong the kiem tra trang thai thanh toan.'); }
    };
    void poll();
    return () => { active = false; };
  }, [paymentId]);

  const success = payment?.status === 'success' && payment.orderStatus === 'PAID';
  const pending = !error && (!payment || ['initiated', 'pending', 'timeout'].includes(payment.status));
  const review = payment?.status === 'requires_review';
  const title = success ? 'Thanh toan thanh cong' : pending ? 'Dang xac minh thanh toan' : review ? 'Thanh toan can kiem tra' : 'Thanh toan that bai';
  const message = success ? 'Ve cua ban da duoc phat hanh.' : pending ? 'He thong dang doi ket qua xac thuc tu cong thanh toan.' : review ? 'Giao dich den muon va dang duoc kiem tra. He thong chua phat hanh ve.' : (error ?? 'Giao dich khong thanh cong. Vui long thu lai.');

  return <section style={{ padding: '60px 20px', minHeight: '60vh', display: 'flex', justifyContent: 'center' }}>
    <div style={{ maxWidth: 480, width: '100%', background: 'white', padding: 40, borderRadius: 12, textAlign: 'center' }}>
      {success ? <CheckCircle2 color="#059669" size={48} /> : <AlertCircle color={pending ? '#d97706' : '#dc2626'} size={48} />}
      <h1>{title}</h1><p>{message}</p>
      <p>Ma thanh toan: {paymentId ?? 'N/A'}</p>
      <Button type="button" onClick={() => navigate('/orders')} style={{ width: '100%' }}>Xem don hang cua toi</Button>
      <Button type="button" onClick={() => navigate('/concerts')} style={{ width: '100%', marginTop: 12 }}>Ve danh sach su kien</Button>
    </div>
  </section>;
}
