export { App } from './app/App';
import { Activity, Bell, CalendarDays, CreditCard, Gauge, Settings, ShieldCheck, Ticket } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NotificationForm } from './components/NotificationForm';
import { PaymentForm } from './components/PaymentForm';

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
  const [activePanel, setActivePanel] = useState<'payment' | 'notification' | null>(null);

  // Xử lý returnUrl sau khi thanh toán VNPAY/MoMo xong
  if (window.location.pathname === '/payments/success') {
    const params = new URLSearchParams(window.location.search);
    const vnpResponseCode = params.get('vnp_ResponseCode');
    const momoResultCode = params.get('resultCode');
    const orderId = params.get('vnp_TxnRef') || params.get('orderId');
    
    const isSuccess = vnpResponseCode === '00' || momoResultCode === '0';
    
    return (
      <main className="app-shell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px' }}>
        <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px', color: 'black', width: '100%', maxWidth: '400px' }}>
          {isSuccess ? (
            <h2 style={{ color: '#16a34a', marginBottom: '16px' }}>Thanh toán thành công! ✓</h2>
          ) : (
            <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Thanh toán thất bại ✗</h2>
          )}
          <p>Mã đơn hàng: <strong>{orderId}</strong></p>
          <a href="/" className="btn btn-primary" style={{ display: 'inline-block', marginTop: '24px' }}>Về trang chủ</a>
        </div>
      </main>
    );
  }

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
          <button
            className={`nav-tab${activePanel === 'payment' ? ' nav-tab-active' : ''}`}
            onClick={() => setActivePanel(activePanel === 'payment' ? null : 'payment')}
          >
            <CreditCard size={15} aria-hidden="true" />
            Payment
          </button>
          <button
            className={`nav-tab${activePanel === 'notification' ? ' nav-tab-active' : ''}`}
            onClick={() => setActivePanel(activePanel === 'notification' ? null : 'notification')}
          >
            <Bell size={15} aria-hidden="true" />
            Notification
          </button>
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

      {activePanel === 'payment' && (
        <section className="api-panel" aria-label="Payment">
          <div className="api-panel-inner">
            <div className="api-panel-header">
              <CreditCard size={22} aria-hidden="true" />
              <div>
                <h2>Create payment</h2>
                <p>Calls <code>POST /payments</code> on the backend — choose VNPay or MoMo.</p>
              </div>
            </div>
            <PaymentForm />
          </div>
        </section>
      )}

      {activePanel === 'notification' && (
        <section className="api-panel" aria-label="Notification">
          <div className="api-panel-inner">
            <div className="api-panel-header">
              <Bell size={22} aria-hidden="true" />
              <div>
                <h2>Send notification</h2>
                <p>Calls <code>POST /notifications</code> — email and/or push channels.</p>
              </div>
            </div>
            <NotificationForm />
          </div>
        </section>
      )}

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
