import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../../components/layout/AuthLayout';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { ApiError } from '../../../lib/api-client';
import { register } from '../api';

const LOGIN_REDIRECT_DELAY_MS = 900;

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email.trim()) {
      setError('Vui lòng nhập tên hiển thị và email.');
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ fullName, email, password });
      setSuccess('Đăng ký thành công. Bạn sẽ được chuyển sang màn hình đăng nhập.');
      window.setTimeout(() => navigate('/login'), LOGIN_REDIRECT_DELAY_MS);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.status === 409 ? 'Email này đã được sử dụng.' : apiError.message || 'Không thể đăng ký lúc này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Tạo tài khoản"
      title="Đăng ký"
      description="Tạo tài khoản TicketBox để dùng cho các luồng đặt vé và quản lý sau này."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <FormField
          label="Tên hiển thị"
          name="fullName"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <FormField
          label="Xác nhận mật khẩu"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký'}
        </Button>
      </form>

      <p className="auth-switch">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </AuthLayout>
  );
}
