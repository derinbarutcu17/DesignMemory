import type { Category } from '../data/types';
import { formatEurCompact } from '../data/format';

const WIDTH_STEPS = [
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-[50%]',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-[100%]',
];

function widthClass(pct: number) {
  const index = Math.min(WIDTH_STEPS.length - 1, Math.max(0, Math.round(pct / 5) - 1));
  return WIDTH_STEPS[index];
}

export function CategoryBars({ categories }: { categories: Category[] }) {
  const max = Math.max(...categories.map((category) => category.spendEur));

  return (
    <ul className="flex flex-col gap-3">
      {categories.map((category) => (
        <li key={category.id} className="grid grid-cols-[10rem_1fr_5rem] items-center gap-3">
          <span className="truncate text-sm text-text-muted">{category.name}</span>
          <span className="h-2 w-full overflow-hidden rounded-full bg-chart-grid">
            <span className={`block h-2 rounded-full bg-primary ${widthClass((category.spendEur / max) * 100)}`} />
          </span>
          <span className="text-right text-sm tabular-nums text-text">{formatEurCompact(category.spendEur)}</span>
        </li>
      ))}
    </ul>
  );
}
