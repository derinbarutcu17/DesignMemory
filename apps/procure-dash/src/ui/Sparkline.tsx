export function Sparkline({ points, className = 'text-primary' }: { points: number[]; className?: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(max - min, 1);
  const coords = points
    .map((point, index) => `${(index / (points.length - 1)) * 100},${28 - ((point - min) / span) * 24}`)
    .join(' ');

  return (
    <svg viewBox="0 0 100 30" className={`h-8 w-24 ${className}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
