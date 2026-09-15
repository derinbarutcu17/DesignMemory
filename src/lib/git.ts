import { execFileSync } from 'node:child_process';
import { readConfig, shouldAuditFile } from './config';
import { DesignMemoryError } from './errors';

const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot'];
const IGNORED_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

type ExecFileSyncLike = typeof execFileSync;

function git(args: string[], cwd = process.cwd(), exec: ExecFileSyncLike = execFileSync) {
  return exec('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function assertGitRepo(cwd = process.cwd(), exec: ExecFileSyncLike = execFileSync) {
  try {
    git(['rev-parse', '--is-inside-work-tree'], cwd, exec);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
    if (/not a git repository/i.test(`${message}\n${stderr}`)) {
      throw new DesignMemoryError('DM_E_NOT_GIT', `${cwd} is not a git repository.`, {
        hint: 'Use scope "files" with explicit file paths to audit without git.',
      });
    }
    throw new DesignMemoryError('DM_E_GIT_FAILED', `git failed: ${message}`, { cause: error });
  }
}

function collectDiff(nameArgs: string[], diffArgsForFile: (file: string) => string[], cwd: string, exec: ExecFileSyncLike) {
  const changedFiles = git(nameArgs, cwd, exec)
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => file.length > 0);

  const filteredFiles = filterAuditableFiles(changedFiles, cwd);
  if (filteredFiles.length === 0) {
    return '';
  }

  let diffContent = '';
  for (const file of filteredFiles) {
    const diff = git(diffArgsForFile(file), cwd, exec);
    diffContent += `FILE: ${file}\n${diff}\n\n`;
  }

  return diffContent.trim();
}

export function getUnstagedDiff(cwd = process.cwd(), exec: ExecFileSyncLike = execFileSync): string {
  return collectDiff(['diff', '--name-only'], (file) => ['diff', '--', file], cwd, exec);
}

export function getRangeDiff(range: string, cwd = process.cwd(), exec: ExecFileSyncLike = execFileSync): string {
  return collectDiff(['diff', '--name-only', range], (file) => ['diff', range, '--', file], cwd, exec);
}


export function isAuditableCodeFile(file: string) {
  const isLockfile = IGNORED_FILES.some((ignored) => file.endsWith(ignored));
  const hasIgnoredExtension = IGNORED_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext));
  const isCodeFile = /\.(tsx?|jsx?|css|html)$/.test(file);
  return !isLockfile && !hasIgnoredExtension && isCodeFile;
}

export function filterAuditableFiles(filePaths: string[], cwd = process.cwd()) {
  const config = readConfig(cwd);
  return filePaths.filter((file) => isAuditableCodeFile(file) && shouldAuditFile(file, config));
}

export function getStagedFileContent(
  filePath: string,
  cwd = process.cwd(),
  exec: ExecFileSyncLike = execFileSync,
) {
  return git(['show', `:${filePath}`], cwd, exec);
}

export function getStagedDiff(
  cwd = process.cwd(),
  exec: ExecFileSyncLike = execFileSync,
): string {
  return collectDiff(['diff', '--cached', '--name-only'], (file) => ['diff', '--cached', '--', file], cwd, exec);
}
