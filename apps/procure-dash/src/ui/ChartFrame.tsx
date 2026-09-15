import type { ReactNode } from 'react';

export function ChartFrame({ title, meta, action, children }: { title: string; meta?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-text">{title}</h2>
          {meta ? <p className="mt-1 text-xs text-text-muted">{meta}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
