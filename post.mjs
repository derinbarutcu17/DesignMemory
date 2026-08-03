#!/usr/bin/env node
// Design Memory GitHub Action reporter.
// Turns the audit run JSON into workflow annotations + step summary, and
// fails the job when strictness=block and net-new error findings exist.
import fs from 'node:fs';

const runFile = process.env.DM_RUN_FILE;
const strictness = process.env.DM_STRICTNESS ?? 'block';
const summaryFile = process.env.GITHUB_STEP_SUMMARY;

if (!runFile || !fs.existsSync(runFile)) {
  console.log('Design Memory: no audit run file, skipping report.');
  process.exit(0);
}

const raw = fs.readFileSync(runFile, 'utf-8');
const run = JSON.parse(raw.slice(raw.indexOf('{')));
const blocking = run.issues.filter(
  (issue) => issue.severity === 'error' && (issue.status === 'new' || issue.status === 'reopened'),
);

const clean = (value) => String(value).replace(/\r?\n/g, ' ').trim();

for (const issue of run.issues) {
  const command = issue.severity === 'error' ? 'error' : 'warning';
  const props = [`file=${clean(issue.filePath)}`];
  if (issue.line) {
    props.push(`line=${issue.line}`);
  }
  if (issue.column) {
    props.push(`col=${issue.column}`);
  }
  props.push(`title=Design Memory: ${issue.ruleId} (${issue.status})`);
  console.log(`::${command} ${props.join(',')}::${clean(issue.found)} - ${clean(issue.suggestedAction)}`);
}

if (summaryFile) {
  const rows = run.issues.length
    ? run.issues
        .map(
          (issue) =>
            `| ${issue.severity} | ${issue.ruleId} | ${issue.status} | ${clean(issue.filePath)}${issue.line ? `:${issue.line}` : ''} | ${clean(issue.found)} |`,
        )
        .join('\n')
    : '| - | - | - | - | No drift findings |';
  fs.writeFileSync(
    summaryFile,
    `## Design Memory\n\n${run.filesAnalyzed.length} files analyzed, ${run.issues.length} findings.\n\n| Severity | Rule | Status | Location | Finding |\n| --- | --- | --- | --- | --- |\n${rows}\n`,
  );
}

if (blocking.length > 0 && strictness === 'block') {
  console.error(`Design Memory: ${blocking.length} blocking finding(s).`);
  process.exit(1);
}
process.exit(0);
