import test from 'node:test';
import assert from 'node:assert/strict';

import { extractStyleUsages, scriptKindForFile } from '../src/lib/ast';

function tokenValues(source: string) {
  return extractStyleUsages(source, scriptKindForFile('Component.tsx')).classTokens.map((token) => token.value);
}

test('extractStyleUsages reads plain className strings', () => {
  const values = tokenValues('export function A() { return <div className="bg-primary p-3" />; }');
  assert.deepEqual(values, ['bg-primary', 'p-3']);
});

test('extractStyleUsages reads cn() helper calls with static strings', () => {
  const source = `
    import { cn } from './cn';
    export function A({ active }: { active: boolean }) {
      return <div className={cn('bg-surface text-sm', active && 'border-primary', 'p-[9px]')} />;
    }
  `;
  const values = tokenValues(source);
  assert.ok(values.includes('bg-surface'));
  assert.ok(values.includes('text-sm'));
  assert.ok(values.includes('border-primary'));
  assert.ok(values.includes('p-[9px]'), 'arbitrary value inside cn() is visible to the audit');
});

test('extractStyleUsages reads clsx and template helpers but ignores unknown calls', () => {
  const values = tokenValues(`
    export function A() {
      return (
        <div className={clsx('m-1', computeClass())} data-x={cn('ignored-inside-attribute')} />
      );
    }
  `);
  assert.ok(values.includes('m-1'));
  assert.ok(!values.includes('ignored-inside-attribute'));
});

test('extractStyleUsages keeps template literal heads with dynamic segments', () => {
  const values = tokenValues('export function A({ size }: { size: string }) { return <div className={`text-sm ${size}`} />; }');
  assert.ok(values.includes('text-sm'));
});

test('extractStyleUsages still flags inline style objects', () => {
  const usages = extractStyleUsages('export function A() { return <div style={{ marginTop: 9, color: "#ff0000" }} />; }');
  assert.equal(usages.inlineStyleCount, 1);
  assert.deepEqual(usages.styleProps.map((prop) => prop.key), ['marginTop', 'color']);
});
