import { readFileSync } from 'node:fs';
import path from 'node:path';

import { readConfig } from '../config';
import { resolveReferenceSnapshot } from '../context';
import { detectAvailableBrain, promptBrain } from '../engine';
import { getPullRequestScan } from '../github';
import { getStagedDiff, getStagedFileContent } from '../git';
import { recordDecisionSync } from '../memory/store';
import { createBaseline, loadLatestRun, loadReferenceSnapshot, makeRunId, saveAuditRun, saveReview } from '../state';
import type { AuditRun, DriftIssue, ReferenceSnapshot } from '../types';
import { prettyJson } from '../utils';
import { findDeterministicIssues } from './detectors';
import {
  matchComponents,
  parseDiffIntoFiles,
  type AuditDependencies,
  type AuditOptions,
  type FileDiff,
  type LlmAuditResponse,
} from './shared';
import { applyDecisionMemory, applyReviewAndBaselineState, computeComparison, summarize } from './statuses';

export function buildAuditPrompt(snapshot: ReferenceSnapshot, issues: DriftIssue[], files: FileDiff[]) {
  return {
    systemPrompt: `You are the non-blocking explanation layer for Design Memory. You may clarify findings, but you must not invent new blocking issues.
Return raw JSON in this exact format:
{
  "explanations": [
    { "fingerprint": string, "suggestedAction": string }
  ]
}`,
    userPrompt: `REFERENCE SNAPSHOT:
${prettyJson(snapshot.metadata)}

DETERMINISTIC FACTS:
${prettyJson(issues.map((issue) => ({
  fingerprint: issue.fingerprint,
  ruleId: issue.ruleId,
  componentName: issue.componentName,
  filePath: issue.filePath,
  expected: issue.expected,
  found: issue.found,
  evidenceSnippet: issue.evidenceSnippet,
})))}

FILES ANALYZED:
${prettyJson(files.map((file) => ({ filePath: file.filePath, addedLines: file.addedLines })))}`,
  };
}

function parseExplainOnlyResponse(response: string): LlmAuditResponse {
  const parsed = JSON.parse(response) as LlmAuditResponse;
  return {
    explanations: Array.isArray(parsed.explanations) ? parsed.explanations : [],
  };
}

function printHumanReport(run: AuditRun, createBaselineRun: boolean) {
  console.log(`[Design Memory] Files analyzed: ${run.filesAnalyzed.length}`);
  console.log(`[Design Memory] Components matched: ${run.matchedComponents.length}`);
  console.log(`[Design Memory] Deterministic findings: ${run.issues.filter((issue) => issue.detectionSource === 'deterministic').length}`);
  console.log(`[Design Memory] LLM-assisted findings: ${run.issues.filter((issue) => issue.detectionSource === 'llm-assisted').length}`);

  if (createBaselineRun) {
    console.log('[Design Memory] Baseline created from the current findings. Future runs will block only on net-new or reopened issues.');
    return;
  }

  if (run.issues.length === 0) {
    console.log('\x1b[32m%s\x1b[0m', '[Design Memory] ✅ No design-system drift found.');
    return;
  }

  for (const issue of run.issues) {
    console.log(`\n[${issue.severity.toUpperCase()}] ${issue.componentName} — ${issue.ruleId} (${issue.status})`);
    console.log(`File: ${issue.filePath}`);
    console.log(`Expected: ${issue.expected}`);
    console.log(`Found: ${issue.found}`);
    console.log(`Evidence: ${issue.evidenceSnippet}`);
    console.log(`Fix: ${issue.suggestedAction}`);
  }
}

export async function scanPullRequest(prNumber: number, cwd = process.cwd(), options: Pick<AuditOptions, 'json'> = {}) {
  const scan = getPullRequestScan(prNumber, cwd);
  return runAudit({}, {
    cwd,
    mode: 'scan',
    diff: scan.diff,
    label: `PR #${prNumber}: ${scan.title}\nSource: ${scan.url}`,
    json: options.json,
    prScan: scan,
  });
}

