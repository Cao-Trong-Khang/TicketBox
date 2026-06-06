import { Activity, CalendarDays, Gauge, Settings, ShieldCheck, Ticket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type HealthState = {
  service: string;
  status: string;
  timestamp: string;
  environment?: string;
};

type ApiStatus =
  | { state: 'checking' }
  | { state: 'online'; data: HealthState }
  | { state: 'offline'; message: string };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const audienceRoutes = [
  'Concert discovery',
  'Concert detail and seating zones',
  'Checkout and payment handoff',
  'My e-tickets',
];

const organizerRoutes = [
  'Concert management',
  'Ticket type setup',
  'Sales statistics',
  'Artist docs and VIP imports',
];

export function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ state: 'checking' });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Health check returned ${response.status}`);
        }

        return response.json() as Promise<HealthState>;
      })
      .then((data) => setApiStatus({ state: 'online', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Backend health check failed';
        setApiStatus({ state: 'offline', message });
      });

    return () => controller.abort();
  }, []);

  const statusLabel = useMemo(() => {
    if (apiStatus.state === 'checking') {
      return 'Checking API';
    }

    if (apiStatus.state === 'online') {
      return 'Backend online';
    }

    return 'Backend unavailable';
  }, [apiStatus]);

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary">
        <a className="brand" href="/">
          <Ticket size={28} aria-hidden="true" />
          <span>TicketBox</span>
        </a>
        <div className="nav-links">
          <a href="#audience">Audience</a>
          <a href="#organizer">Organizer</a>
          <a href="#status">Status</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Local development foundation</p>
          <h1>TicketBox web shell</h1>
          <p>
            Route-ready starting point for concert browsing, checkout, organizer operations, and
            future RBAC-protected workflows.
          </p>
        </div>
        <div className={`status-panel status-${apiStatus.state}`} id="status">
          <Activity size={24} aria-hidden="true" />
          <div>
            <span>{statusLabel}</span>
            <strong>{API_BASE_URL}</strong>
            {apiStatus.state === 'online' && <small>{apiStatus.data.service}</small>}
            {apiStatus.state === 'offline' && <small>{apiStatus.message}</small>}
          </div>
        </div>
      </section>

      <section className="route-grid" aria-label="Application areas">
        <RouteGroup
          id="audience"
          icon={<CalendarDays aria-hidden="true" />}
          title="Audience area"
          routes={audienceRoutes}
        />
        <RouteGroup
          id="organizer"
          icon={<Settings aria-hidden="true" />}
          title="Organizer admin"
          routes={organizerRoutes}
        />
        <RouteGroup
          id="platform"
          icon={<ShieldCheck aria-hidden="true" />}
          title="Platform hooks"
          routes={['Server-side RBAC', 'Redis caching and limits', 'Kafka async workers', 'PostgreSQL source of truth']}
        />
      </section>

      <section className="readiness-band">
        <Gauge aria-hidden="true" />
        <span>Prepared for the archived TicketBox blueprint without simulating domain authority.</span>
      </section>
    </main>
  );
}

function RouteGroup({
  id,
  icon,
  title,
  routes,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  routes: string[];
}) {
  return (
    <article className="route-card" id={id}>
      <div className="route-title">
        {icon}
        <h2>{title}</h2>
      </div>
      <ul>
        {routes.map((route) => (
          <li key={route}>{route}</li>
        ))}
      </ul>
    </article>
  );
}
