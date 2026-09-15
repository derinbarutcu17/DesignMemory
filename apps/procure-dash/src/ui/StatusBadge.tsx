import type { ContractState, RiskLevel } from '../data/types';
import { Badge, type Tone } from './Badge';

const STATE_LABELS: Record<ContractState, string> = {
  active: 'Active',
  renewal: 'Renewal window',
  expiring: 'Expiring',
  expired: 'Expired',
};

const STATE_TONES: Record<ContractState, Tone> = {
  active: 'success',
  renewal: 'info',
  expiring: 'warning',
  expired: 'danger',
};

const RISK_LABELS: Record<RiskLevel, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  critical: 'Critical',
};

const RISK_TONES: Record<RiskLevel, Tone> = {
  healthy: 'success',
  watch: 'warning',
  critical: 'danger',
};

export function StatusBadge({ state }: { state: ContractState }) {
  return <Badge tone={STATE_TONES[state]}>{STATE_LABELS[state]}</Badge>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={RISK_TONES[level]}>{RISK_LABELS[level]}</Badge>;
}
