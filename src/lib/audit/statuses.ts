import { findDecisionForIssue } from '../memory/lookup';
import { loadDecisionsForAudit } from '../memory/store';
import { loadBaseline, loadLatestRun, loadReviews, loadRunHistory } from '../state';
import type { AuditRun, DriftIssue } from '../types';
import { getIssueKey, type IssueHistoryIndex } from './shared';

export function buildIssueHistoryIndex(cwd: string): IssueHistoryIndex {
  const reviews = loadReviews(cwd).reviews;
  const baseline = loadBaseline(cwd);
  const previousRun = loadLatestRun(cwd);
  const runHistory = loadRunHistory(cwd);
  return {
    reviews,
    // Suppressed findings (intentional/ignored) intentionally stay out of the
    // previous-fingerprint set, so a finding blocks again once its decision
    // expires or is superseded. It then derives to "reopened".
    previousFingerprints: new Set(previousRun?.issues.filter((issue) => ['new', 'remaining', 'reopened'].includes(issue.status)).map((issue) => issue.fingerprint) ?? []),
    previousIssueKeys: new Map((previousRun?.issues ?? []).map((issue) => [getIssueKey(issue), issue.fingerprint])),
    historicalIssueKeys: new Map(
    runHistory
      .flatMap((run) => run.issues)
      .map((issue) => [getIssueKey(issue), issue.fingerprint] as const),
    ),
    historicalFingerprints: new Set(runHistory.flatMap((run) => run.issues.map((issue) => issue.fingerprint))),
    baselineFingerprints: new Set(Object.keys(baseline?.acceptedFingerprints ?? {})),
  };
}

export function deriveIssueStatus(issue: DriftIssue, index: IssueHistoryIndex): DriftIssue['status'] {
  const review = index.reviews[issue.fingerprint];
  if (review?.status === 'intentional') {
    return 'intentional';
  }
  if (review?.status === 'ignore') {
    return 'ignored';
  }

  const issueKey = getIssueKey(issue);
  const previousFingerprintForKey = index.previousIssueKeys.get(issueKey);
  if (previousFingerprintForKey && previousFingerprintForKey !== issue.fingerprint) {
    return 'reopened';
  }
  if (index.historicalFingerprints.has(issue.fingerprint) && !index.previousFingerprints.has(issue.fingerprint)) {
    return 'reopened';
  }

  const historicalFingerprintForKey = index.historicalIssueKeys.get(issueKey);
  if (historicalFingerprintForKey && !index.previousFingerprints.has(issue.fingerprint) && historicalFingerprintForKey !== issue.fingerprint) {
    return 'reopened';
  }
  if (index.previousFingerprints.has(issue.fingerprint) || index.baselineFingerprints.has(issue.fingerprint)) {
    return 'remaining';
  }
  return 'new';
}

export function applyReviewAndBaselineState(issues: DriftIssue[], cwd: string) {
  const historyIndex = buildIssueHistoryIndex(cwd);
  return issues.map((issue) => ({
    ...issue,
    status: deriveIssueStatus(issue, historyIndex),
  }));
}

export function applyDecisionMemory(issues: DriftIssue[], cwd: string) {
  const { decisions, warnings } = loadDecisionsForAudit(cwd);
  const mapped = issues.map((issue) => {
    const match = findDecisionForIssue(issue, decisions);
    if (!match) {
      return issue;
    }
    const status: DriftIssue['status'] = match.kind === 'exception' ? 'ignored' : 'intentional';
    return { ...issue, status, suppressedBy: match.decisionId };
  });
  return { issues: mapped, warnings };
}

export function computeComparison(current: DriftIssue[], previous: AuditRun | null) {
  const previousFingerprints = new Set(previous?.issues.map((issue) => issue.fingerprint) ?? []);
  const currentFingerprints = new Set(current.map((issue) => issue.fingerprint));
  const resolved = [...previousFingerprints].filter((fingerprint) => !currentFingerprints.has(fingerprint));
  const remaining = [...currentFingerprints].filter((fingerprint) => previousFingerprints.has(fingerprint));
  const added = current.filter((issue) => issue.status === 'new').map((issue) => issue.fingerprint);

  return {
    resolvedFingerprints: resolved,
    remainingFingerprints: remaining,
    newFingerprints: added,
    reopenedFingerprints: current.filter((issue) => issue.status === 'reopened').map((issue) => issue.fingerprint),
  };
}

export function summarize(issues: DriftIssue[]) {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const issue of issues) {
    byType[issue.issueType] = (byType[issue.issueType] ?? 0) + 1;
    byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
  }

  return {
    totalIssues: issues.length,
    error: issues.filter((issue) => issue.severity === 'error').length,
    warn: issues.filter((issue) => issue.severity === 'warn').length,
    byType,
    byStatus,
  };
}
