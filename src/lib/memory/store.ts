import fs from 'node:fs';
import path from 'node:path';

import { getStateDir, matchesGlob, readConfig } from '../config';
import { DesignMemoryError } from '../errors';
import { loadLatestRun, loadReferenceSnapshot, loadReviews } from '../state';
import { hashParts } from '../utils';
import { buildLifecycleContext, evaluateDecisions } from './lifecycle';
import { findDecisionForIssue } from './lookup';
import {
  MAX_ACTIVE_DECISIONS,
  buildDecisionFingerprint,
  decisionStoreSchema,
  emptyDecisionStore,
  validateReason,
  type Decision,
  type DecisionKind,
  type DecisionLogEntry,
  type DecisionStore,
  type DecisionTarget,
} from './schema';

export type MemoryPaths = {
  root: string;
  decisions: string;
  log: string;
  lock: string;
};

export type LoadedDecisionStore = {
  store: DecisionStore;
  warnings: string[];
  migrated: number;
  corrupt: boolean;
};

export type RecordDecisionInput = {
  kind: DecisionKind;
  ruleId: string;
  target: DecisionTarget;
  reason: string;
  author: string;
  expiresAt?: string;
  tokenDependency?: string[];
  supersedes?: string;
  evidence?: { pr?: number; commit?: string; runId?: string };
  dryRun?: boolean;
};

export type RecordDecisionResult = {
  action: 'created' | 'updated' | 'superseded' | 'dry-run';
  decision: Decision;
  effect: { suppresses: string };
  suppressesNow: number;
  warnings: string[];
};

export function getMemoryPaths(cwd = process.cwd()): MemoryPaths {
  const config = readConfig(cwd);
  const root = getStateDir(cwd, config);
  return {
    root,
    decisions: path.join(root, 'decisions.json'),
    log: path.join(root, 'decisions.log.jsonl'),
    lock: path.join(root, '.write.lock'),
  };
}

function ensureDir(target: string) {
  fs.mkdirSync(target, { recursive: true });
}

export function appendDecisionLog(entries: DecisionLogEntry[], cwd = process.cwd()) {
  if (entries.length === 0) {
    return;
  }
  const paths = getMemoryPaths(cwd);
  ensureDir(paths.root);
  const payload = entries.map((entry) => JSON.stringify(entry)).join('\n');
  fs.appendFileSync(paths.log, `${payload}\n`);
}

function readLogDecisions(cwd: string) {
  const paths = getMemoryPaths(cwd);
  if (!fs.existsSync(paths.log)) {
    return { decisions: [] as Decision[], skipped: 0 };
  }

  const seen = new Map<string, Decision>();
  let skipped = 0;
  for (const rawLine of fs.readFileSync(paths.log, 'utf-8').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as DecisionLogEntry;
      if (!entry.decision) continue;
      const parsed = decisionStoreSchema.shape.decisions.element.safeParse(entry.decision);
      if (!parsed.success) {
        skipped += 1;
        continue;
      }
      seen.set(parsed.data.id, parsed.data);
    } catch {
      skipped += 1;
    }
  }

  return { decisions: [...seen.values()], skipped };
}

