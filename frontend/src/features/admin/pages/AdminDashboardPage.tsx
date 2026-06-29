import { BarChart3, FileText, TicketCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const adminItems = [
  { label: 'Concert Management', icon: TicketCheck, href: '/organizer/concerts' },
  { label: 'Revenue Stats', icon: BarChart3 },
  { label: 'AI Artist Bio', icon: FileText },
];

export function AdminDashboardPage() {
  const navigate = useNavigate();

  return (
    <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
      <header>
        <p className="eyebrow">Organizer</p>
        <h1 id="admin-dashboard-title">Admin Dashboard</h1>
        <p>Manage concert operations, revenue review, and organizer tools.</p>
      </header>

      <div className="admin-dashboard-grid">
        {adminItems.map((item) => {
          const Icon = item.icon;
          const isInteractive = Boolean(item.href);

          return (
            <article
              className={`admin-dashboard-tile${isInteractive ? ' admin-dashboard-tile--interactive' : ''}`}
              key={item.label}
              onClick={() => {
                if (item.href) {
                  navigate(item.href);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (item.href) {
                    navigate(item.href);
                  }
                }
              }}
              role={isInteractive ? 'button' : undefined}
              tabIndex={isInteractive ? 0 : undefined}
            >
              <Icon size={24} aria-hidden="true" />
              <h2>{item.label}</h2>
            </article>
          );
        })}
      </div>
    </section>
  );
}
