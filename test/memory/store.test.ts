import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { makeTempDir, writeConfig, writeSnapshot } from '../helpers';
import { DesignMemoryError } from '../../src/lib/errors';
import { loadDecisionStore, expireDecision, recordDecisionSync, repairMemory, listDecisions } from '../../src/lib/memory/store';
import { decisionStoreSchema } from '../../src/lib/memory/schema';

function makeCwd() {
  const cwd = makeTempDir('design-memory-memory-');
  writeConfig(cwd);
  writeSnapshot(cwd);
  fs.mkdirSync(path.join(cwd, 'src/components'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src/components/Button.tsx'), 'export function Button() { return null; }\n');
  fs.writeFileSync(path.join(cwd, 'src/components/Card.tsx'), 'export function Card() { return null; }\n');
  return cwd;
}

function decisionsPath(cwd: string) {
  return path.join(cwd, '.design-memory', 'decisions.json');
}

test('recordDecisionSync creates a decision and dedupes on the same fingerprint', () => {
  const cwd = makeCwd();

  const first = recordDecisionSync(
    {
      kind: 'intentional',
      ruleId: 'color.raw-hex',
      target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' },
      reason: 'Marketing hero keeps its dedicated brand red.',
      author: 'human:test',
    },
    cwd,
  );
  assert.equal(first.action, 'created');
  assert.match(first.decision.id, /^dec_[0-9a-f]{12}$/);

  const second = recordDecisionSync(
    {
      kind: 'intentional',
      ruleId: 'color.raw-hex',
      target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' },
      reason: 'Marketing hero keeps its dedicated brand red, updated note.',
      author: 'human:test',
    },
    cwd,
  );
  assert.equal(second.action, 'updated');
  assert.equal(second.decision.id, first.decision.id);

  const store = JSON.parse(fs.readFileSync(decisionsPath(cwd), 'utf-8'));
  assert.equal(decisionStoreSchema.safeParse(store).success, true);
  assert.equal(store.decisions.length, 1);
});

test('recordDecisionSync validates reason and target', () => {
  const cwd = makeCwd();

  assert.throws(
    () =>
      recordDecisionSync(
        { kind: 'intentional', ruleId: '*', target: { file: 'src/components/Button.tsx' }, reason: 'n/a', author: 'human:test' },
        cwd,
      ),
    (error: unknown) => error instanceof DesignMemoryError && error.code === 'DM_E_INVALID_INPUT',
  );

  assert.throws(
    () => recordDecisionSync({ kind: 'intentional', ruleId: '*', target: {}, reason: 'A perfectly fine reason.', author: 'human:test' }, cwd),
    (error: unknown) => error instanceof DesignMemoryError && error.code === 'DM_E_INVALID_INPUT',
  );
});

test('dryRun previews without writing', () => {
  const cwd = makeCwd();
  const result = recordDecisionSync(
    {
      kind: 'decision',
      ruleId: 'tailwind.arbitrary-spacing',
      target: { component: 'Input' },
      reason: 'Compact variant keeps a fixed 9px inset by design.',
      author: 'human:test',
      dryRun: true,
    },
    cwd,
  );
  assert.equal(result.action, 'dry-run');
  assert.equal(fs.existsSync(decisionsPath(cwd)), false);
});

test('supersede sets the previous decision to superseded and blocks double supersede', () => {
  const cwd = makeCwd();
  const base = recordDecisionSync(
    { kind: 'intentional', ruleId: 'color.raw-hex', target: { file: 'src/components/Button.tsx' }, reason: 'Temporary marketing exception.', author: 'human:test' },
    cwd,
  );

  const replacer = recordDecisionSync(
    {
      kind: 'decision',
      ruleId: 'color.raw-hex',
      target: { file: 'src/components/Button.tsx' },
      reason: 'Replaced by the brand refresh token rollout.',
      author: 'human:test',
      supersedes: base.decision.id,
    },
    cwd,
  );
  assert.equal(replacer.action, 'superseded');

  const listed = listDecisions(cwd, { status: 'all', limit: 10 });
  const superseded = listed.decisions.find((decision) => decision.id === base.decision.id);
  assert.equal(superseded?.status, 'superseded');

  assert.throws(
    () =>
      recordDecisionSync(
        {
          kind: 'decision',
          ruleId: 'color.raw-hex',
          target: { file: 'src/components/Button.tsx' },
          reason: 'Attempting to supersede an already superseded decision.',
          author: 'human:test',
          supersedes: base.decision.id,
        },
        cwd,
      ),
    (error: unknown) => error instanceof DesignMemoryError && error.code === 'DM_E_SUPERSEDE_INVALID',
  );
});

test('expireDecision keeps the record but marks it expired', async () => {
  const cwd = makeCwd();
  const created = recordDecisionSync(
    { kind: 'exception', ruleId: 'style.inline', target: { file: 'src/components/Card.tsx' }, reason: 'Legacy animation requires an inline transform.', author: 'human:test' },
    cwd,
  );

  await expireDecision(created.decision.id, cwd, 'cleanup');

  const active = listDecisions(cwd, { status: 'active', limit: 10 });
  assert.equal(active.decisions.length, 0);
  const expired = listDecisions(cwd, { status: 'expired', limit: 10 });
  assert.equal(expired.decisions.length, 1);
  assert.equal(expired.decisions[0].id, created.decision.id);
});

test('corrupt decisions.json surfaces a warning and repair rebuilds from the log', async () => {
  const cwd = makeCwd();
  recordDecisionSync(
    { kind: 'intentional', ruleId: 'color.raw-hex', target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' }, reason: 'Recorded before the corruption test.', author: 'human:test' },
    cwd,
  );
  fs.writeFileSync(decisionsPath(cwd), '{"version":2,"decisions":[{"id":');

  const loaded = loadDecisionStore(cwd);
  assert.equal(loaded.corrupt, true);
  assert.ok(loaded.warnings.some((warning) => /corrupt/i.test(warning)));
  assert.equal(loaded.store.decisions.length, 1);
  assert.equal(loadDecisionStore(cwd).corrupt, false);

  // Corrupt again to exercise the manual repair path from the append log.
  fs.writeFileSync(decisionsPath(cwd), '{"version":2,"decisions":[{"id":');

  const report = await repairMemory(cwd);
  assert.equal(report.repaired, true);
  assert.equal(report.recovered, 1);
  assert.ok(report.backupPath && fs.existsSync(report.backupPath));

  const repaired = loadDecisionStore(cwd);
  assert.equal(repaired.corrupt, false);
  assert.equal(repaired.store.decisions.length, 1);
});

test('decision limit rejects new entries once the active cap is reached', () => {
  const cwd = makeCwd();
  const decisions = Array.from({ length: 500 }, (_, index) => ({
    id: `dec_${String(index).padStart(12, '0')}`,
    kind: 'decision' as const,
    status: 'active' as const,
    ruleId: 'color.raw-hex',
    target: { glob: 'src/components/**' },
    reason: `Generated decision number ${index} for the limit test.`,
    author: 'human:test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fingerprint: `fp_${index}`,
  }));
  fs.mkdirSync(path.join(cwd, '.design-memory'), { recursive: true });
  fs.writeFileSync(decisionsPath(cwd), `${JSON.stringify({ version: 2, decisions }, null, 2)}\n`);

  assert.throws(
    () =>
      recordDecisionSync(
        { kind: 'decision', ruleId: 'color.raw-hex', target: { file: 'src/components/OneMore.tsx' }, reason: 'This should hit the active decision limit.', author: 'human:test' },
        cwd,
      ),
    (error: unknown) => error instanceof DesignMemoryError && error.code === 'DM_E_DECISION_LIMIT',
  );
});
