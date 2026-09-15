import test from 'node:test';
import assert from 'node:assert/strict';

import { makeTempDir, writeConfig, writeSnapshot } from '../helpers';
import { evaluateDecisions } from '../../src/lib/memory/lifecycle';
import { findDecisionForIssue, decisionsForPath } from '../../src/lib/memory/lookup';
import type { Decision } from '../../src/lib/memory/schema';

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'dec_000000000001',
    kind: 'intentional',
    status: 'active',
    ruleId: 'color.raw-hex',
    target: { file: 'src/components/Button.tsx' },
    reason: 'A reason long enough to satisfy the schema.',
    author: 'human:test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    fingerprint: 'fp-one',
    ...overrides,
  };
}

function makeIssue(overrides: Partial<Parameters<typeof findDecisionForIssue>[0]> = {}) {
  return {
    fingerprint: 'fp-one',
    ruleId: 'color.raw-hex',
    filePath: 'src/components/Button.tsx',
    componentName: 'Button',
    found: 'bg-[#ff0000]',
    suggestedAction: 'Replace bg-[#ff0000] with bg-primary (token color.button.primary)',
    ...overrides,
  };
}

test('lookup: fingerprint target beats file target', () => {
  const fileDecision = makeDecision({ id: 'dec_000000000002', target: { file: 'src/components/Button.tsx' } });
  const fpDecision = makeDecision({ id: 'dec_000000000003', target: { fingerprint: 'fp-one' } });

  const match = findDecisionForIssue(makeIssue(), [fileDecision, fpDecision]);
  assert.equal(match?.decisionId, fpDecision.id);
  assert.equal(match?.specificity, 0);
});

test('lookup: file plus value beats file only', () => {
  const fileOnly = makeDecision({ id: 'dec_000000000004', target: { file: 'src/components/Button.tsx' } });
  const fileValue = makeDecision({
    id: 'dec_000000000005',
    target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' },
  });

  const match = findDecisionForIssue(makeIssue(), [fileOnly, fileValue]);
  assert.equal(match?.decisionId, fileValue.id);
  assert.equal(match?.specificity, 1);
});

test('lookup: glob and component targets match, expired decisions do not', () => {
  const globDecision = makeDecision({
    id: 'dec_000000000006',
    target: { glob: 'src/components/**' },
  });
  const componentDecision = makeDecision({
    id: 'dec_000000000007',
    target: { component: 'Button' },
  });
  assert.equal(findDecisionForIssue(makeIssue(), [globDecision])?.decisionId, globDecision.id);
  assert.equal(findDecisionForIssue(makeIssue(), [componentDecision])?.decisionId, componentDecision.id);

  const expired = makeDecision({ id: 'dec_000000000008', status: 'expired' });
  assert.equal(findDecisionForIssue(makeIssue(), [expired]), null);
});

test('lookup: rule scoping and "*" wildcard', () => {
  const wrongRule = makeDecision({ id: 'dec_000000000009', ruleId: 'style.inline' });
  assert.equal(findDecisionForIssue(makeIssue(), [wrongRule]), null);

  const wildcard = makeDecision({ id: 'dec_00000000000a', ruleId: '*' });
  assert.equal(findDecisionForIssue(makeIssue(), [wildcard])?.decisionId, wildcard.id);
});

test('decisionsForPath returns file, glob, and component matches', () => {
  const byFile = makeDecision({ id: 'dec_00000000000b', target: { file: 'src/components/Button.tsx' } });
  const byGlob = makeDecision({ id: 'dec_00000000000c', target: { glob: 'src/components/**' } });
  const byComponent = makeDecision({ id: 'dec_00000000000d', target: { component: 'Button' } });
  const unrelated = makeDecision({ id: 'dec_00000000000e', target: { file: 'src/components/Card.tsx' } });

  const matches = decisionsForPath([byFile, byGlob, byComponent, unrelated], {
    file: 'src/components/Button.tsx',
    component: 'Button',
  });
  const ids = matches.map((decision) => decision.id);
  assert.ok(ids.includes(byFile.id));
  assert.ok(ids.includes(byGlob.id));
  assert.ok(ids.includes(byComponent.id));
  assert.ok(!ids.includes(unrelated.id));
});

test('lifecycle: token dependency invalidation and file deletion invalidation', () => {
  const cwd = makeTempDir('design-memory-lifecycle-');
  writeConfig(cwd);
  writeSnapshot(cwd);

  const stale = makeDecision({
    id: 'dec_00000000000f',
    target: { file: 'src/components/Button.tsx', value: 'bg-[#ff0000]' },
    tokenRefs: [{ path: 'color.button.primary', valueAtCreation: '#00ff00' }],
  });
  const missingFile = makeDecision({
    id: 'dec_000000000010',
    target: { file: 'src/components/Missing.tsx' },
  });

  const evaluated = evaluateDecisions([stale, missingFile], {
    now: new Date('2026-06-01T00:00:00.000Z'),
    tokenValues: new Map([['color.button.primary', '#111111']]),
    fileExists: () => false,
  });

  assert.equal(evaluated.find((decision) => decision.id === stale.id)?.status, 'invalidated');
  assert.equal(evaluated.find((decision) => decision.id === missingFile.id)?.status, 'invalidated');
});

test('lifecycle: expiry wins over everything except superseded', () => {
  const expired = makeDecision({ id: 'dec_000000000011', expiresAt: '2026-01-02T00:00:00.000Z' });
  const superseded = makeDecision({ id: 'dec_000000000012', status: 'superseded' });

  const evaluated = evaluateDecisions([expired, superseded], {
    now: new Date('2026-06-01T00:00:00.000Z'),
    tokenValues: new Map(),
    fileExists: () => true,
  });

  assert.equal(evaluated.find((decision) => decision.id === expired.id)?.status, 'expired');
  assert.equal(evaluated.find((decision) => decision.id === superseded.id)?.status, 'superseded');
});
