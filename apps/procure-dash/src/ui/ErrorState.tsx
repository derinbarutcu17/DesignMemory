export function ErrorState({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-danger/30 bg-danger/10 px-6 py-12 text-center">
      <span className="text-sm font-medium text-danger">{title}</span>
      <span className="max-w-sm text-sm text-text-muted">{detail}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-danger/40 bg-surface px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-surface-raised"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
