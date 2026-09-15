import { useEffect, useState } from 'react';

export type DemoState = 'ready' | 'loading' | 'empty' | 'error';

export function useDemoState(): DemoState {
  const [state] = useState<DemoState>(() => {
    const raw = new URLSearchParams(window.location.search).get('state');
    if (raw === 'loading' || raw === 'empty' || raw === 'error') {
      return raw;
    }
    return 'ready';
  });
  return state;
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\/?/, '') || 'overview');

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.replace(/^#\/?/, '') || 'overview');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = `/${to}`;
  };

  return { route, navigate };
}
