import test from 'node:test';
import assert from 'node:assert/strict';

import { rankClosestTokens } from '../src/lib/tokens/closest';
import type { ReferenceToken } from '../src/lib/types';

const COLORS: ReferenceToken[] = [
  { name: 'color.info', kind: 'color', value: '#0e7490' },
  { name: 'color.text', kind: 'color', value: '#0f172a' },
  { name: 'color.primary', kind: 'color', value: '#1d4ed8' },
];

test('hex values never use numeric proximity, so leading digits cannot fake a match', () => {
  const ranked = rankClosestTokens(COLORS, '#0f766e', 3);
  assert.ok(ranked.length > 0);
  assert.equal(ranked[0].token.name, 'color.info');
  assert.ok(ranked[0].score < 1, `expected a partial score, got ${ranked[0].score}`);
  assert.notEqual(ranked[0].token.name, 'color.text');
});

test('exact hex still wins with score 1', () => {
  const ranked = rankClosestTokens(COLORS, '#0e7490', 3);
  assert.equal(ranked[0].token.name, 'color.info');
  assert.equal(ranked[0].score, 1);
});

test('numeric proximity still works for spacing values', () => {
  const spacing: ReferenceToken[] = [
    { name: 'spacing.3', kind: 'spacing', value: '12px' },
    { name: 'spacing.6', kind: 'spacing', value: '24px' },
  ];
  const ranked = rankClosestTokens(spacing, '13px', 3);
  assert.equal(ranked[0].token.name, 'spacing.3');
  assert.ok(ranked[0].score > 0.9);
});
