import { Sparkline } from './Sparkline';

export function StatCard({
  label,
  value,
  delta,
  trend,
  trendTone = 'primary',
}: {
  label: string;
  value: string;
  delta?: string;
  trend: number[];
  trendTone?: 'primary' | 'success' | 'danger';
}) {
  const sparkTone = trendTone === 'danger' ? 'text-danger' : trendTone === 'success' ? 'text-success' : 'text-primary';
  return (
    <article className="rounded-lg border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-raised">
      <p className="text-sm text-text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <Sparkline points={trend} className={sparkTone} />
      </div>
      {delta ? <p className="mt-1 text-xs text-text-muted">{delta}</p> : null}
    </article>
  );
}
