import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Ticket } from 'lucide-react';
import { clearSession, isAuthenticated, userHasRole } from '../../features/auth/session';

type AppShellProps = {
  children: ReactNode;
};

function readAuthState() {
  return {
    hasToken: isAuthenticated(),
  };
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState(readAuthState);
  const isOrganizer = authState.hasToken && userHasRole('ORGANIZER');

  useEffect(() => {
    const syncToken = () => setAuthState(readAuthState());

    window.addEventListener('ticketbox-auth-changed', syncToken);
    window.addEventListener('storage', syncToken);

    return () => {
      window.removeEventListener('ticketbox-auth-changed', syncToken);
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  const handleLogout = () => {
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
          {authState.hasToken && (
            <>
              <NavLink
                className="nav-link"
                to={isOrganizer ? '/organizer/concerts' : '/concerts'}
                end
              >
                <span>Sự kiện</span>
              </NavLink>
              <NavLink className="nav-link" to="/orders" end>
                <span>Đơn hàng của tôi</span>
              </NavLink>

              <button
                className="nav-button"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={18} aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </>
          )}
        </nav>
      </header>

      <div className="page-frame">{children}</div>
    </main>
  );
}
