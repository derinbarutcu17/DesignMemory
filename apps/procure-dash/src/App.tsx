import { AppShell } from './AppShell';
import { useHashRoute } from './hooks';
import { Contracts } from './routes/Contracts';
import { Overview } from './routes/Overview';
import { Suppliers } from './routes/Suppliers';

export function App() {
  const { route, navigate } = useHashRoute();

  return (
    <AppShell route={route} navigate={navigate}>
      {route === 'suppliers' ? <Suppliers /> : route === 'contracts' ? <Contracts /> : <Overview />}
    </AppShell>
  );
}
