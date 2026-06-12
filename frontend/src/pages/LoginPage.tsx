import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = await apiFetch<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      localStorage.setItem('accessToken', data.accessToken);
      // Trigger a storage event or re-render if needed, but navigate will unmount
      window.dispatchEvent(new Event('storage'));
      navigate('/profile');
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setError('Email hoặc mật khẩu không đúng');
      } else {
        setError(apiErr.message || 'Lỗi đăng nhập');
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '2rem' }}>
      <h2>Đăng nhập</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Mật khẩu" value={formData.password} onChange={handleChange} required />
        <button type="submit">Đăng nhập</button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
      </p>
    </div>
  );
}
