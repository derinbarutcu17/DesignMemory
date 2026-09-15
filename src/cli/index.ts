#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';

import { compareRuns, loadLatestRunJson, reviewFinding, runAudit, scanPullRequest } from '../lib/audit';
import { syncReference } from '../lib/reference';
import { installHook } from './install';
import { ghostConfig } from './ghost';
import { loadReviews } from '../lib/state';
import { prettyJson } from '../lib/utils';
import { toErrorPayload } from '../lib/errors';
import { expireDecision, listDecisions, recordDecision, repairMemory } from '../lib/memory/store';
import type { DecisionKind } from '../lib/memory/schema';

export const program = new Command();

function resolveCwd(cwd?: string) {
  return cwd ? path.resolve(cwd) : process.cwd();
}

function fail(error: unknown, json?: boolean): never {
  const payload = toErrorPayload(error);
  if (json) {
    console.log(prettyJson({ error: payload }));
  } else {
    console.error(`[Design Memory] ${payload.message}`);
    if (payload.hint) {
      console.error(`[Design Memory] Hint: ${payload.hint}`);
    }
  }
  process.exit(payload.code === 'DM_E_NO_SNAPSHOT' ? 2 : 1);
}

program
  .name('design-memory')
  .description('Blocks net-new design policy violations and reference mismatches in React/Tailwind PRs with deterministic checks first.')
  .version('0.4.0');

export const auditCommand = program
  .command('audit')
  .description('Audit staged UI changes against the synced reference snapshot')
  .option('--cwd <path>', 'Repository path to audit')
  .option('--create-baseline', 'Create a baseline from the current findings')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, createBaseline, json }: { cwd?: string; createBaseline?: boolean; json?: boolean }) => {
    try {
      await runAudit({}, { cwd: resolveCwd(cwd), createBaseline, json });
    } catch (error) {
      fail(error, json);
    }
  });

export const initCommand = program
  .command('init')
  .description('Install the pre-commit hook and write the default config')
  .option('--cwd <path>', 'Repository path to initialize')
  .action(async ({ cwd }: { cwd?: string }) => {
    try {
      await installHook(resolveCwd(cwd));
    } catch (error) {
      fail(error);
    }
  });

export const syncReferenceCommand = program
  .command('sync-reference')
  .description('Normalize the configured design source into a canonical reference snapshot')
  .option('--cwd <path>', 'Repository path to sync')
  .action(async ({ cwd }: { cwd?: string }) => {
    try {
      const result = await syncReference(resolveCwd(cwd));
      console.log(`[Design Memory] Reference synced from ${result.snapshot.metadata.source}.`);
      console.log(`[Design Memory] Tokens: ${result.snapshot.metadata.tokenCount ?? result.snapshot.tokens.length}`);
      console.log(`[Design Memory] Components: ${result.snapshot.metadata.componentCount ?? result.snapshot.components.length}`);
      console.log(`[Design Memory] Output: ${result.outputPath}`);
    } catch (error) {
      fail(error);
    }
  });

export const ghostCommand = program
  .command('ghost')
  .description('Generate the agent design pack (rules files, DESIGN.md, token reference) from the snapshot')
  .option('--cwd <path>', 'Repository path to update')
  .option('--write', 'Write targets (default is a dry-run plan)')
  .option('--format <format>', 'Generate only a single artifact: design-md')
  .action(async ({ cwd, write, format }: { cwd?: string; write?: boolean; format?: 'design-md' }) => {
    try {
      await ghostConfig(resolveCwd(cwd), { write, format });
    } catch (error) {
      fail(error);
    }
  });

export const scanCommand = program
  .command('scan')
  .description('Run a non-blocking PR audit against a GitHub pull request')
  .option('--cwd <path>', 'Repository path to scan')
  .requiredOption('--pr <number>', 'Pull request number to scan')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, pr, json }: { cwd?: string; pr: string; json?: boolean }) => {
    try {
      await scanPullRequest(Number(pr), resolveCwd(cwd), { json });
    } catch (error) {
      fail(error, json);
    }
  });

