import { z } from 'zod';
import { hashParts } from '../utils';

export const MAX_ACTIVE_DECISIONS = 500;
export const MAX_REASON_LENGTH = 500;
export const MIN_REASON_LENGTH = 10;

const REASON_BLOCKLIST = new Set(['n/a', 'na', 'none', 'fix', 'fix it', 'todo', '-', '--', '...']);
const PLACEHOLDER_RE = /^(todo|fix|fixme|n\/?a|none|tbd)\b/i;

export const decisionTargetSchema = z.object({
  file: z.string().min(1).max(400).optional(),
  glob: z.string().min(1).max(400).optional(),
  component: z.string().min(1).max(200).optional(),
  tokenPath: z.string().min(1).max(300).optional(),
  value: z.string().min(1).max(160).optional(),
  fingerprint: z.string().min(1).max(120).optional(),
});

export const decisionSchema = z.object({
  id: z.string().regex(/^dec_[0-9a-f]{12}$/),
  kind: z.enum(['intentional', 'exception', 'decision']),
  status: z.enum(['active', 'expired', 'superseded', 'invalidated']),
  ruleId: z.string().min(1).max(120),
  target: decisionTargetSchema,
  reason: z.string().min(MIN_REASON_LENGTH).max(MAX_REASON_LENGTH),
  author: z.string().min(1).max(64),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  expiresAt: z.string().min(1).optional(),
  tokenRefs: z
    .array(z.object({ path: z.string().min(1), valueAtCreation: z.string() }))
    .max(5)
    .optional(),
  supersedes: z.string().min(1).optional(),
  evidence: z
    .object({
      pr: z.number().optional(),
      commit: z.string().optional(),
      runId: z.string().optional(),
    })
    .optional(),
  fingerprint: z.string().min(1).max(120),
});

export const decisionStoreSchema = z.object({
  version: z.literal(2),
  decisions: z.array(decisionSchema),
});

export type DecisionTarget = z.infer<typeof decisionTargetSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type DecisionStore = z.infer<typeof decisionStoreSchema>;
export type DecisionKind = Decision['kind'];
export type DecisionStatus = Decision['status'];

export type DecisionLogEntry = {
  t: string;
  op: 'create' | 'update' | 'supersede' | 'expire' | 'invalidate' | 'repair' | 'migrate';
  decision?: Decision;
  note?: string;
};

const TARGET_KEY_ORDER: Array<keyof DecisionTarget> = [
  'file',
  'glob',
  'component',
  'tokenPath',
  'value',
  'fingerprint',
];

export function canonicalTarget(target: DecisionTarget): string {
  return TARGET_KEY_ORDER.filter((key) => target[key] !== undefined)
    .map((key) => `${key}=${target[key]}`)
    .join(';');
}

export function buildDecisionFingerprint(ruleId: string, target: DecisionTarget): string {
  return hashParts([ruleId, canonicalTarget(target)]);
}

export function normalizeDecisionValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

export function validateReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return `reason must be at least ${MIN_REASON_LENGTH} characters`;
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return `reason must be at most ${MAX_REASON_LENGTH} characters`;
  }
  if (REASON_BLOCKLIST.has(trimmed.toLowerCase()) || PLACEHOLDER_RE.test(trimmed)) {
    return 'reason is a placeholder; describe why the deviation is intentional';
  }
  return null;
}

export function emptyDecisionStore(): DecisionStore {
  return { version: 2, decisions: [] };
}
