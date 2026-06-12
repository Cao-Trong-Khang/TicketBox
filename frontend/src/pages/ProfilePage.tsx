import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';

type UserData = {
  id: string;
  email: string;
};

export function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiFetch<UserData>('/auth/me');
        setUser(data);
      } catch (err: any) {
        if (err.status === 401) {
          localStorage.removeItem('accessToken');
          window.dispatchEvent(new Event('storage'));
          navigate('/login');
        } else {
          setError(err.message || 'Failed to fetch profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  if (loading) return <div>Loading profile...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto' }}>
      <h2>Thông tin hồ sơ</h2>
      {user && (
        <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', color: '#333' }}>
          <p><strong>ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {user.email}</p>
        </div>
      )}
    </div>
  );
}
