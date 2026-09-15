import type { ContractState, RiskLevel, Supplier } from './types';

const NAMES: Array<{ name: string; category: string }> = [
  { name: 'Stahlwerke Ostwald GmbH', category: 'Steel castings' },
  { name: 'Vogelsang Logistik AG', category: 'Logistics' },
  { name: 'Meier Elektronik KG', category: 'Electronics' },
  { name: 'Nordwind Verpackung GmbH', category: 'Packaging' },
  { name: 'Kraftwerk Rheinland AG', category: 'Energy contracts' },
  { name: 'Baumann Werkzeuge GmbH', category: 'MRO supplies' },
  { name: 'Hansa Guss AG', category: 'Steel castings' },
  { name: 'Delta Blechverarbeitung GmbH', category: 'Steel castings' },
  { name: 'Alpenrohr Leitungen AG', category: 'Steel castings' },
  { name: 'Wertheim Kunststoffe GmbH', category: 'Packaging' },
  { name: 'Silbermann Kabelwerke AG', category: 'Electronics' },
  { name: 'Morgenstern MRO Handels GmbH', category: 'MRO supplies' },
  { name: 'Elbtal Fracht GmbH', category: 'Logistics' },
  { name: 'Ruhrmann Energie AG', category: 'Energy contracts' },
  { name: 'Weissgerber Komponenten KG', category: 'Electronics' },
  { name: 'Falkenberg Maritime GmbH', category: 'Logistics' },
  { name: 'Oderbruch Logistik AG', category: 'Logistics' },
  { name: 'Sonneberg Praezision GmbH', category: 'MRO supplies' },
  { name: 'Handelshaus Weinstadt GmbH', category: 'MRO supplies' },
  { name: 'Lindqvist Industries AB', category: 'Steel castings' },
  { name: 'Castellano Aceros SL', category: 'Steel castings' },
  { name: 'Vosges Mecanique SAS', category: 'MRO supplies' },
  { name: 'Pomerania Steel Sp. z o.o.', category: 'Steel castings' },
  { name: 'Brenner Kunststoffwerk GmbH', category: 'Packaging' },
];

const COUNTRIES = ['DE', 'DE', 'DE', 'DE', 'AT', 'DE', 'PL', 'DE', 'SE', 'ES', 'FR', 'PL'];
const OWNERS = ['A. Keller', 'M. Braun', 'S. Fischer', 'T. Wagner', 'L. Hoffmann', 'J. Meister'];
const STATES: ContractState[] = ['active', 'renewal', 'expiring', 'expired'];

function hash(index: number, salt: number) {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function trendFor(index: number) {
  return Array.from({ length: 12 }, (_, point) => Math.round(40 + hash(index, point) * 30 + point * 1.6));
}

function riskFor(index: number): { score: number; level: RiskLevel } {
  const score = Math.round(18 + hash(index, 7) * 74);
  if (score >= 72) return { score, level: 'critical' };
  if (score >= 48) return { score, level: 'watch' };
  return { score, level: 'healthy' };
}

export const suppliers: Supplier[] = NAMES.map((entry, index) => {
  const risk = riskFor(index);
  const spend = Math.round((620000 + hash(index, 3) * 4200000) / 1000) * 1000;
  return {
    id: `sup-${String(index + 1).padStart(3, '0')}`,
    name: entry.name,
    category: entry.category,
    country: COUNTRIES[index % COUNTRIES.length],
    spendEur: spend,
    savingsEur: Math.round((spend * (0.02 + hash(index, 11) * 0.09)) / 1000) * 1000,
    riskScore: risk.score,
    risk: risk.level,
    contractState: STATES[Math.floor(hash(index, 5) * STATES.length)],
    owner: OWNERS[index % OWNERS.length],
    trend: trendFor(index),
  };
});

export function supplierById(id: string) {
  return suppliers.find((supplier) => supplier.id === id) ?? null;
}
