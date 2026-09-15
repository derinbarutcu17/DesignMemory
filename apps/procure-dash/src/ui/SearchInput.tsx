import { cn } from './cn';

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{placeholder ?? 'Search'}</span>
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
      />
    </label>
  );
}
