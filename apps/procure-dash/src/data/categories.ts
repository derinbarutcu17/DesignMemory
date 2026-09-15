import type { Category } from './types';

export const categories: Category[] = [
  { id: 'steel', name: 'Steel castings', spendEur: 4820000, deltaPct: 4.2, savingsEur: 410000 },
  { id: 'logistics', name: 'Logistics', spendEur: 3140000, deltaPct: -1.8, savingsEur: 265000 },
  { id: 'electronics', name: 'Electronics', spendEur: 2870000, deltaPct: 6.5, savingsEur: 198000 },
  { id: 'mro', name: 'MRO supplies', spendEur: 1960000, deltaPct: 0.4, savingsEur: 142000 },
  { id: 'packaging', name: 'Packaging', spendEur: 1240000, deltaPct: -3.1, savingsEur: 96000 },
  { id: 'energy', name: 'Energy contracts', spendEur: 2180000, deltaPct: 11.3, savingsEur: 87000 },
];
