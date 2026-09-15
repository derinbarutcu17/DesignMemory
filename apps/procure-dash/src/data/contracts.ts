import type { Contract, ContractState } from './types';

const TITLES = [
  'Steel castings framework',
  'Road freight EMEA',
  'PCB assemblies lot 4',
  'Industrial fasteners',
  'Corrugated packaging',
  'Base load power supply',
  'Aluminium extrusion supply',
  'Warehouse services Sued',
  'Sensor modules FY26',
  'Hydraulic components',
  'Returnable transport packaging',
  'Peak load energy hedge',
  'Precision machining services',
  'Air freight contingency',
  'Connector assemblies',
  'Calibration and maintenance',
  'Labeling systems supply',
  'Compressed air service',
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

export const contracts: Contract[] = TITLES.map((title, index) => {
  const renewal = new Date(BASE_DATE + Math.round(hash(index, 2) * 420 - 120) * 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    id: `ctr-${String(index + 1).padStart(3, '0')}`,
    supplierId: `sup-${String((index % 24) + 1).padStart(3, '0')}`,
    title,
    category: ['Steel castings', 'Logistics', 'Electronics', 'MRO supplies', 'Packaging', 'Energy contracts'][index % 6],
    annualValueEur: Math.round((180000 + hash(index, 4) * 2400000) / 1000) * 1000,
    state: STATES[index],
    noticeDays: [30, 60, 90][index % 3],
    renewalDate: renewal,
    owner: ['A. Keller', 'M. Braun', 'S. Fischer', 'T. Wagner'][index % 4],
    terms: [TERMS[index % TERMS.length], TERMS[(index + 2) % TERMS.length]],
  };
});
