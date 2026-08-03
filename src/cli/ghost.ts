import fs from 'node:fs';
import path from 'node:path';

import { loadReferenceSnapshot } from '../lib/state';
import { generateAgentPack, SECTION_END, SECTION_START } from '../lib/ghost/generate';

type GhostOptions = {
  cwd?: string;
  write?: boolean;
  format?: 'design-md';
};

function wrapSection(content: string) {
  return `${SECTION_START}\n${content}\n${SECTION_END}`;
}

function writeSectionFile(filePath: string, content: string) {
  const section = wrapSection(content);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${section}\n`);
    return 'created';
  }

  const existing = fs.readFileSync(filePath, 'utf-8');
  if (existing.includes(SECTION_START)) {
    const updated = existing.replace(
      new RegExp(`${SECTION_START}[\\s\\S]*?${SECTION_END}`),
      section,
    );
    fs.writeFileSync(filePath, updated);
    return 'updated';
  }

  fs.writeFileSync(filePath, `${existing.replace(/\s*$/, '')}\n\n${section}\n`);
  return 'updated';
}

export async function ghostConfig(cwd = process.cwd(), options: GhostOptions = {}) {
  const snapshot = loadReferenceSnapshot(cwd);
  if (!snapshot) {
    throw new Error('No reference snapshot found. Run `design-memory sync-reference` first.');
  }

  const pack = generateAgentPack(snapshot);

  if (options.format === 'design-md') {
    if (options.write) {
      fs.writeFileSync(path.join(cwd, 'DESIGN.md'), pack['DESIGN.md']);
      console.log('[Design Memory] Wrote DESIGN.md.');
    } else {
      console.log(pack['DESIGN.md']);
    }
    return { dryRun: !options.write, targets: ['DESIGN.md'] };
  }

  const existingCursorRules = fs.existsSync(path.join(cwd, '.cursorrules'));
  const plan = [
    ...Object.entries(pack)
      .filter(([target]) => target !== 'DESIGN.md' && target !== '.cursorrules')
      .map(([target]) => ({
        target,
        status: fs.existsSync(path.join(cwd, target)) ? 'would update' : 'would create',
      })),
  ];
  if (existingCursorRules) {
    plan.push({ target: '.cursorrules', status: 'would update' });
  }

  if (!options.write) {
    console.log('[Design Memory] Ghost plan (dry run, use --write to apply):');
    for (const entry of plan) {
      console.log(`  ${entry.status} ${entry.target}`);
    }
    return { dryRun: true, targets: [...plan.map((entry) => entry.target), 'DESIGN.md'] };
  }

  const writeTargets = [...plan.map((entry) => entry.target), 'DESIGN.md'];
  for (const target of writeTargets) {
    const targetPath = path.join(cwd, target);
    if (target === '.clinerules' || target === 'CLAUDE.md' || target === 'AGENTS.md' || target === '.github/copilot-instructions.md') {
      console.log(`[Design Memory] ${writeSectionFile(targetPath, pack[target])} ${target}`);
    } else {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, pack[target]);
      console.log(`[Design Memory] wrote ${target}`);
    }
  }
  return { dryRun: false, targets: writeTargets };
}
