import path from 'node:path';

import { recordDecisionSync } from '../src/lib/memory/store';

const cwd = path.resolve(process.argv[2] ?? 'apps/procure-dash');
const expiresAt = new Date(Date.now() + 180 * 86_400_000).toISOString();

const seeds = [
  {
    kind: 'exception' as const,
    ruleId: 'color.raw-hex',
    target: { glob: 'src/ui/SupplierMark.tsx' },
    reason: 'Vendor brand marks use their official palette so partner logos stay recognizable in dense tables.',
    author: 'human:derin',
  },
  {
    kind: 'intentional' as const,
    ruleId: 'tailwind.arbitrary-font-size',
    target: { file: 'src/ui/DataTable.tsx', value: '13px' },
    reason: 'Dense numeric columns use a 13px step for scanability across 24 supplier rows, reviewed by design.',
    author: 'human:derin',
    tokenDependency: ['fontSize.sm'],
    expiresAt,
  },
  {
    kind: 'decision' as const,
    ruleId: 'component.variant-drift',
    target: { component: 'StatusBadge' },
    reason: 'Risk levels are fixed to three tiers by procurement policy, so extra badge variants stay out of scope.',
    author: 'human:derin',
  },
];

for (const seed of seeds) {
  const result = recordDecisionSync(seed, cwd);
  console.log(`[seed] ${result.action} ${result.decision.id} -> ${result.effect.suppresses}`);
}

console.log(`[seed] decision memory ready in ${path.join(cwd, '.design-memory/decisions.json')}`);
