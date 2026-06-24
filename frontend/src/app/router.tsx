import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { ConcertDetailPage } from '../features/concerts/pages/ConcertDetailPage';
import { ConcertsListPage } from '../features/concerts/pages/ConcertsListPage';
import { OrganizerConcertCreatePage } from '../features/organizer-concerts/pages/OrganizerConcertCreatePage';
import { OrganizerConcertDashboardPage } from '../features/organizer-concerts/pages/OrganizerConcertDashboardPage';
import { OrganizerConcertEditPage } from '../features/organizer-concerts/pages/OrganizerConcertEditPage';
import { OrganizerTicketTypeManagementPage } from '../features/organizer-concerts/pages/OrganizerTicketTypeManagementPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { OrderPendingPage } from '../features/orders/pages/OrderPendingPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/concerts" replace />} />
      <Route path="/concerts" element={<ConcertsListPage />} />
      <Route path="/concerts/:id" element={<ConcertDetailPage />} />
      <Route path="/organizer/concerts" element={<OrganizerConcertDashboardPage />} />
      <Route path="/organizer/concerts/new" element={<OrganizerConcertCreatePage />} />
      <Route path="/organizer/concerts/:id/edit" element={<OrganizerConcertEditPage />} />
      <Route
        path="/organizer/concerts/:concertId/ticket-types"
        element={<OrganizerTicketTypeManagementPage />}
      />
      <Route path="/orders/:orderId" element={<OrderPendingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<Navigate to="/concerts" replace />} />
      <Route path="*" element={<Navigate to="/concerts" replace />} />
    </Routes>
  );
}
