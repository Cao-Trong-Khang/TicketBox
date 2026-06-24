import { SubmitEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api-client';
import { getAuthProfile, login } from '../api';
import { AuthLayout } from '../../../components/layout/AuthLayout';

const ORGANIZER_ROLE = 'ORGANIZER';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const data = await login({ email, password });
      localStorage.setItem('accessToken', data.accessToken);
      window.dispatchEvent(new Event('ticketbox-auth-changed'));
      try {
        const profile = await getAuthProfile();
        navigate(profile.roles.includes(ORGANIZER_ROLE) ? '/organizer/concerts' : '/concerts');
      } catch {
        navigate('/concerts');
      }
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.status === 401 ? 'Email hoặc mật khẩu không đúng.' : apiError.message || 'Không thể đăng nhập lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="TicketBox"
      title="Đăng nhập"
      description="Tiếp tục vào hệ thống bằng tài khoản đã đăng ký."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <Alert tone="error">{error}</Alert>}

        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <FormField
          label="Mật khẩu"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>

      <p className="auth-switch">
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </p>
    </AuthLayout>
  );
}
