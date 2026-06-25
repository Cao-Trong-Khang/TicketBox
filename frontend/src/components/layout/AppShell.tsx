import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Ticket } from 'lucide-react';
import { userHasRole } from '../../features/auth/session';

type AppShellProps = {
  children: ReactNode;
};

function readAuthState() {
  return {
    hasToken: Boolean(localStorage.getItem('accessToken')),
    isOrganizer: userHasRole('ORGANIZER'),
  };
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState(readAuthState);

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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRoles');
    window.dispatchEvent(new Event('ticketbox-auth-changed'));
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
          <NavLink to="/concerts">Concerts</NavLink>
          {authState.isOrganizer && <NavLink to="/admin/dashboard">Admin</NavLink>}
          {!authState.hasToken && <NavLink to="/login">Đăng nhập</NavLink>}
          {!authState.hasToken && <NavLink to="/register">Đăng ký</NavLink>}
          {authState.hasToken && (
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
