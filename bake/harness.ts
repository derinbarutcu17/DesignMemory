import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runAuditRequest, type AuditRequestResult, type AuditScope } from '../src/lib/api';
import { syncReference } from '../src/lib/reference';
import { recordDecisionSync } from '../src/lib/memory/store';
import { loadLatestRun } from '../src/lib/state';

export const REPO_ROOT = path.resolve(__dirname, '..');
export const DEMO_APP = path.join(REPO_ROOT, 'apps/procure-dash');

export type Mutation =
  | { kind: 'replace'; file: string; find: string; replace: string }
  | { kind: 'append'; file: string; content: string }
  | { kind: 'write'; file: string; content: string };

export type BakeScenario = {
  id: string;
  title: string;
  prompt: string;
  setup?: (sandbox: string) => void | Promise<void>;
  mutations: Mutation[];
  scope?: AuditScope;
  stage?: boolean;
  expect: {
    exitCode?: number;
    wouldBlock?: boolean;
    missingSnapshot?: boolean;
    errorCode?: string;
    issues?: Array<{ ruleId: string; status: string; file: string }>;
    absentRuleIds?: string[];
  };
  maxDurationMs?: number;
};

export type ScenarioResult = {
  id: string;
  title: string;
  passed: boolean;
  failures: string[];
  durationMs: number;
  audit?: AuditRequestResult;
};

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function copyDir(source: string, target: string) {
  const skip = new Set(['node_modules', 'dist', '.git', '.design-memory']);
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

const SEED_DECISIONS = [
  {
    kind: 'exception' as const,
    ruleId: 'color.raw-hex',
    target: { glob: 'src/ui/SupplierMark.tsx' },
    reason: 'Vendor brand marks use their official palette so partner logos stay recognizable in dense tables.',
    author: 'human:derin',
  },
  {
    kind: 'intentional' as const,
    ruleId: 'tailwind.arbitrary-font-size',
    target: { file: 'src/ui/DataTable.tsx', value: '13px' },
    reason: 'Dense numeric columns use a 13px step for scanability across supplier rows, reviewed by design.',
    author: 'human:derin',
    tokenDependency: ['fontSize.sm'],
  },
  {
    kind: 'decision' as const,
    ruleId: 'component.variant-drift',
    target: { component: 'StatusBadge' },
    reason: 'Risk levels are fixed to three tiers by procurement policy, so extra badge variants stay out of scope.',
    author: 'human:derin',
  },
];

export async function makeSandbox(prefix = 'dm-bake-') {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  copyDir(DEMO_APP, sandbox);
  git(['init', '-q'], sandbox);
  git(['config', 'user.email', 'bake@example.com'], sandbox);
  git(['config', 'user.name', 'Bake'], sandbox);
  await syncReference(sandbox);

  const files = walk(path.join(sandbox, 'src')).map((file) => path.relative(sandbox, file).split(path.sep).join('/'));
  await runAuditRequest({ cwd: sandbox, scope: 'files', files, persist: true, createBaseline: true, maxFindings: 50 });
  for (const seed of SEED_DECISIONS) {
    recordDecisionSync(seed, sandbox);
  }

  git(['add', '-A'], sandbox);
  git(['commit', '-qm', 'baseline state'], sandbox);
  return sandbox;
}

function walk(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, files);
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function applyMutation(sandbox: string, mutation: Mutation) {
  const target = path.join(sandbox, mutation.file);
  if (mutation.kind === 'append') {
    fs.appendFileSync(target, mutation.content);
    return;
  }
  if (mutation.kind === 'write') {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, mutation.content);
    return;
  }
  const content = fs.readFileSync(target, 'utf-8');
  if (!content.includes(mutation.find)) {
    throw new Error(`mutation find text not present in ${mutation.file}`);
  }
  fs.writeFileSync(target, content.replace(mutation.find, mutation.replace));
}

export async function runScenario(scenario: BakeScenario): Promise<ScenarioResult> {
  const started = Date.now();
  const failures: string[] = [];
  const sandbox = await makeSandbox(`dm-bake-${scenario.id}-`);
  let audit: AuditRequestResult | undefined;

  try {
    if (scenario.setup) {
      await scenario.setup(sandbox);
    }

    for (const mutation of scenario.mutations) {
      applyMutation(sandbox, mutation);
    }

    if (scenario.stage !== false) {
      git(['add', '-A'], sandbox);
    }

    if (scenario.expect.errorCode) {
      try {
        audit = await runAuditRequest({
          cwd: sandbox,
          scope: scenario.scope ?? 'staged',
          maxFindings: 50,
          persist: true,
        });
        failures.push(`expected error ${scenario.expect.errorCode} but the audit completed`);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== scenario.expect.errorCode) {
          failures.push(`expected error ${scenario.expect.errorCode}, got ${code ?? 'unknown'}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return {
        id: scenario.id,
        title: scenario.title,
        passed: failures.length === 0,
        failures,
        durationMs: Date.now() - started,
      };
    }

    audit = await runAuditRequest({
      cwd: sandbox,
      scope: scenario.scope ?? 'staged',
      maxFindings: 50,
      persist: true,
    });

    const expect = scenario.expect;
    if (expect.exitCode !== undefined && audit.exitCode !== expect.exitCode) {
      failures.push(`exitCode expected ${expect.exitCode}, got ${audit.exitCode}`);
    }
    if (expect.wouldBlock !== undefined && audit.wouldBlock !== expect.wouldBlock) {
      failures.push(`wouldBlock expected ${expect.wouldBlock}, got ${audit.wouldBlock}`);
    }
    if (expect.missingSnapshot !== undefined && audit.missingSnapshot !== expect.missingSnapshot) {
      failures.push(`missingSnapshot expected ${expect.missingSnapshot}, got ${audit.missingSnapshot}`);
    }
    for (const expected of expect.issues ?? []) {
      const found = audit.issues.find(
        (issue) => issue.ruleId === expected.ruleId && issue.file === expected.file && issue.status === expected.status,
      );
      if (!found) {
        const actual = audit.issues
          .filter((issue) => issue.ruleId === expected.ruleId || issue.file === expected.file)
          .map((issue) => `${issue.ruleId}@${issue.file}:${issue.status}`)
          .join(', ');
        failures.push(`missing issue ${expected.ruleId}@${expected.file} status ${expected.status} (saw: ${actual || 'nothing'})`);
      }
    }
    for (const ruleId of expect.absentRuleIds ?? []) {
      if (audit.issues.some((issue) => issue.ruleId === ruleId)) {
        failures.push(`rule ${ruleId} should not appear but did`);
      }
    }
    if (scenario.maxDurationMs && Date.now() - started > scenario.maxDurationMs) {
      failures.push(`scenario exceeded ${scenario.maxDurationMs}ms`);
    }
  } catch (error) {
    failures.push(`threw: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    id: scenario.id,
    title: scenario.title,
    passed: failures.length === 0,
    failures,
    durationMs: Date.now() - started,
    ...(audit ? { audit } : {}),
  };
}

export function latestRunIssues(sandbox: string) {
  return loadLatestRun(sandbox)?.issues ?? [];
}
