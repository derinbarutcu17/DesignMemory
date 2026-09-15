import { cn } from './cn';

export function Select({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn('flex items-center gap-2 text-sm text-text-muted', className)}>
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
