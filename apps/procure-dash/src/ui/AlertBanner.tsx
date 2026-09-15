import { cn } from './cn';

const TONES: Record<'info' | 'warning' | 'danger', string> = {
  info: 'border-info/30 bg-info/10 text-info',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
};

export function AlertBanner({
  severity,
  title,
  detail,
  age,
}: {
  severity?: 'info' | 'warning' | 'danger';
  title: string;
  detail?: string;
  age?: string;
}) {
  const resolved = TONES[severity ?? 'info'];
  return (
    <div className={cn('flex items-start gap-3 rounded-md border px-3 py-2 text-sm', resolved)} role="status">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium text-text">{title}</p>
        {detail ? <p className="mt-1 text-text-muted">{detail}</p> : null}
      </div>
      {age ? <span className="whitespace-nowrap text-xs text-text-muted">{age}</span> : null}
    </div>
  );
}
