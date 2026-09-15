import { matchesGlob } from '../config';
import type { DriftIssue } from '../types';
import { normalizeDecisionValue, type Decision } from './schema';

export type DecisionMatch = {
  decisionId: string;
  kind: Decision['kind'];
  reason: string;
  expiresAt?: string;
  specificity: number;
};

export type IssueLike = Pick<
  DriftIssue,
  'fingerprint' | 'ruleId' | 'filePath' | 'componentName' | 'found' | 'suggestedAction'
>;

function byNewestUpdated(left: Decision, right: Decision) {
  return right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id);
}

function ruleMatches(decision: Decision, issue: IssueLike) {
  return decision.ruleId === '*' || decision.ruleId === issue.ruleId;
}

function valueMatches(decision: Decision, issue: IssueLike) {
  if (!decision.target.value) {
    return false;
  }
  const target = normalizeDecisionValue(decision.target.value);
  const found = normalizeDecisionValue(issue.found);
  return found === target || found.includes(target);
}

function pathMatches(decision: Decision, issue: IssueLike) {
  const target = decision.target;
  if (target.fingerprint && target.fingerprint === issue.fingerprint) {
    return true;
  }
  if (target.file && target.file === issue.filePath) {
    return true;
  }
  if (target.component && target.component === issue.componentName) {
    return true;
  }
  if (target.glob && matchesGlob(issue.filePath, target.glob)) {
    return true;
  }
  return false;
}

export function findDecisionForIssue(issue: IssueLike, decisions: Decision[]): DecisionMatch | null {
  const active = decisions.filter((decision) => decision.status === 'active');
  const guard = (decision: Decision) => (decision.target.value ? valueMatches(decision, issue) : true);

  const levels: Array<(decision: Decision) => boolean> = [
    // 0: exact fingerprint (used by migrated review decisions)
    (decision) => Boolean(decision.target.fingerprint) && decision.target.fingerprint === issue.fingerprint,
    // 1: same file and same value
    (decision) => Boolean(decision.target.file) && decision.target.file === issue.filePath && valueMatches(decision, issue),
    // 2: value only
    (decision) => !decision.target.file && !decision.target.glob && !decision.target.component && valueMatches(decision, issue),
    // 3: same file
    (decision) => Boolean(decision.target.file) && decision.target.file === issue.filePath && guard(decision),
    // 4: same component
    (decision) => Boolean(decision.target.component) && decision.target.component === issue.componentName && guard(decision),
    // 5: glob match
    (decision) => Boolean(decision.target.glob) && matchesGlob(issue.filePath, decision.target.glob ?? '') && guard(decision),
    // 6: token path mentioned in the suggestion
    (decision) =>
      Boolean(decision.target.tokenPath) &&
      issue.suggestedAction.toLowerCase().includes((decision.target.tokenPath ?? '').toLowerCase()) &&
      guard(decision),
  ];

  for (let level = 0; level < levels.length; level += 1) {
    const candidates = active
      .filter((decision) => ruleMatches(decision, issue) && levels[level](decision))
      .sort(byNewestUpdated);

    if (candidates.length > 0) {
      const decision = candidates[0];
      return {
        decisionId: decision.id,
        kind: decision.kind,
        reason: decision.reason,
        expiresAt: decision.expiresAt,
        specificity: level,
      };
    }
  }

  return null;
}

export function decisionsForPath(
  decisions: Decision[],
  options: { file?: string; component?: string },
): Decision[] {
  return decisions
    .filter((decision) => decision.status === 'active')
    .filter((decision) => {
      const target = decision.target;
      if (options.file && target.file === options.file) {
        return true;
      }
      if (options.file && target.glob && matchesGlob(options.file, target.glob)) {
        return true;
      }
      if (options.component && target.component === options.component) {
        return true;
      }
      return false;
    })
    .sort(byNewestUpdated);
}