function parseStore(raw: string): DecisionStore | null {
  try {
    const parsed = decisionStoreSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDecisionStore(store: DecisionStore, cwd = process.cwd(), logEntries: DecisionLogEntry[] = []) {
  const paths = getMemoryPaths(cwd);
  ensureDir(paths.root);
  const tmp = `${paths.decisions}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  fs.renameSync(tmp, paths.decisions);
  appendDecisionLog(logEntries, cwd);
}

function migrateFromReviews(cwd: string): { store: DecisionStore; migrated: number } {
  const reviews = loadReviews(cwd);
  const entries = Object.values(reviews.reviews);
  if (entries.length === 0) {
    return { store: emptyDecisionStore(), migrated: 0 };
  }

  const latest = loadLatestRun(cwd);
  const decisions: Decision[] = [];

  for (const review of entries) {
    const issue = latest?.issues.find((entry) => entry.fingerprint === review.fingerprint);
    const target: DecisionTarget = { fingerprint: review.fingerprint };
    if (issue) {
      target.file = issue.filePath;
      target.value = issue.found;
    }
    const ruleId = issue?.ruleId ?? '*';
    const fingerprint = buildDecisionFingerprint(ruleId, target);
    decisions.push({
      id: `dec_${hashParts([fingerprint, review.createdAt, 'migrated'])}`,
      kind: review.status === 'intentional' ? 'intentional' : 'exception',
      status: 'active',
      ruleId,
      target,
      reason: review.note && review.note.trim().length >= 10 ? review.note.trim() : 'Migrated from reviews.json (no note recorded).',
      author: 'migration:reviews-v1',
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      fingerprint,
    });
  }

  return { store: { version: 2, decisions }, migrated: decisions.length };
}

export function loadDecisionStore(
  cwd = process.cwd(),
  options: { throwOnCorrupt?: boolean } = {},
): LoadedDecisionStore {
  const paths = getMemoryPaths(cwd);
  const warnings: string[] = [];

  if (!fs.existsSync(paths.decisions)) {
    const { store, migrated } = migrateFromReviews(cwd);
    if (migrated > 0) {
      saveDecisionStore(store, cwd, [
        { t: new Date().toISOString(), op: 'migrate', note: `migrated ${migrated} reviews into decisions v2` },
      ]);
      warnings.push(`migrated ${migrated} review decisions into decision memory v2`);
    }
    return { store, warnings, migrated, corrupt: false };
  }

  const parsed = parseStore(fs.readFileSync(paths.decisions, 'utf-8'));
  if (parsed) {
    return { store: parsed, warnings, migrated: 0, corrupt: false };
  }

  const rebuilt = readLogDecisions(cwd);
  if (rebuilt.decisions.length > 0) {
    const store: DecisionStore = { version: 2, decisions: rebuilt.decisions };
    saveDecisionStore(store, cwd, [
      { t: new Date().toISOString(), op: 'repair', note: `auto-repaired from log (${rebuilt.decisions.length} decisions)` },
    ]);
    warnings.push('decision memory was corrupt and was auto-repaired from the append log');
    return { store, warnings, migrated: 0, corrupt: true };
  }

  if (options.throwOnCorrupt) {
    throw new DesignMemoryError('DM_E_MEMORY_CORRUPT', 'decision memory file is corrupt and the append log could not rebuild it.', {
      hint: 'Run `design-memory memory repair` to rebuild, or remove .design-memory/decisions.json to start fresh.',
    });
  }

  warnings.push('decision memory file is corrupt; decisions were ignored for this run');
  return { store: emptyDecisionStore(), warnings, migrated: 0, corrupt: true };
}

function withWriteQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(cwd: string) {
  const paths = getMemoryPaths(cwd);
  ensureDir(paths.root);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      fs.writeFileSync(paths.lock, `${process.pid} ${Date.now()}\n`, { flag: 'wx' });
      return;
    } catch {
      try {
        const stat = fs.statSync(paths.lock);
        if (Date.now() - stat.mtimeMs > 10_000) {
          fs.unlinkSync(paths.lock);
          continue;
        }
      } catch {
        continue;
      }
      await sleep(20);
    }
  }

  throw new DesignMemoryError('DM_E_MEMORY_CORRUPT', 'could not acquire the decision memory write lock.', {
    hint: 'Remove .design-memory/.write.lock if no other process is writing.',
  });
}

function releaseLock(cwd: string) {
  const paths = getMemoryPaths(cwd);
  try {
    fs.unlinkSync(paths.lock);
  } catch {
    // lock already gone
  }
}

function describeTarget(target: DecisionTarget) {
  if (target.file) return `file ${target.file}`;
  if (target.component) return `component ${target.component}`;
  if (target.glob) return `glob ${target.glob}`;
  if (target.tokenPath) return `token ${target.tokenPath}`;
  if (target.fingerprint) return `fingerprint ${target.fingerprint}`;
  if (target.value) return `value ${target.value}`;
  return 'target';
}

function validateTarget(target: DecisionTarget) {
  const hasScope =
    target.file || target.glob || target.component || target.tokenPath || target.value || target.fingerprint;
  if (!hasScope) {
    throw new DesignMemoryError('DM_E_INVALID_INPUT', 'decision target requires at least one of file, glob, component, tokenPath, value, or fingerprint.');
  }
  if (target.file && target.file.startsWith('/')) {
    throw new DesignMemoryError('DM_E_INVALID_INPUT', 'decision target.file must be a repo-relative path.');
  }
}

function resolveTokenRefs(paths: string[], cwd: string): Decision['tokenRefs'] {
  if (paths.length === 0) {
    return undefined;
  }
  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new DesignMemoryError('DM_E_NO_SNAPSHOT', 'token dependencies require a synced reference snapshot.', {
      hint: 'Run `design-memory sync-reference` first.',
    });
  }

  return paths.map((tokenPath) => {
    const token = snapshot.tokens.find((entry) => entry.name === tokenPath);
    if (!token) {
      throw new DesignMemoryError('DM_E_INVALID_INPUT', `token dependency ${tokenPath} was not found in the reference snapshot.`);
    }
    return { path: tokenPath, valueAtCreation: token.value ?? '' };
  });
}

function countSuppressedNow(cwd: string, decisions: Decision[]) {
  const latest = loadLatestRun(cwd);
  if (!latest) {
    return 0;
  }
  const ctx = buildLifecycleContext(cwd);
  const evaluated = evaluateDecisions(decisions, ctx);
  return latest.issues.filter((issue) => findDecisionForIssue(issue, evaluated)).length;
}

export function recordDecisionSync(input: RecordDecisionInput, cwd = process.cwd()): RecordDecisionResult {
    const reasonError = validateReason(input.reason);
    if (reasonError) {
      throw new DesignMemoryError('DM_E_INVALID_INPUT', reasonError);
    }
    validateTarget(input.target);

    if (!input.author.trim()) {
      throw new DesignMemoryError('DM_E_INVALID_INPUT', 'author is required.');
    }

    if (input.expiresAt) {
      const expiry = new Date(input.expiresAt).getTime();
      if (Number.isNaN(expiry)) {
        throw new DesignMemoryError('DM_E_INVALID_INPUT', 'expiresAt must be an ISO date string.');
      }
      if (expiry <= Date.now()) {
        throw new DesignMemoryError('DM_E_INVALID_INPUT', 'expiresAt must be in the future.');
      }
    }

    const loaded = loadDecisionStore(cwd, { throwOnCorrupt: true });
    const tokenRefs = resolveTokenRefs(input.tokenDependency ?? [], cwd);
    const fingerprint = buildDecisionFingerprint(input.ruleId, input.target);
    const now = new Date().toISOString();

    let working = [...loaded.store.decisions];
    const ctx = buildLifecycleContext(cwd);
    const evaluated = evaluateDecisions(working, ctx);
    const activeCount = evaluated.filter((decision) => decision.status === 'active').length;

    let action: RecordDecisionResult['action'] = 'created';
    let superseded: Decision | undefined;

    if (input.supersedes) {
      const target = evaluated.find((decision) => decision.id === input.supersedes);
      if (!target) {
        throw new DesignMemoryError('DM_E_SUPERSEDE_INVALID', `decision ${input.supersedes} was not found.`);
      }
      if (target.status === 'superseded') {
        throw new DesignMemoryError('DM_E_SUPERSEDE_INVALID', `decision ${input.supersedes} is already superseded; supersede the head of the chain instead.`);
      }
      if (target.status !== 'active') {
        throw new DesignMemoryError('DM_E_SUPERSEDE_INVALID', `decision ${input.supersedes} is ${target.status}; it does not need superseding.`);
      }
      superseded = { ...target, status: 'superseded', updatedAt: now };
      working = working.map((decision) => (decision.id === target.id ? superseded as Decision : decision));
      action = 'superseded';
    }

    const existingIndex = working.findIndex(
      (decision) => decision.fingerprint === fingerprint && decision.id !== superseded?.id,
    );

    const base: Decision = {
      id: `dec_${hashParts([fingerprint, now])}`,
      kind: input.kind,
      status: 'active',
      ruleId: input.ruleId,
      target: input.target,
      reason: input.reason.trim(),
      author: input.author.trim(),
      createdAt: now,
      updatedAt: now,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      ...(tokenRefs ? { tokenRefs } : {}),
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
      ...(input.evidence ? { evidence: input.evidence } : {}),
      fingerprint,
    };

    let decision: Decision = base;
    if (existingIndex >= 0) {
      const existing = working[existingIndex];
      decision = {
        ...existing,
        ...base,
        id: existing.id,
        createdAt: existing.createdAt,
      };
      working = working.map((entry, index) => (index === existingIndex ? decision : entry));
      if (action === 'created') {
        action = 'updated';
      }
    } else {
      if (activeCount >= MAX_ACTIVE_DECISIONS && action !== 'superseded') {
        throw new DesignMemoryError('DM_E_DECISION_LIMIT', `decision limit reached (${MAX_ACTIVE_DECISIONS} active).`, {
          hint: 'Expire or supersede old decisions before recording new ones.',
        });
      }
      working = [...working, decision];
    }

    const effect = { suppresses: `${decision.ruleId} on ${describeTarget(decision.target)}` };
    const suppressPreview = countSuppressedNow(cwd, working);

    if (input.dryRun) {
      return { action: 'dry-run', decision, effect, suppressesNow: suppressPreview, warnings: loaded.warnings };
    }

    const store: DecisionStore = { version: 2, decisions: working };
    const logEntries: DecisionLogEntry[] = [];
    if (superseded) {
      logEntries.push({ t: now, op: 'supersede', decision: superseded });
    }
    logEntries.push({ t: now, op: action === 'updated' ? 'update' : 'create', decision });
    saveDecisionStore(store, cwd, logEntries);

    return { action, decision, effect, suppressesNow: suppressPreview, warnings: loaded.warnings };
}

export async function recordDecision(input: RecordDecisionInput, cwd = process.cwd()): Promise<RecordDecisionResult> {
  return withWriteQueue(async () => {
    await acquireLock(cwd);
    try {
      return recordDecisionSync(input, cwd);
    } finally {
      releaseLock(cwd);
    }
  });
}

export async function expireDecision(id: string, cwd = process.cwd(), note?: string): Promise<Decision> {
  return withWriteQueue(async () => {
    await acquireLock(cwd);
    try {
      const loaded = loadDecisionStore(cwd, { throwOnCorrupt: true });
      const existing = loaded.store.decisions.find((decision) => decision.id === id);
      if (!existing) {
        throw new DesignMemoryError('DM_E_INVALID_INPUT', `decision ${id} was not found.`);
      }
      const now = new Date().toISOString();
      const updated: Decision = { ...existing, expiresAt: now, updatedAt: now };
      const store: DecisionStore = {
        version: 2,
        decisions: loaded.store.decisions.map((decision) => (decision.id === id ? updated : decision)),
      };
      saveDecisionStore(store, cwd, [{ t: now, op: 'expire', decision: updated, note }]);
      return updated;
    } finally {
      releaseLock(cwd);
    }
  });
}

export type MemoryRepairReport = {
  repaired: boolean;
  recovered: number;
  droppedLines: number;
  backupPath?: string;
};

export async function repairMemory(cwd = process.cwd()): Promise<MemoryRepairReport> {
  return withWriteQueue(async () => {
    const paths = getMemoryPaths(cwd);
    if (!fs.existsSync(paths.decisions)) {
      return { repaired: false, recovered: 0, droppedLines: 0 };
    }

    const raw = fs.readFileSync(paths.decisions, 'utf-8');
    if (parseStore(raw)) {
      return { repaired: false, recovered: 0, droppedLines: 0 };
    }

    const backupPath = `${paths.decisions}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.copyFileSync(paths.decisions, backupPath);

    const rebuilt = readLogDecisions(cwd);
    const store: DecisionStore = { version: 2, decisions: rebuilt.decisions };
    saveDecisionStore(store, cwd, [
      { t: new Date().toISOString(), op: 'repair', note: `manual repair recovered ${rebuilt.decisions.length} decisions` },
    ]);

    return {
      repaired: true,
      recovered: rebuilt.decisions.length,
      droppedLines: rebuilt.skipped,
      backupPath,
    };
  });
}

