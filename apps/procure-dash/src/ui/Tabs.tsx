import { cn } from './cn';

export function Tabs({
  value,
  onChange,
  tabs,
}: {
  value: string;
  onChange: (value: string) => void;
  tabs: Array<{ value: string; label: string; count?: number }>;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          type="button"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-sm px-3 py-1 text-sm transition-colors',
            value === tab.value ? 'bg-surface-raised font-medium text-text' : 'text-text-muted hover:text-text',
          )}
        >
          {tab.label}
          {tab.count !== undefined ? <span className="ml-2 text-xs text-text-muted">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
