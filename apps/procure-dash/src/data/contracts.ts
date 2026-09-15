import type { Contract, ContractState } from './types';
import { suppliers } from './suppliers';

const TITLES: Array<{ title: string; category: string }> = [
  { title: 'Steel castings framework', category: 'Steel castings' },
  { title: 'Road freight EMEA', category: 'Logistics' },
  { title: 'PCB assemblies lot 4', category: 'Electronics' },
  { title: 'Industrial fasteners', category: 'MRO supplies' },
  { title: 'Corrugated packaging', category: 'Packaging' },
  { title: 'Base load power supply', category: 'Energy contracts' },
  { title: 'Aluminium extrusion supply', category: 'Steel castings' },
  { title: 'Warehouse services Sued', category: 'Logistics' },
  { title: 'Sensor modules FY26', category: 'Electronics' },
  { title: 'Hydraulic components', category: 'MRO supplies' },
  { title: 'Returnable transport packaging', category: 'Packaging' },
  { title: 'Peak load energy hedge', category: 'Energy contracts' },
  { title: 'Precision machining services', category: 'MRO supplies' },
  { title: 'Air freight contingency', category: 'Logistics' },
  { title: 'Connector assemblies', category: 'Electronics' },
  { title: 'Calibration and maintenance', category: 'MRO supplies' },
  { title: 'Labeling systems supply', category: 'Packaging' },
  { title: 'Compressed air service', category: 'MRO supplies' },
];

const STATES: ContractState[] = ['active', 'renewal', 'expiring', 'active', 'active', 'renewal', 'active', 'expiring', 'active', 'active', 'expired', 'active', 'renewal', 'expiring', 'active', 'active', 'active', 'renewal'];
const TERMS = [
  'Index clause tied to HRC steel',
  '90 day termination notice',
  'Volume rebate tiered at 4 steps',
  'Energy surcharge pass-through capped at 6%',
  'Incoterms 2020 DAP',
  'Quality holdback 2% per quarter',
];

function hash(index: number, salt: number) {
  const x = Math.sin(index * 91.7 + salt * 47.3) * 15731.743;
  return x - Math.floor(x);
}

const BASE_DATE = Date.UTC(2026, 8, 15);

export const contracts: Contract[] = TITLES.map((entry, index) => {
  const renewal = new Date(BASE_DATE + Math.round(hash(index, 2) * 420 - 120) * 86400000)
    .toISOString()
    .slice(0, 10);
  const candidates = suppliers.filter((supplier) => supplier.category === entry.category);
  const supplier = candidates[Math.floor(hash(index, 9) * candidates.length)] ?? suppliers[index % suppliers.length];
  return {
    id: `ctr-${String(index + 1).padStart(3, '0')}`,
    supplierId: supplier.id,
    title: entry.title,
    category: entry.category,
    annualValueEur: Math.round((180000 + hash(index, 4) * 2400000) / 1000) * 1000,
    state: STATES[index],
    noticeDays: [30, 60, 90][index % 3],
    renewalDate: renewal,
    owner: ['A. Keller', 'M. Braun', 'S. Fischer', 'T. Wagner'][index % 4],
    terms: [TERMS[index % TERMS.length], TERMS[(index + 2) % TERMS.length]],
  };
});
