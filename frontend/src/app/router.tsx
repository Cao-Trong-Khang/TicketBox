import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ConcertsListPage } from '../features/concerts/pages/ConcertsListPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/concerts" replace />} />
      <Route path="/concerts" element={<ConcertsListPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<Navigate to="/concerts" replace />} />
      <Route path="*" element={<Navigate to="/concerts" replace />} />
    </Routes>
  );
}
