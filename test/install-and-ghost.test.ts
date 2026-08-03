import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { installHook } from '../src/cli/install';
import { ghostConfig } from '../src/cli/ghost';
import { makeRepoRoot, makeTempDir } from './helpers';
import { saveReferenceSnapshot } from '../src/lib/state';

const SNAPSHOT = {
  metadata: {
    source: 'design-md',
    versionLabel: 'DESIGN.md',
    importedAt: new Date().toISOString(),
    tokenCount: 2,
    componentCount: 1,
  },
  tokens: [
    { name: 'color.primary', kind: 'color', value: '#2563eb', codeHints: ['bg-primary'] },
    { name: 'spacing.md', kind: 'spacing', value: '16px', codeHints: ['p-md'] },
  ],
  components: [
    {
      name: 'Button',
      requiredPatterns: ['bg-primary'],
      states: [{ name: 'hover' }],
      variants: [{ name: 'primary' }],
    },
  ],
};

test('installHook writes the pre-commit hook with executable permissions', async () => {
  const cwd = makeRepoRoot();
  const ambientCwd = makeTempDir('design-memory-ambient-');
  const previous = process.cwd();
  process.chdir(ambientCwd);
  try {
    await installHook(cwd);
  } finally {
    process.chdir(previous);
  }

  const hookPath = path.join(cwd, '.git', 'hooks', 'pre-commit');
  const hookContent = fs.readFileSync(hookPath, 'utf-8');
  assert.match(hookContent, /design-memory audit/);
  assert.match(hookContent, /git commit --no-verify/);
  assert.equal(fs.statSync(hookPath).mode & 0o777, 0o755);
  assert.ok(fs.existsSync(path.join(cwd, 'design-memory.config.json')));
  assert.ok(fs.existsSync(path.join(cwd, '.design-memory')));
});

test('ghostConfig dry-run plans the agent pack and --write creates all targets', async () => {
  const cwd = makeRepoRoot();
  const ambientCwd = makeTempDir('design-memory-ambient-');
  const previous = process.cwd();
  process.chdir(ambientCwd);
  try {
    saveReferenceSnapshot(SNAPSHOT, cwd);
    const dryRun = await ghostConfig(cwd, {});
    assert.equal(dryRun.dryRun, true);
    assert.ok(dryRun.targets.includes('.cursor/rules/design.mdc'));
    assert.ok(dryRun.targets.includes('AGENTS.md'));
    assert.ok(dryRun.targets.includes('design-tokens.md'));
    assert.ok(!fs.existsSync(path.join(cwd, 'CLAUDE.md')));

    await ghostConfig(cwd, { write: true });
    const mdc = fs.readFileSync(path.join(cwd, '.cursor', 'rules', 'design.mdc'), 'utf-8');
    assert.match(mdc, /bg-primary/);
    assert.match(mdc, /Violations are enforced by: design-memory audit/);
    const claude = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.match(claude, /design-memory:start/);
    assert.equal(claude.match(/design-memory:start/g)!.length, 1);

    await ghostConfig(cwd, { write: true });
    const claudeAgain = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf-8');
    assert.equal(claudeAgain.match(/design-memory:start/g)!.length, 1);
    assert.match(claudeAgain, /Violations are enforced by: design-memory audit/);
  } finally {
    process.chdir(previous);
  }
});
