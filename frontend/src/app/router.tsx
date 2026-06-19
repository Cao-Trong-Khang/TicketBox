import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { CheckInPage } from '../pages/CheckInPage';
import { ConcertsPage } from '../pages/ConcertsPage';
import { HomePage } from '../pages/HomePage';
import { MyTicketsPage } from '../pages/MyTicketsPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route
        path="/concerts"
        element={
          <ProtectedRoute>
            <ConcertsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tickets/my"
        element={
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="ORGANIZER">
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute role="ORGANIZER">
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin/*"
        element={
          <ProtectedRoute role="GATE_STAFF">
            <CheckInPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
