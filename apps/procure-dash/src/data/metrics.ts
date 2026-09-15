import { suppliers } from './suppliers';

export const kpis = {
  savingsIdentifiedEur: suppliers.reduce((sum, supplier) => sum + supplier.savingsEur, 0),
  spendUnderManagementEur: suppliers.reduce((sum, supplier) => sum + supplier.spendEur, 0),
  contractsExpiring90d: 6,
  suppliersAtRisk: suppliers.filter((supplier) => supplier.risk !== 'healthy').length,
};

export const spendTrend = [42, 44, 43, 46, 45, 48, 47, 49, 52, 51, 54, 56];
export const savingsTrend = [8, 12, 11, 15, 18, 17, 22, 24, 23, 28, 31, 34];
export const riskTrend = [12, 14, 13, 15, 18, 17, 19, 22, 24, 23, 26, 27];
export const contractTrend = [3, 4, 4, 5, 5, 6, 6, 7, 6, 7, 7, 6];