export const reviewCommand = program
  .command('review')
  .description('List or update review decisions for the latest run')
  .option('--cwd <path>', 'Repository path to inspect')
  .option('--fingerprint <value>', 'Finding fingerprint to review')
  .option('--status <value>', 'Review status: intentional or ignore')
  .option('--note <value>', 'Optional note for the review decision')
  .option('--export', 'Export the review ledger as a markdown report')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, fingerprint, status, note, export: exportLedger, json }: { cwd?: string; fingerprint?: string; status?: 'intentional' | 'ignore'; note?: string; export?: boolean; json?: boolean }) => {
    try {
      if (fingerprint && status) {
        const review = reviewFinding(fingerprint, status, note, resolveCwd(cwd));
        console.log(json ? prettyJson(review) : `[Design Memory] Stored ${status} review for ${fingerprint}.`);
        return;
      }

      const targetCwd = resolveCwd(cwd);
      if (exportLedger) {
        const reviews = loadReviews(targetCwd);
        const latest = loadLatestRunJson(targetCwd);
        const issueByFingerprint = new Map(latest.issues.map((issue) => [issue.fingerprint, issue]));
        const rows = Object.entries(reviews.reviews).map(([fp, review]) => {
          const issue = issueByFingerprint.get(fp);
          const location = issue ? `${issue.filePath}${issue.line ? `:${issue.line}` : ''}` : 'not in latest run';
          const rule = issue?.ruleId ?? '-';
          return `| ${fp} | ${rule} | ${location} | ${review.status} | ${(review.note ?? '').replace(/\|/g, '\\|')} | ${review.updatedAt} |`;
        });
        console.log(`# Design Memory Review Ledger

Decisions stored: ${rows.length}. An \`intentional\` review keeps the finding out of future blocking runs.

| Fingerprint | Rule | File:Line | Status | Note | Updated |
| --- | --- | --- | --- | --- | --- |
${rows.join('\n')}
`);
        return;
      }

      const latest = loadLatestRunJson(targetCwd);
      console.log(json ? prettyJson(latest.issues) : latest.issues.map((issue) => `${issue.fingerprint} ${issue.status} ${issue.filePath} ${issue.ruleId}`).join('\n'));
    } catch (error) {
      fail(error, json);
    }
  });

export const compareCommand = program
  .command('compare')
  .description('Compare the latest run against the previous run/baseline')
  .option('--cwd <path>', 'Repository path to inspect')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, json }: { cwd?: string; json?: boolean }) => {
    try {
      const comparison = compareRuns(resolveCwd(cwd));
      if (json) {
        console.log(prettyJson(comparison));
      } else {
        console.log('[Design Memory] Run comparison:');
        console.log(`  Resolved: ${comparison.resolvedFingerprints.length}`);
        console.log(`  Remaining: ${comparison.remainingFingerprints.length}`);
        console.log(`  New: ${comparison.newFingerprints.length}`);
        console.log(`  Reopened: ${comparison.reopenedFingerprints.length}`);
      }
    } catch (error) {
      fail(error, json);
    }
  });

const memoryCommand = program
  .command('memory')
  .description('Manage decision memory: list, add, expire, repair');

memoryCommand
  .command('list')
  .description('List decision memory entries')
  .option('--cwd <path>', 'Repository path to inspect')
  .option('--status <value>', 'Filter: active, expired, invalidated, superseded, all', 'active')
  .option('--rule <value>', 'Filter by rule id')
  .option('--path <value>', 'Filter by file path')
  .option('--component <value>', 'Filter by component name')
  .option('--limit <number>', 'Max entries', '50')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, status, rule, path: filePath, component, limit, json }: { cwd?: string; status?: string; rule?: string; path?: string; component?: string; limit?: string; json?: boolean }) => {
    try {
      const result = listDecisions(resolveCwd(cwd), {
        status: (status as 'active' | 'expired' | 'invalidated' | 'superseded' | 'all') ?? 'active',
        ...(rule ? { ruleId: rule } : {}),
        ...(filePath ? { path: filePath } : {}),
        ...(component ? { component } : {}),
        limit: Number(limit ?? 50),
      });
      if (json) {
        console.log(prettyJson(result));
        return;
      }
      if (result.decisions.length === 0) {
        console.log('[Design Memory] No decisions found.');
        return;
      }
      for (const decision of result.decisions) {
        const target = decision.target.file ?? decision.target.glob ?? decision.target.component ?? decision.target.tokenPath ?? decision.target.value ?? decision.target.fingerprint ?? '-';
        console.log(`${decision.id} [${decision.status}] ${decision.kind} ${decision.ruleId} -> ${target}`);
        console.log(`  reason: ${decision.reason}`);
        if (decision.expiresAt) console.log(`  expires: ${decision.expiresAt}`);
      }
      console.log(`[Design Memory] ${result.total} decision(s).`);
    } catch (error) {
      fail(error, json);
    }
  });

