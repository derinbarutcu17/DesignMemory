import fs from 'node:fs';
import path from 'node:path';

import { runAuditRequest } from '../src/lib/api';
import { readConfig, shouldAuditFile } from '../src/lib/config';

const cwd = path.resolve(process.argv[2] ?? 'apps/procure-dash');

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === '.design-memory') continue;
      walk(absolute, files);
    } else if (entry.isFile()) {
      files.push(path.relative(cwd, absolute).split(path.sep).join('/'));
    }
  }
  return files;
}

const config = readConfig(cwd);
const candidates = walk(path.join(cwd, 'src')).filter((file) => shouldAuditFile(file, config));

async function main() {
  const result = await runAuditRequest({
    cwd,
    scope: 'files',
    files: candidates,
    persist: true,
    createBaseline: true,
    maxFindings: 50,
  });

  console.log(`[baseline] files: ${candidates.length}`);
  console.log(`[baseline] findings accepted: ${result.totalIssues}`);
  for (const issue of result.issues) {
    console.log(`[baseline]  - ${issue.ruleId} ${issue.file}${issue.line ? `:${issue.line}` : ''} (${issue.status})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
