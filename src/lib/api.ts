import fs from 'node:fs';
import path from 'node:path';

import { executeAudit } from './audit';
import { extractStyleUsages, scriptKindForFile } from './ast';
import { readConfig, type DesignMemoryConfig } from './config';
import { DesignMemoryError, isDesignMemoryError } from './errors';
import { assertGitRepo, getRangeDiff, getStagedDiff, getUnstagedDiff } from './git';
import { buildLifecycleContext, evaluateDecisions } from './memory/lifecycle';
import { decisionsForPath } from './memory/lookup';
import {
  listDecisions,
  loadDecisionStore,
  recordDecision,
  type ListDecisionsOptions,
  type RecordDecisionInput,
  type RecordDecisionResult,
} from './memory/store';
import { loadReferenceSnapshot } from './state';
import { rankClosestTokens } from './tokens/closest';
import type { ComponentReference, DriftIssue, ReferenceSnapshot } from './types';
import { normalizeForMatch, uniqueStrings } from './utils';

// ---------------------------------------------------------------------------
// Audit request
// ---------------------------------------------------------------------------

export type AuditScope = 'staged' | 'working' | 'both' | 'range' | 'files';

export type AuditRequestOptions = {
  cwd?: string;
  scope?: AuditScope;
  range?: string;
  files?: string[];
  persist?: boolean;
  maxFindings?: number;
};

export type CompactIssue = {
  ruleId: string;
  status: string;
  severity: string;
  file: string;
  line?: number;
  col?: number;
  found: string;
  suggestion: string;
  suppressedBy?: string;
};

export type AuditRequestResult = {
  scope: AuditScope;
  exitCode: 0 | 1 | 2;
  wouldBlock: boolean;
  skipped: boolean;
  missingSnapshot: boolean;
  summary: {
    total: number;
    error: number;
    warn: number;
    byStatus: Record<string, number>;
  } | null;
  issues: CompactIssue[];
  totalIssues: number;
  truncated: boolean;
  comparison?: {
    resolved: number;
    remaining: number;
    new: number;
    reopened: number;
  };
  warnings: string[];
};

function readWorkingFile(cwd: string, filePath: string) {
  try {
    return fs.readFileSync(path.resolve(cwd, filePath), 'utf-8');
  } catch {
    return '';
  }
}

function compactIssue(issue: DriftIssue): CompactIssue {
  return {
    ruleId: issue.ruleId,
    status: issue.status,
    severity: issue.severity,
    file: issue.filePath,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
    ...(issue.column !== undefined ? { col: issue.column } : {}),
    found: issue.found,
    suggestion: issue.suggestedAction,
    ...(issue.suppressedBy ? { suppressedBy: issue.suppressedBy } : {}),
  };
}

function sortIssues(issues: CompactIssue[]) {
  return [...issues].sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      (left.line ?? 0) - (right.line ?? 0) ||
      left.ruleId.localeCompare(right.ruleId) ||
      left.found.localeCompare(right.found),
  );
}

