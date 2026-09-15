type Segment = {
  label: string;
  value: number;
  className: string;
};

export function DonutChart({ segments, centerLabel, centerValue }: { segments: Segment[]; centerLabel: string; centerValue: string }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 42 42" className="h-28 w-28 -rotate-90">
          <circle cx="21" cy="21" r="15.9" fill="none" stroke="currentColor" strokeWidth="5.5" pathLength={100} className="text-chart-grid" />
          {segments.map((segment) => {
            const share = (segment.value / total) * 100;
            const circle = (
              <circle
                key={segment.label}
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke="currentColor"
                strokeWidth="5.5"
                pathLength={100}
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-offset}
                className={segment.className}
              />
            );
            offset += share;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">{centerValue}</span>
          <span className="text-xs text-text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full bg-current ${segment.className}`} />
            <span className="text-text-muted">{segment.label}</span>
            <span className="tabular-nums text-text">{Math.round((segment.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
