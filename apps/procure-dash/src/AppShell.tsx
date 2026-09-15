import type { ReactNode } from 'react';
import { cn } from './ui';

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'contracts', label: 'Contracts' },
];

export function AppShell({
  route,
  navigate,
  children,
}: {
  route: string;
  navigate: (to: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface-raised">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-surface">N</span>
          <div>
            <p className="text-sm font-semibold leading-tight">Northwind</p>
            <p className="text-xs text-text-muted">Procurement</p>
          </div>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={cn(
                'rounded-md px-3 py-2 text-left text-sm transition-colors',
                route === item.id ? 'bg-surface-raised font-medium text-text' : 'text-text-muted hover:bg-surface-raised hover:text-text',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-md border border-border bg-surface-raised p-3">
          <p className="text-xs font-medium text-text">FY26 program</p>
          <p className="mt-1 text-xs text-text-muted">Spend under management reached 97% coverage.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('overview')} className="text-sm text-text-muted transition-colors hover:text-text md:hidden">
              Northwind
            </button>
            <span className="hidden text-sm text-text-muted md:inline">
              {NAV.find((item) => item.id === route)?.label ?? 'Procurement console'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-text-muted lg:inline">A. Keller · Category lead</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-raised text-xs font-medium">AK</span>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
