export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3">
          <span className="h-8 w-8 rounded-md bg-chart-grid" />
          <span className="h-3 flex-1 rounded-full bg-chart-grid" />
          <span className="h-3 w-16 rounded-full bg-chart-grid" />
          <span className="h-3 w-24 rounded-full bg-chart-grid" />
        </div>
      ))}
    </div>
  );
}
