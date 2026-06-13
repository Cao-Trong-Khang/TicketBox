import { AppShell } from '../components/layout/AppShell';
import { AppRouter } from './router';

export function App() {
  return (
    <AppShell>
      <AppRouter />
    </AppShell>
  );
}
