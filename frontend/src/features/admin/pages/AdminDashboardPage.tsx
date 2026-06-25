import { BarChart3, FileText, TicketCheck } from 'lucide-react';

const adminItems = [
  { label: 'Concert Management', icon: TicketCheck },
  { label: 'Revenue Stats', icon: BarChart3 },
  { label: 'AI Artist Bio', icon: FileText },
];

export function AdminDashboardPage() {
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
          return (
            <article className="admin-dashboard-tile" key={item.label}>
              <Icon size={24} aria-hidden="true" />
              <h2>{item.label}</h2>
            </article>
          );
        })}
      </div>
    </section>
  );
}