export async function runAuditRequest(options: AuditRequestOptions = {}): Promise<AuditRequestResult> {
  const cwd = options.cwd ?? process.cwd();
  const scope = options.scope ?? 'staged';
  const maxFindings = Math.max(1, Math.min(options.maxFindings ?? 8, 50));
  const config = readConfig(cwd);

  let diff = '';
  let mode: 'staged' | 'scan' = 'staged';
  let prScan: { title: string; url: string; diff: string; files: Array<{ path: string; content: string }> } | undefined;
  let fileContent: ((filePath: string) => string) | undefined;

  try {
    if (scope !== 'files') {
      assertGitRepo(cwd);
    }
    if (scope === 'staged') {
      diff = getStagedDiff(cwd);
    } else if (scope === 'working') {
      diff = getUnstagedDiff(cwd);
      fileContent = (filePath) => readWorkingFile(cwd, filePath);
    } else if (scope === 'both') {
      const staged = getStagedDiff(cwd);
      const working = getUnstagedDiff(cwd);
      diff = [staged, working].filter(Boolean).join('\n\n');
      fileContent = (filePath) => readWorkingFile(cwd, filePath);
    } else if (scope === 'range') {
      if (!options.range) {
        throw new DesignMemoryError('DM_E_INVALID_INPUT', 'scope "range" requires a range such as "main...HEAD".');
      }
      diff = getRangeDiff(options.range, cwd);
      fileContent = (filePath) => readWorkingFile(cwd, filePath);
    } else if (scope === 'files') {
      const files = options.files ?? [];
      if (files.length === 0) {
        throw new DesignMemoryError('DM_E_INVALID_INPUT', 'scope "files" requires a non-empty files array.');
      }
      for (const file of files) {
        if (path.isAbsolute(file) || path.normalize(file).startsWith('..')) {
          throw new DesignMemoryError('DM_E_PATH_OUTSIDE_REPO', `file path ${file} must be inside the repository.`);
        }
      }
      const blocks = files.map((file) => {
        const content = readWorkingFile(cwd, file);
        const added = content
          .split('\n')
          .map((line) => `+${line}`)
          .join('\n');
        return `FILE: ${file}\n${added}`;
      });
      diff = blocks.join('\n\n');
      mode = 'scan';
      prScan = {
        title: 'files scope',
        url: '',
        diff,
        files: files.map((file) => ({ path: file, content: readWorkingFile(cwd, file) })),
      };
    }
  } catch (error) {
    if (isDesignMemoryError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    const combined = `${message}\n${stderr}`;
    if (/not a git repository/i.test(combined)) {
      throw new DesignMemoryError('DM_E_NOT_GIT', `${cwd} is not a git repository.`, {
        hint: 'Use scope "files" with explicit paths to audit without git.',
      });
    }
    throw new DesignMemoryError('DM_E_GIT_FAILED', `git failed: ${message}`, { cause: error });
  }

  const execution = await executeAudit(
    fileContent ? { getFileContent: (filePath: string) => fileContent?.(filePath) ?? '' } : {},
    {
      cwd,
      diff,
      mode,
      ...(prScan ? { prScan } : {}),
      persist: options.persist ?? false,
    },
  );

  const run = execution.run;
  const issues = sortIssues((run?.issues ?? []).map(compactIssue));
  const warnings = [...(run?.warnings ?? [])];

  return {
    scope,
    exitCode: execution.exitCode,
    wouldBlock: execution.blockingCount > 0 && config.strictness === 'block',
    skipped: execution.skipped,
    missingSnapshot: execution.missingSnapshot,
    summary: run
      ? {
          total: run.summary.totalIssues,
          error: run.summary.error,
          warn: run.summary.warn,
          byStatus: run.summary.byStatus,
        }
      : null,
    issues: issues.slice(0, maxFindings),
    totalIssues: issues.length,
    truncated: issues.length > maxFindings,
    ...(run?.comparison
      ? {
          comparison: {
            resolved: run.comparison.resolvedFingerprints.length,
            remaining: run.comparison.remainingFingerprints.length,
            new: run.comparison.newFingerprints.length,
            reopened: run.comparison.reopenedFingerprints.length,
          },
        }
      : {}),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export type ContextDetail = 'minimal' | 'standard' | 'full';

export type ContextRequest = {
  cwd?: string;
  paths: string[];
  task?: string;
  detail?: ContextDetail;
};

export type ContextToken = { path: string; value?: string; classHint: string };

export type ContextContract = {
  component: string;
  file?: string;
  required?: string[];
  disallowed?: string[];
  states?: string[];
};

export type ContextDecision = {
  id: string;
  kind: string;
  ruleId: string;
  target: string;
  reason: string;
  expiresAt?: string;
};

export type ContextResult = {
  summary: string;
  files: string[];
  tokens: ContextToken[];
  contracts: ContextContract[];
  decisions: ContextDecision[];
  rules: Array<{ id: string; severity: string }>;
  strictness: string;
  refs: string[];
  warnings: string[];
};

function assertRepoRelativePaths(cwd: string, paths: string[]) {
  for (const filePath of paths) {
    if (path.isAbsolute(filePath)) {
      throw new DesignMemoryError('DM_E_PATH_OUTSIDE_REPO', `path ${filePath} must be repo-relative.`);
    }
    const normalized = path.normalize(filePath);
    if (normalized.startsWith('..')) {
      throw new DesignMemoryError('DM_E_PATH_OUTSIDE_REPO', `path ${filePath} escapes the repository root.`);
    }
  }
}

function describeTargetShort(target: { file?: string; glob?: string; component?: string; tokenPath?: string; value?: string }) {
  return target.file ?? target.glob ?? target.component ?? target.tokenPath ?? target.value ?? 'target';
}

function tokenClassHint(token: ReferenceSnapshot['tokens'][number]) {
  return token.codeHints?.[0] ?? token.name;
}

function matchComponentsForPaths(
  snapshot: ReferenceSnapshot,
  files: Array<{ path: string; text: string }>,
): Array<{ component: ComponentReference; file: string }> {
  const matches = new Map<string, { component: ComponentReference; file: string }>();

  for (const file of files) {
    const stem = normalizeForMatch(path.basename(file.path).replace(/\.[^.]+$/, ''));
    const normalizedText = normalizeForMatch(file.text);

    for (const component of snapshot.components) {
      const candidates = uniqueStrings([component.name, ...(component.aliases ?? []), ...(component.codeMatches ?? [])]);
      const strong = candidates.some((candidate) => normalizeForMatch(candidate) === stem);
      const weak = !strong && candidates.some((candidate) => normalizedText.includes(normalizeForMatch(candidate)));
      if (strong || weak) {
        matches.set(`${component.name}::${file.path}`, { component, file: file.path });
      }
    }
  }

  return [...matches.values()].sort((left, right) => left.component.name.localeCompare(right.component.name));
}

export function getContext(request: ContextRequest): ContextResult {
  const cwd = request.cwd ?? process.cwd();
  const detail = request.detail ?? 'standard';
  const paths = request.paths.slice(0, 20);
  assertRepoRelativePaths(cwd, paths);

  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new DesignMemoryError('DM_E_NO_SNAPSHOT', 'No reference snapshot found.', {
      hint: 'Run `design-memory sync-reference` first.',
    });
  }

  const config = readConfig(cwd);
  const warnings: string[] = [];
  const files = paths.map((filePath) => {
    const absolute = path.resolve(cwd, filePath);
    try {
      return { path: filePath, text: fs.readFileSync(absolute, 'utf-8') };
    } catch {
      return { path: filePath, text: '' };
    }
  });

  const usedTokens = new Set<string>();
  const usedText = new Set<string>();
  for (const file of files) {
    if (!file.text) continue;
    const usages = extractStyleUsages(file.text, scriptKindForFile(file.path));
    for (const token of usages.classTokens) usedTokens.add(normalizeForMatch(token.value));
    for (const prop of usages.styleProps) usedTokens.add(normalizeForMatch(prop.value));
    usedText.add(file.text.toLowerCase());
  }

  const tokenRefs: ContextToken[] = [];
  for (const token of snapshot.tokens) {
    const candidates = uniqueStrings([token.name, ...(token.aliases ?? []), ...(token.codeHints ?? [])]);
    const isUsed = candidates.some((candidate) => {
      const normalized = normalizeForMatch(candidate);
      if (!normalized) return false;
      if ([...usedTokens].some((used) => used.includes(normalized) || normalized.includes(used))) return true;
      return [...usedText].some((text) => text.includes(candidate.toLowerCase()));
    });
    if (isUsed) {
      tokenRefs.push({ path: token.name, ...(token.value ? { value: token.value } : {}), classHint: tokenClassHint(token) });
    }
  }
  tokenRefs.sort((left, right) => left.path.localeCompare(right.path));

  const componentMatches = matchComponentsForPaths(snapshot, files);
  const contractRefs: ContextContract[] = componentMatches.map(({ component, file }) => ({
    component: component.name,
    file,
    ...(component.requiredPatterns?.length ? { required: [...component.requiredPatterns].sort() } : {}),
    ...(component.disallowedPatterns?.length ? { disallowed: [...component.disallowedPatterns].sort() } : {}),
    ...(component.states?.length ? { states: component.states.map((state) => state.name).sort() } : {}),
  }));

  const loaded = loadDecisionStore(cwd, { throwOnCorrupt: false });
  warnings.push(...loaded.warnings);
  const ctx = buildLifecycleContext(cwd);
  const evaluated = evaluateDecisions(loaded.store.decisions, ctx);
  const decisionMap = new Map<string, ContextDecision>();
  for (const file of files) {
    for (const decision of decisionsForPath(evaluated, { file: file.path })) {
      decisionMap.set(decision.id, {
        id: decision.id,
        kind: decision.kind,
        ruleId: decision.ruleId,
        target: describeTargetShort(decision.target),
        reason: decision.reason,
        ...(decision.expiresAt ? { expiresAt: decision.expiresAt } : {}),
      });
    }
  }
  for (const { component, file } of componentMatches) {
    for (const decision of decisionsForPath(evaluated, { component: component.name, file })) {
      decisionMap.set(decision.id, {
        id: decision.id,
        kind: decision.kind,
        ruleId: decision.ruleId,
        target: describeTargetShort(decision.target),
        reason: decision.reason,
        ...(decision.expiresAt ? { expiresAt: decision.expiresAt } : {}),
      });
    }
  }
  const decisions = [...decisionMap.values()].sort((left, right) => left.id.localeCompare(right.id));

  const rules = Object.entries(config.rules)
    .filter(([, severity]) => severity !== 'ignore')
    .map(([id, severity]) => ({ id, severity: String(severity) }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const limitedTokens = detail === 'minimal' ? [] : tokenRefs.slice(0, detail === 'full' ? tokenRefs.length : 25);
  const limitedDecisions = detail === 'minimal' ? [] : decisions.slice(0, detail === 'full' ? decisions.length : 10);
  const limitedContracts = detail === 'minimal' ? [] : contractRefs;

  const summaryParts = [
    `${limitedContracts.length} contracts`,
    `${limitedTokens.length} tokens`,
    `${limitedDecisions.length} decisions`,
  ];
  if (request.task) {
    summaryParts.push(`task: ${request.task.slice(0, 80)}`);
  }

  return {
    summary: `${summaryParts.join(', ')} for ${paths.length} file(s)`,
    files: paths,
    tokens: limitedTokens,
    contracts: limitedContracts,
    decisions: limitedDecisions,
    rules,
    strictness: config.strictness,
    refs: [
      'dm://tokens',
      'dm://decisions',
      ...(limitedContracts[0] ? [`dm://contracts/${limitedContracts[0].component}`] : []),
    ],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const TOKEN_KIND_BY_TYPE: Record<string, string> = {
  color: 'color',
  spacing: 'spacing',
  radius: 'borderRadius',
  fontSize: 'fontSize',
  shadow: 'shadow',
  fontFamily: 'fontFamily',
};

export type TokenListRequest = {
  cwd?: string;
  type?: string;
  prefix?: string;
  detail?: 'index' | 'values';
  limit?: number;
};

export type TokenListResult = {
  tokens: Array<{ path: string; value?: string; classHint: string; kind?: string }>;
  total: number;
  types: string[];
};

export function getTokens(request: TokenListRequest = {}): TokenListResult {
  const cwd = request.cwd ?? process.cwd();
  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new DesignMemoryError('DM_E_NO_SNAPSHOT', 'No reference snapshot found.', {
      hint: 'Run `design-memory sync-reference` first.',
    });
  }

  const kindFilter = request.type ? TOKEN_KIND_BY_TYPE[request.type] : undefined;
  if (request.type && !kindFilter && request.type !== 'other') {
    throw new DesignMemoryError('DM_E_UNKNOWN_KIND', `Unknown token type "${request.type}".`, {
      hint: `Supported types: ${Object.keys(TOKEN_KIND_BY_TYPE).join(', ')}, other.`,
    });
  }

  const prefix = (request.prefix ?? '').toLowerCase();
  const limit = Math.max(1, Math.min(request.limit ?? 40, 200));

  const filtered = snapshot.tokens
    .filter((token) => (kindFilter ? token.kind === kindFilter : true))
    .filter((token) => (prefix ? token.name.toLowerCase().startsWith(prefix) : true))
    .sort((left, right) => left.name.localeCompare(right.name));

  const includeValues = (request.detail ?? 'index') === 'values';

  return {
    tokens: filtered.slice(0, limit).map((token) => ({
      path: token.name,
      ...(includeValues && token.value ? { value: token.value } : {}),
      classHint: tokenClassHint(token),
      ...(token.kind ? { kind: token.kind } : {}),
    })),
    total: filtered.length,
    types: [...new Set(snapshot.tokens.map((token) => token.kind).filter((kind): kind is string => Boolean(kind)))].sort(),
  };
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export type ContractRequest = {
  cwd?: string;
  component?: string;
  file?: string;
};

export type ContractResult = {
  component: string;
  file?: string;
  summary?: string;
  required?: string[];
  disallowed?: string[];
  states?: string[];
  variants?: string[];
  tokensUsed?: string[];
  decisions: ContextDecision[];
};

export function getContract(request: ContractRequest): ContractResult {
  const cwd = request.cwd ?? process.cwd();
  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new DesignMemoryError('DM_E_NO_SNAPSHOT', 'No reference snapshot found.', {
      hint: 'Run `design-memory sync-reference` first.',
    });
  }
  if (!request.component && !request.file) {
    throw new DesignMemoryError('DM_E_INVALID_INPUT', 'Provide either a component name or a file path.');
  }

  const byComponent = request.component ? normalizeForMatch(request.component) : null;
  const fileStem = request.file ? normalizeForMatch(path.basename(request.file).replace(/\.[^.]+$/, '')) : null;

  const candidates = snapshot.components.map((component) => {
    const names = uniqueStrings([component.name, ...(component.aliases ?? []), ...(component.codeMatches ?? [])]).map(normalizeForMatch);
    let score = 0;
    if (byComponent) {
      if (names.includes(byComponent)) score = 1;
      else if (names.some((name) => name.includes(byComponent) || byComponent.includes(name))) score = 0.6;
    }
    if (fileStem) {
      if (names.includes(fileStem)) score = Math.max(score, 1);
      else if (names.some((name) => name.includes(fileStem) || fileStem.includes(name))) score = Math.max(score, 0.6);
    }
    return { component, score };
  });

  const best = candidates.filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score)[0];
  if (!best) {
    const query = byComponent ?? fileStem ?? '';
    const near = snapshot.components
      .filter((component) => normalizeForMatch(component.name).includes(query) || query.includes(normalizeForMatch(component.name)))
      .slice(0, 5)
      .map((component) => component.name);
    throw new DesignMemoryError('DM_E_COMPONENT_NOT_FOUND', `No component contract matched "${request.component ?? request.file}".`, {
      details: { near },
      hint: near.length > 0 ? `Close matches: ${near.join(', ')}` : 'Run sync-reference to refresh component contracts.',
    });
  }

  const component = best.component;
  const loaded = loadDecisionStore(cwd, { throwOnCorrupt: false });
  const ctx = buildLifecycleContext(cwd);
  const evaluated = evaluateDecisions(loaded.store.decisions, ctx);
  const decisions = decisionsForPath(evaluated, {
    ...(request.file ? { file: request.file } : {}),
    component: component.name,
  }).map((decision) => ({
    id: decision.id,
    kind: decision.kind,
    ruleId: decision.ruleId,
    target: describeTargetShort(decision.target),
    reason: decision.reason,
    ...(decision.expiresAt ? { expiresAt: decision.expiresAt } : {}),
  }));

  return {
    component: component.name,
    ...(request.file ? { file: request.file } : {}),
    ...(component.summary ? { summary: component.summary } : {}),
    ...(component.requiredPatterns?.length ? { required: [...component.requiredPatterns].sort() } : {}),
    ...(component.disallowedPatterns?.length ? { disallowed: [...component.disallowedPatterns].sort() } : {}),
    ...(component.states?.length ? { states: component.states.map((state) => state.name).sort() } : {}),
    ...(component.variants?.length ? { variants: component.variants.map((variant) => variant.name).sort() } : {}),
    ...(component.tokensUsed?.length ? { tokensUsed: [...component.tokensUsed].sort() } : {}),
    decisions,
  };
}

// ---------------------------------------------------------------------------
// Token suggestion
// ---------------------------------------------------------------------------

const SUGGEST_KIND_BY_TYPE: Record<string, string> = {
  color: 'color',
  spacing: 'spacing',
  radius: 'borderRadius',
  fontSize: 'fontSize',
  shadow: 'shadow',
};

export type SuggestRequest = {
  cwd?: string;
  value: string;
  kind: string;
  context?: string;
};

export type SuggestResult = {
  value: string;
  exact?: { path: string; value: string; classHint: string };
  near: Array<{ path: string; value: string; classHint: string; score: number }>;
};

export function suggestToken(request: SuggestRequest): SuggestResult {
  const cwd = request.cwd ?? process.cwd();
  const kind = SUGGEST_KIND_BY_TYPE[request.kind];
  if (!kind) {
    throw new DesignMemoryError('DM_E_UNKNOWN_KIND', `Unknown suggestion kind "${request.kind}".`, {
      hint: `Supported kinds: ${Object.keys(SUGGEST_KIND_BY_TYPE).join(', ')}.`,
    });
  }
  if (!request.value.trim()) {
    throw new DesignMemoryError('DM_E_INVALID_INPUT', 'value is required.');
  }

  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new DesignMemoryError('DM_E_NO_SNAPSHOT', 'No reference snapshot found.', {
      hint: 'Run `design-memory sync-reference` first.',
    });
  }

  const scoped = snapshot.tokens.filter((token) => token.kind === kind);
  const ranked = rankClosestTokens(scoped, request.value, 3);

  const exactToken = scoped.find((token) => {
    const candidates = uniqueStrings([token.value, ...(token.aliases ?? []), ...(token.codeHints ?? [])]);
    return candidates.some((candidate) => candidate.toLowerCase() === request.value.trim().toLowerCase());
  });

  let results = ranked.map((entry) => ({
    path: entry.token.name,
    value: entry.token.value ?? '',
    classHint: tokenClassHint(entry.token),
    score: entry.score,
  }));

  if (request.context) {
    const contextText = readWorkingFile(cwd, request.context).toLowerCase();
    if (contextText) {
      const boosted = results.filter((entry) => contextText.includes(entry.classHint.toLowerCase()));
      const rest = results.filter((entry) => !contextText.includes(entry.classHint.toLowerCase()));
      results = [...boosted, ...rest];
    }
  }

  return {
    value: request.value,
    ...(exactToken
      ? {
          exact: {
            path: exactToken.name,
            value: exactToken.value ?? '',
            classHint: tokenClassHint(exactToken),
          },
        }
      : {}),
    near: results,
  };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type DecisionsQuery = ListDecisionsOptions & { cwd?: string };

export function listDecisionsQuery(request: DecisionsQuery = {}) {
  const { cwd, ...options } = request;
  const result = listDecisions(cwd, options);
  return {
    total: result.total,
    decisions: result.decisions.map((decision) => ({
      id: decision.id,
      kind: decision.kind,
      status: decision.status,
      ruleId: decision.ruleId,
      target: describeTargetShort(decision.target),
      reason: decision.reason.length > 160 ? `${decision.reason.slice(0, 157)}...` : decision.reason,
      createdAt: decision.createdAt,
      ...(decision.expiresAt ? { expiresAt: decision.expiresAt } : {}),
      ...(decision.supersedes ? { supersedes: decision.supersedes } : {}),
    })),
    warnings: result.warnings,
  };
}

export async function recordDecisionRequest(
  request: RecordDecisionInput & { cwd?: string },
): Promise<RecordDecisionResult & { decisionSummary: string }> {
  const { cwd, ...input } = request;
  const result = await recordDecision(input, cwd);
  return {
    ...result,
    decisionSummary: `${result.action} ${result.decision.id}: ${result.effect.suppresses}`,
  };
}

export function getRules(cwd = process.cwd()) {
  const config: DesignMemoryConfig = readConfig(cwd);
  return {
    strictness: config.strictness,
    baselineMode: config.baseline.mode,
    rules: Object.entries(config.rules)
      .map(([id, severity]) => ({ id, severity: String(severity) }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}
