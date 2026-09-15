export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-6 py-12 text-center">
      <span className="text-sm font-medium text-text">{title}</span>
      <span className="max-w-sm text-sm text-text-muted">{detail}</span>
    </div>
  );
}
