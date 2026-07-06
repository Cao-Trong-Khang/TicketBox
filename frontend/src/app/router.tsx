import { Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ArtistBioAdminPage } from '../features/artist-bio/pages/ArtistBioAdminPage';
import { ConcertDetailPage } from '../features/concerts/pages/ConcertDetailPage';
import { ConcertsListPage } from '../features/concerts/pages/ConcertsListPage';
import { OrganizerConcertCreatePage } from '../features/organizer-concerts/pages/OrganizerConcertCreatePage';
import { OrganizerConcertDashboardPage } from '../features/organizer-concerts/pages/OrganizerConcertDashboardPage';
import { OrganizerConcertEditPage } from '../features/organizer-concerts/pages/OrganizerConcertEditPage';
import { OrganizerConcertRevenuePage } from '../features/organizer-concerts/pages/OrganizerConcertRevenuePage';
import { OrganizerTicketTypeManagementPage } from '../features/organizer-concerts/pages/OrganizerTicketTypeManagementPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { OrderPendingPage } from '../features/orders/pages/OrderPendingPage';
import { getPostLoginRedirect, getStoredRoles, isAuthenticated, userHasRole } from '../features/auth/session';

function RequireAuth({ children }: { children: ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  return isAuthenticated() ? <Navigate to={getPostLoginRedirect(getStoredRoles())} replace /> : <>{children}</>;
}

function RequireOrganizer({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return userHasRole('ORGANIZER') ? <>{children}</> : <Navigate to="/concerts" replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfAuthenticated><Navigate to="/login" replace /></RedirectIfAuthenticated>} />
      <Route path="/concerts" element={<RequireAuth><ConcertsListPage /></RequireAuth>} />
      <Route path="/concerts/:id" element={<RequireAuth><ConcertDetailPage /></RequireAuth>} />
      <Route
        path="/organizer/concerts"
        element={
          <RequireOrganizer>
            <OrganizerConcertDashboardPage />
          </RequireOrganizer>
        }
      />
      <Route
        path="/organizer/concerts/new"
        element={
          <RequireOrganizer>
            <OrganizerConcertCreatePage />
          </RequireOrganizer>
        }
      />
      <Route
        path="/organizer/concerts/:id/edit"
        element={
          <RequireOrganizer>
            <OrganizerConcertEditPage />
          </RequireOrganizer>
        }
      />
      <Route
        path="/organizer/concerts/:id/revenue"
        element={
          <RequireOrganizer>
            <OrganizerConcertRevenuePage />
          </RequireOrganizer>
        }
      />
      <Route
        path="/organizer/concerts/:concertId/ticket-types"
        element={
          <RequireOrganizer>
            <OrganizerTicketTypeManagementPage />
          </RequireOrganizer>
        }
      />
      <Route path="/orders/:orderId" element={<RequireAuth><OrderPendingPage /></RequireAuth>} />
      <Route
        path="/admin/concerts/:concertId/artist-bio"
        element={
          <RequireOrganizer>
            <ArtistBioAdminPage />
          </RequireOrganizer>
        }
      />
      <Route path="/login" element={<RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated>} />
      <Route path="/register" element={<RedirectIfAuthenticated><RegisterPage /></RedirectIfAuthenticated>} />
      <Route path="/home" element={<RedirectIfAuthenticated><Navigate to="/login" replace /></RedirectIfAuthenticated>} />
      <Route path="*" element={<Navigate to={isAuthenticated() ? getPostLoginRedirect(getStoredRoles()) : '/login'} replace />} />
    </Routes>
  );
}
