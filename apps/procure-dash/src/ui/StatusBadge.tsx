import type { ContractState, RiskLevel } from '../data/types';
import { type Tone } from './Badge';
import { cn } from './cn';

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

const PILL_TONES: Record<Tone, string> = {
  neutral: 'border-border bg-surface-raised text-text-muted',
  primary: 'border-primary/30 bg-primary/10 text-primary',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
};

function Pill({ tone, children }: { tone: Tone; children: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium', PILL_TONES[tone])}>{children}</span>;
}

export function StatusBadge({ state }: { state: ContractState }) {
  return <Pill tone={STATE_TONES[state]}>{STATE_LABELS[state]}</Pill>;
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Pill tone={RISK_TONES[level]}>{RISK_LABELS[level]}</Pill>;
}
