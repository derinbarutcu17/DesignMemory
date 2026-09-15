import type { RiskLevel } from '../data/types';

const FILL: Record<RiskLevel, string> = {
  healthy: 'bg-success',
  watch: 'bg-warning',
  critical: 'bg-danger',
};

const WIDTH_STEPS = ['w-[10%]', 'w-[20%]', 'w-[30%]', 'w-[40%]', 'w-[50%]', 'w-[60%]', 'w-[70%]', 'w-[80%]', 'w-[90%]', 'w-[100%]'];

function widthClass(score: number) {
  const index = Math.min(WIDTH_STEPS.length - 1, Math.max(0, Math.round(score / 10) - 1));
  return WIDTH_STEPS[index];
}

export function RiskMeter({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-chart-grid">
        <span className={`block h-1.5 rounded-full ${FILL[level]} ${widthClass(score)}`} />
      </span>
      <span className="tabular-nums text-xs text-text-muted">{score}</span>
    </div>
  );
}