export type AuditExecution = {
  skipped: boolean;
  missingSnapshot: boolean;
  exitCode: 0 | 1 | 2;
  run: AuditRun | null;
  blockingCount: number;
};

export async function executeAudit(deps: AuditDependencies = {}, options: AuditOptions = {}): Promise<AuditExecution> {
  const cwd = options.cwd ?? process.cwd();
  const mode = options.mode ?? 'staged';
  const persist = options.persist ?? true;
  const config = readConfig(cwd);
  const getDiff = deps.getDiff ?? ((targetCwd?: string) => getStagedDiff(targetCwd ?? cwd));
  const getFileContent = deps.getFileContent ?? ((filePath: string, targetCwd?: string) => getStagedFileContent(filePath, targetCwd ?? cwd));
  const getSnapshot = deps.getSnapshot ?? loadReferenceSnapshot;
  const resolveSnapshot = deps.resolveSnapshot ?? resolveReferenceSnapshot;
  const getBrain = deps.getBrain ?? ((fetchFn?: typeof fetch) => detectAvailableBrain(fetchFn ?? fetch, cwd));
  const askBrain = deps.askBrain ?? promptBrain;

  const diff = options.diff ?? getDiff(cwd);
  if (!diff) {
    return { skipped: true, missingSnapshot: false, exitCode: 0, run: null, blockingCount: 0 };
  }

  let snapshot = getSnapshot(cwd);
  if (!snapshot) {
    return { skipped: false, missingSnapshot: true, exitCode: 2, run: null, blockingCount: 0 };
  }
  if (!snapshot.metadata.importedAt) {
    snapshot = await resolveSnapshot(cwd);
  }

  const warnings: string[] = [];
  if (snapshot.metadata.importedAt) {
    const importedAt = new Date(snapshot.metadata.importedAt).getTime();
    const daysOld = Math.floor((Date.now() - importedAt) / 86_400_000);
    if (daysOld >= 7) {
      warnings.push(`reference snapshot is ${daysOld} days old, run design-memory sync-reference`);
    }
  }

  const files = parseDiffIntoFiles(diff, config, cwd).map((file) => ({
    ...file,
    fullContent:
      mode === 'staged'
        ? getFileContent(file.filePath, cwd)
        : options.prScan?.files.find((entry) => entry.path === file.filePath)?.content ?? null,
  }));
  const mappings = matchComponents(snapshot, files);
  let issues = findDeterministicIssues(snapshot, files, mappings, config, cwd);
  issues = applyReviewAndBaselineState(issues, cwd);

  const memoryResult = applyDecisionMemory(issues, cwd);
  issues = memoryResult.issues;
  for (const warning of memoryResult.warnings) {
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
  }

  if (config.llmFallback.enabled && config.llmFallback.mode !== 'disabled' && issues.length > 0) {
    const brain = await getBrain();
    if (brain) {
      try {
        const { systemPrompt, userPrompt } = buildAuditPrompt(snapshot, issues, files);
        const response = await askBrain(brain, systemPrompt, userPrompt);
        const parsed = parseExplainOnlyResponse(response);
        issues = issues.map((issue) => ({
          ...issue,
          suggestedAction: parsed.explanations?.find((entry) => entry.fingerprint === issue.fingerprint)?.suggestedAction ?? issue.suggestedAction,
          detectionSource: issue.detectionSource,
        }));
      } catch {
        // Keep the core deterministic flow resilient.
      }
    }
  }

  const previousRun = loadLatestRun(cwd);
  const comparison = computeComparison(issues, previousRun);
  const run: AuditRun = {
    id: makeRunId(),
    status: 'completed',
    summary: {
      ...summarize(issues),
      resolvedCount: comparison.resolvedFingerprints.length,
      remainingCount: comparison.remainingFingerprints.length,
    },
    filesAnalyzed: files.map((file) => file.filePath),
    matchedComponents: mappings.map((mapping) => ({
      filePath: mapping.filePath,
      componentName: mapping.componentName,
      confidence: mapping.confidence,
      detectionSource: mapping.detectionSource,
    })),
    issues,
    warnings,
    comparison,
    createdAt: new Date().toISOString(),
  };

  if (persist) {
    saveAuditRun(run, cwd);
    if (options.createBaseline) {
      createBaseline(issues.map((issue) => issue.fingerprint), cwd);
      run.baselineCreated = true;
    }
  }

  const blockingIssues = issues.filter((issue) => issue.severity === 'error' && (issue.status === 'new' || issue.status === 'reopened'));
  const shouldBlock = blockingIssues.length > 0 && mode !== 'scan' && config.strictness === 'block';

  return {
    skipped: false,
    missingSnapshot: false,
    exitCode: shouldBlock ? 1 : 0,
    run,
    blockingCount: blockingIssues.length,
  };
}