export type ListDecisionsOptions = {
  status?: Decision['status'] | 'all';
  ruleId?: string;
  path?: string;
  component?: string;
  limit?: number;
};

export function listDecisions(cwd = process.cwd(), options: ListDecisionsOptions = {}) {
  const loaded = loadDecisionStore(cwd, { throwOnCorrupt: true });
  const ctx = buildLifecycleContext(cwd);
  const evaluated = evaluateDecisions(loaded.store.decisions, ctx);

  const status = options.status ?? 'active';
  const filtered = evaluated
    .filter((decision) => (status === 'all' ? true : decision.status === status))
    .filter((decision) => (options.ruleId ? decision.ruleId === options.ruleId || decision.ruleId === '*' : true))
    .filter((decision) => {
      if (!options.path && !options.component) return true;
      const target = decision.target;
      if (options.path && target.file === options.path) return true;
      if (options.path && target.glob && matchesGlob(options.path, target.glob)) return true;
      if (options.component && target.component === options.component) return true;
      return false;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));

  const limit = Math.max(1, Math.min(options.limit ?? 50, 200));
  return {
    decisions: filtered.slice(0, limit),
    total: filtered.length,
    warnings: loaded.warnings,
  };
}

export function loadDecisionsForAudit(cwd: string) {
  const loaded = loadDecisionStore(cwd, { throwOnCorrupt: false });
  const ctx = buildLifecycleContext(cwd);
  return {
    decisions: evaluateDecisions(loaded.store.decisions, ctx),
    warnings: loaded.warnings,
  };
}
