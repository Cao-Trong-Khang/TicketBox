import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Ticket } from 'lucide-react';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem('accessToken')));

  useEffect(() => {
    const syncToken = () => setHasToken(Boolean(localStorage.getItem('accessToken')));

    window.addEventListener('ticketbox-auth-changed', syncToken);
    window.addEventListener('storage', syncToken);

    return () => {
      window.removeEventListener('ticketbox-auth-changed', syncToken);
      window.removeEventListener('storage', syncToken);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
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
          <NavLink to="/organizer/concerts">Kênh organizer</NavLink>
          {!hasToken && <NavLink to="/login">Đăng nhập</NavLink>}
          {!hasToken && <NavLink to="/register">Đăng ký</NavLink>}
          {hasToken && (
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
