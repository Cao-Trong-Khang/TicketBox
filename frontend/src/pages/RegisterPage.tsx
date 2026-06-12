import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.displayName.trim() || !formData.email.trim()) {
      return setError('Tên hiển thị và email không được để trống');
    }
    if (formData.password.length < 8) {
      return setError('Mật khẩu phải có ít nhất 8 ký tự');
    }
    if (formData.password !== formData.confirmPassword) {
      return setError('Mật khẩu xác nhận không khớp');
    }

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: formData.displayName,
          email: formData.email,
          password: formData.password,
        }),
      });
      setSuccess('Đăng ký thành công, vui lòng đăng nhập');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setError('Email đã tồn tại');
      } else {
        setError(apiErr.message || 'Lỗi đăng ký');
      }
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '2rem' }}>
      <h2>Đăng ký tài khoản</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input name="displayName" type="text" placeholder="Tên hiển thị" value={formData.displayName} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Mật khẩu" value={formData.password} onChange={handleChange} required />
        <input name="confirmPassword" type="password" placeholder="Xác nhận mật khẩu" value={formData.confirmPassword} onChange={handleChange} required />
        <button type="submit">Đăng ký</button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
      </p>
    </div>
  );
}
