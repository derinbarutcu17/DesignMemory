import type { ContractState, RiskLevel, Supplier } from './types';

const NAMES = [
  'Stahlwerke Ostwald GmbH',
  'Vogelsang Logistik AG',
  'Meier Elektronik KG',
  'Nordwind Verpackung GmbH',
  'Kraftwerk Rheinland AG',
  'Baumann Werkzeuge GmbH',
  'Hansa Guss AG',
  'Delta Blechverarbeitung GmbH',
  'Alpenrohr Leitungen AG',
  'Wertheim Kunststoffe GmbH',
  'Silbermann Kabelwerke AG',
  'Morgenstern MRO Handels GmbH',
  'Elbtal Fracht GmbH',
  'Ruhrmann Energie AG',
  'Weissgerber Komponenten KG',
  'Falkenberg Maritime GmbH',
  'Oderbruch Logistik AG',
  'Sonneberg Praezision GmbH',
  'Handelshaus Weinstadt GmbH',
  'Lindqvist Industries AB',
  'Castellano Aceros SL',
  'Vosges Mecanique SAS',
  'Pomerania Steel Sp. z o.o.',
  'Brenner Kunststoffwerk GmbH',
];

const CATEGORIES = ['Steel castings', 'Logistics', 'Electronics', 'MRO supplies', 'Packaging', 'Energy contracts'];
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

export const suppliers: Supplier[] = NAMES.map((name, index) => {
  const risk = riskFor(index);
  const spend = Math.round((620000 + hash(index, 3) * 4200000) / 1000) * 1000;
  return {
    id: `sup-${String(index + 1).padStart(3, '0')}`,
    name,
    category: CATEGORIES[index % CATEGORIES.length],
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
