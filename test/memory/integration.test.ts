import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { runAudit } from '../../src/lib/audit';
import { expireDecision, recordDecisionSync } from '../../src/lib/memory/store';
import type { AuditRun } from '../../src/lib/types';
import { makeTempDir, writeConfig, writeSnapshot } from '../helpers';

const DIFF = 'FILE: src/components/Button.tsx\n+ className="bg-[#ff0000]"\n';
const CONTENT = 'export function Button() { return <button className="bg-[#ff0000]" />; }';

function makeCwd() {
  const cwd = makeTempDir('design-memory-integration-');
  writeConfig(cwd);
  writeSnapshot(cwd);
  fs.mkdirSync(path.join(cwd, 'src/components'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src/components/Button.tsx'), `${CONTENT}\n`);
  return cwd;
}

async function audit(cwd: string) {
  let exitCode: number | undefined;
  await runAudit(
    {
      getDiff: () => DIFF,
      getFileContent: () => CONTENT,
      exit: ((code?: number) => {
        exitCode = code;
        return undefined as never;
      }) as typeof process.exit,
    },
    { cwd },
  );
  const latest = JSON.parse(fs.readFileSync(path.join(cwd, '.design-memory', 'latest-run.json'), 'utf-8')) as AuditRun;
  return { exitCode, latest };
}

test('decision memory suppresses a finding, expiry reopens it', async () => {
  const cwd = makeCwd();

  const first = await audit(cwd);
  assert.equal(first.exitCode, 1);
  const rawHex = first.latest.issues.find((issue) => issue.ruleId === 'color.raw-hex');
  assert.ok(rawHex);

  recordDecisionSync(
    {
      kind: 'intentional',
      ruleId: 'color.raw-hex',
      target: { file: 'src/components/Button.tsx', value: rawHex.found },
      reason: 'Brand hero keeps a dedicated red for campaign artwork.',
      author: 'human:test',
    },
    cwd,
  );

  const second = await audit(cwd);
  assert.equal(second.exitCode, 0);
  const suppressed = second.latest.issues.find((issue) => issue.ruleId === 'color.raw-hex');
  assert.equal(suppressed?.status, 'intentional');
  assert.ok(suppressed?.suppressedBy);

  await expireDecision(suppressed.suppressedBy as string, cwd);

  const third = await audit(cwd);
  assert.equal(third.exitCode, 1);
  const reopened = third.latest.issues.find((issue) => issue.ruleId === 'color.raw-hex');
  assert.equal(reopened?.status, 'reopened');
});

test('exception decisions mark findings ignored without blocking', async () => {
  const cwd = makeCwd();

  // Content that satisfies the Button contract so the raw hex is the only finding.
  const diff = 'FILE: src/components/Button.tsx\n+ className="bg-[#ff0000] hover:bg-primary"\n';
  const content = 'export function Button() { return <button className="bg-[#ff0000] hover:bg-primary" />; }';
  fs.writeFileSync(path.join(cwd, 'src/components/Button.tsx'), `${content}\n`);

  recordDecisionSync(
    {
      kind: 'exception',
      ruleId: 'color.raw-hex',
      target: { glob: 'src/components/**', value: 'bg-[#ff0000]' },
      reason: 'Temporary campaign palette is accepted for this quarter.',
      author: 'human:test',
    },
    cwd,
  );

  let exitCode: number | undefined;
  await runAudit(
    {
      getDiff: () => diff,
      getFileContent: () => content,
      exit: ((code?: number) => {
        exitCode = code;
        return undefined as never;
      }) as typeof process.exit,
    },
    { cwd },
  );

  assert.equal(exitCode, 0);
  const latest = JSON.parse(fs.readFileSync(path.join(cwd, '.design-memory', 'latest-run.json'), 'utf-8')) as AuditRun;
  const issue = latest.issues.find((entry) => entry.ruleId === 'color.raw-hex');
  assert.equal(issue?.status, 'ignored');
});

test('token dependency invalidation reopens the finding after a token change', async () => {
  const cwd = makeCwd();

  const first = await audit(cwd);
  const issue = first.latest.issues.find((entry) => entry.ruleId === 'color.raw-hex');
  assert.ok(issue);

  recordDecisionSync(
    {
      kind: 'intentional',
      ruleId: 'color.raw-hex',
      target: { file: 'src/components/Button.tsx', value: issue.found },
      reason: 'Matches the legacy button palette until the refresh ships.',
      author: 'human:test',
      tokenDependency: ['color.button.primary'],
    },
    cwd,
  );

  const second = await audit(cwd);
  assert.equal(second.exitCode, 0);

  // Change the token value the decision depends on and re-sync the snapshot.
  const snapshotPath = path.join(cwd, '.design-memory', 'reference-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  snapshot.tokens[0].value = '#123456';
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

  const third = await audit(cwd);
  assert.equal(third.exitCode, 1);
  const reopened = third.latest.issues.find((entry) => entry.ruleId === 'color.raw-hex');
  assert.equal(reopened?.status, 'reopened');
});
