export type RiskLevel = 'healthy' | 'watch' | 'critical';
export type ContractState = 'active' | 'renewal' | 'expiring' | 'expired';

export type Supplier = {
  id: string;
  name: string;
  category: string;
  country: string;
  spendEur: number;
  savingsEur: number;
  riskScore: number;
  risk: RiskLevel;
  contractState: ContractState;
  owner: string;
  trend: number[];
};

export type Contract = {
  id: string;
  supplierId: string;
  title: string;
  category: string;
  annualValueEur: number;
  state: ContractState;
  noticeDays: number;
  renewalDate: string;
  owner: string;
  terms: string[];
};

export type Alert = {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  detail: string;
  age: string;
};

export type Category = {
  id: string;
  name: string;
  spendEur: number;
  deltaPct: number;
  savingsEur: number;
};
