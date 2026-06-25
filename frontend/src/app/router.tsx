import { Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ArtistBioAdminPage } from '../features/artist-bio/pages/ArtistBioAdminPage';
import { ConcertDetailPage } from '../features/concerts/pages/ConcertDetailPage';
import { ConcertsListPage } from '../features/concerts/pages/ConcertsListPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { OrderPendingPage } from '../features/orders/pages/OrderPendingPage';
import { AdminDashboardPage } from '../features/admin/pages/AdminDashboardPage';
import { userHasRole } from '../features/auth/session';

function RequireOrganizer({ children }: { children: ReactNode }) {
  return userHasRole('ORGANIZER') ? <>{children}</> : <Navigate to="/concerts" replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/concerts" replace />} />
      <Route path="/concerts" element={<ConcertsListPage />} />
      <Route path="/concerts/:id" element={<ConcertDetailPage />} />
      <Route path="/orders/:orderId" element={<OrderPendingPage />} />
      <Route
        path="/admin/dashboard"
        element={
          <RequireOrganizer>
            <AdminDashboardPage />
          </RequireOrganizer>
        }
      />
      <Route
        path="/admin/concerts/:concertId/artist-bio"
        element={
          <RequireOrganizer>
            <ArtistBioAdminPage />
          </RequireOrganizer>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<Navigate to="/concerts" replace />} />
      <Route path="*" element={<Navigate to="/concerts" replace />} />
    </Routes>
  );
}