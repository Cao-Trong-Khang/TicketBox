import { ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Ticket } from 'lucide-react';
import { logout } from '../../features/auth/api';
import { clearSession, getRefreshToken, getStoredUser } from '../../features/auth/session';
import { UserProfile } from '../../features/auth/types';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser());

  useEffect(() => {
    const syncUser = () => setUser(getStoredUser());

    window.addEventListener('ticketbox-auth-changed', syncUser);
    window.addEventListener('storage', syncUser);

    return () => {
      window.removeEventListener('ticketbox-auth-changed', syncUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  const handleLogout = async () => {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      try {
        await logout(refreshToken);
      } catch {
        // Local session cleanup still happens if the server token is already invalid.
      }
    }

    clearSession();
    navigate('/login');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="TicketBox home">
          <Ticket size={28} aria-hidden="true" />
          <span>TicketBox</span>
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {user?.roles.includes('ORGANIZER') && (
            <>
              <Link to="/admin/dashboard">Dashboard</Link>
              <Link to="/admin/concerts">Concert Management</Link>
              <Link to="/admin/revenue">Revenue Stats</Link>
              <Link to="/admin/vip-import">VIP CSV Import</Link>
              <Link to="/admin/ai-artist-bio">AI Artist Bio</Link>
            </>
          )}
          {user?.roles.includes('GATE_STAFF') && (
            <>
              <Link to="/checkin">QR Scanner</Link>
              <Link to="/checkin/vip-guests">VIP Guest List</Link>
              <Link to="/checkin/offline-log">Offline Scan Log</Link>
            </>
          )}
          {user?.roles.includes('AUDIENCE') && <Link to="/tickets/my">My Tickets</Link>}
          {user && (
            <button className="nav-button" type="button" onClick={handleLogout}>
              <LogOut size={18} aria-hidden="true" />
              <span>Đăng xuất</span>
            </button>
          )}
        </nav>
      </header>

      <div className="page-frame">{children}</div>
    </main>
  );
}