memoryCommand
  .command('add')
  .description('Record a decision so a reviewed finding stops blocking')
  .option('--cwd <path>', 'Repository path')
  .option('--kind <value>', 'intentional, exception, or decision', 'decision')
  .option('--rule <value>', 'Rule id or *', '*')
  .option('--file <value>', 'Repo-relative file target')
  .option('--glob <value>', 'Glob target, for example src/legacy/**')
  .option('--component <value>', 'Component name target')
  .option('--token <value>', 'DTCG token path target')
  .option('--value <value>', 'Specific offending value target, for example 13px')
  .option('--fingerprint <value>', 'Exact finding fingerprint target')
  .option('--reason <value>', 'Why this deviation is intentional (10-500 chars)')
  .option('--author <value>', 'Who recorded this', 'human:cli')
  .option('--expires <value>', 'ISO date when the decision expires')
  .option('--token-dep <paths...>', 'Token paths that invalidate this decision when changed')
  .option('--supersedes <id>', 'Decision id to supersede')
  .option('--dry-run', 'Preview without writing')
  .option('--json', 'Print machine-readable JSON output')
  .action(async (options) => {
    try {
      if (!options.reason) {
        const { DesignMemoryError } = await import('../lib/errors.js');
        throw new DesignMemoryError('DM_E_INVALID_INPUT', '--reason is required.');
      }
      const result = await recordDecision(
        {
          kind: options.kind as DecisionKind,
          ruleId: options.rule,
          target: {
            ...(options.file ? { file: options.file } : {}),
            ...(options.glob ? { glob: options.glob } : {}),
            ...(options.component ? { component: options.component } : {}),
            ...(options.token ? { tokenPath: options.token } : {}),
            ...(options.value ? { value: options.value } : {}),
            ...(options.fingerprint ? { fingerprint: options.fingerprint } : {}),
          },
          reason: options.reason,
          author: options.author,
          ...(options.expires ? { expiresAt: options.expires } : {}),
          ...(options.tokenDep ? { tokenDependency: options.tokenDep } : {}),
          ...(options.supersedes ? { supersedes: options.supersedes } : {}),
          dryRun: Boolean(options.dryRun),
        },
        resolveCwd(options.cwd),
      );
      if (options.json) {
        console.log(prettyJson(result));
      } else {
        console.log(`[Design Memory] ${result.action}: ${result.decision.id}. Suppresses ${result.effect.suppresses}.`);
        console.log(`[Design Memory] Current findings suppressed: ${result.suppressesNow}.`);
      }
    } catch (error) {
      fail(error, options.json);
    }
  });

memoryCommand
  .command('expire')
  .description('Expire a decision by id')
  .option('--cwd <path>', 'Repository path')
  .requiredOption('--id <value>', 'Decision id')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, id, json }: { cwd?: string; id: string; json?: boolean }) => {
    try {
      const updated = await expireDecision(id, resolveCwd(cwd));
      if (json) {
        console.log(prettyJson(updated));
      } else {
        console.log(`[Design Memory] Decision ${updated.id} expired.`);
      }
    } catch (error) {
      fail(error, json);
    }
  });

memoryCommand
  .command('repair')
  .description('Rebuild decision memory from the append log when decisions.json is corrupt')
  .option('--cwd <path>', 'Repository path')
  .option('--json', 'Print machine-readable JSON output')
  .action(async ({ cwd, json }: { cwd?: string; json?: boolean }) => {
    try {
      const report = await repairMemory(resolveCwd(cwd));
      if (json) {
        console.log(prettyJson(report));
      } else if (!report.repaired) {
        console.log('[Design Memory] Decision memory is healthy; nothing to repair.');
      } else {
        console.log(`[Design Memory] Repaired: recovered ${report.recovered} decision(s), dropped ${report.droppedLines} log line(s).`);
        if (report.backupPath) console.log(`[Design Memory] Backup of the corrupt file: ${report.backupPath}`);
      }
    } catch (error) {
      fail(error, json);
    }
  });

program
  .command('mcp')
  .description('Start the Design Memory MCP server on stdio for coding agents')
  .option('--cwd <path>', 'Default repository root for all tools')
  .action(async ({ cwd }: { cwd?: string }) => {
    try {
      const { startMcpServer } = await import('../mcp/server.js');
      await startMcpServer(cwd ? { cwd: path.resolve(cwd) } : {});
    } catch (error) {
      fail(error);
    }
  });

program.parse(process.argv);
