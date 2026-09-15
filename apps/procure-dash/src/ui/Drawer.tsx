import type { ReactNode } from 'react';

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close panel" onClick={onClose} className="absolute inset-0 bg-text/30" />
      <aside
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-50 m-3 flex w-full max-w-md flex-col gap-4 overflow-y-auto rounded-lg bg-surface p-6 shadow-overlay focus:outline-none"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
          >
            Close
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}
