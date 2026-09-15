import { cn } from './cn';

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return (
    <nav className="flex items-center justify-between text-sm text-text-muted" aria-label="Pagination">
      <span>
        Page {page} of {pageCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={cn('rounded-md border border-border bg-surface px-3 py-1 transition-colors hover:bg-surface-raised', page <= 1 && 'opacity-50')}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className={cn('rounded-md border border-border bg-surface px-3 py-1 transition-colors hover:bg-surface-raised', page >= pageCount && 'opacity-50')}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