export async function runAudit(deps: AuditDependencies = {}, options: AuditOptions = {}) {
  const exit = deps.exit ?? process.exit;
  // Banner on stderr so --json stdout stays parseable.
  console.error('\x1b[36m%s\x1b[0m', '[Design Memory] Starting audit...');
  const result = await executeAudit(deps, options);

  if (result.skipped) {
    console.log('[Design Memory] No staged UI changes detected. Skipping audit.');
    exit(0);
    return;
  }

  if (result.missingSnapshot || !result.run) {
    console.error('[Design Memory] No reference snapshot found. Run `design-memory sync-reference` first.');
    exit(2);
    return;
  }

  const run = result.run;
  for (const warning of run.warnings ?? []) {
    console.warn(`\x1b[33m%s\x1b[0m`, `[Design Memory] ⚠️ ${warning}`);
  }

  if (options.createBaseline && run.baselineCreated) {
    const accepted = run.issues.filter((issue) => issue.status === 'new' || issue.status === 'remaining').length;
    if (options.json) {
      console.log(prettyJson(run));
    } else {
      printHumanReport(run, true);
      console.log(`[Design Memory] Baseline accepted ${accepted} findings. Future runs block only net-new or reopened drift.`);
    }
    exit(0);
    return;
  }

  if (options.json) {
    console.log(prettyJson(run));
  } else {
    if (options.label) {
      console.log(`[Design Memory] ${options.label}`);
    }
    printHumanReport(run, false);
  }

  if (result.exitCode === 1) {
    console.warn('\x1b[33m%s\x1b[0m', '\n[Design Memory] ⚠️ Commit blocked. If this is a false positive, force the commit by running: git commit --no-verify');
  }

  exit(result.exitCode);
}

export function loadLatestRunJson(cwd = process.cwd()) {
  const latest = loadLatestRun(cwd);
  if (!latest) {
    throw new Error('No prior audit run found.');
  }
  return latest;
}

export function reviewFinding(fingerprint: string, status: 'intentional' | 'ignore', note?: string, cwd = process.cwd()) {
  const review = saveReview({ fingerprint, status, note }, cwd);

  try {
    const latest = loadLatestRun(cwd);
    const issue = latest?.issues.find((entry) => entry.fingerprint === fingerprint);
    recordDecisionSync(
      {
        kind: status === 'intentional' ? 'intentional' : 'exception',
        ruleId: issue?.ruleId ?? '*',
        target: issue
          ? { file: issue.filePath, value: issue.found, fingerprint }
          : { fingerprint },
        reason: note && note.trim().length >= 10 ? note.trim() : 'Recorded through the review command.',
        author: 'human:review-cli',
      },
      cwd,
    );
  } catch {
    // reviews.json remains the fallback; decision memory is best effort here.
  }

  return review;
}

export function compareRuns(cwd = process.cwd()) {
  const latest = loadLatestRun(cwd);
  if (!latest) {
    throw new Error('No prior audit run found.');
  }

  return latest.comparison ?? {
    resolvedFingerprints: [],
    remainingFingerprints: latest.issues.map((issue) => issue.fingerprint),
    newFingerprints: [],
    reopenedFingerprints: [],
  };
}

export function readFileSnippet(filePath: string, cwd = process.cwd()) {
  const absolute = path.resolve(cwd, filePath);
  return readFileSync(absolute, 'utf-8');
}
