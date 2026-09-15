import fs from 'node:fs';
import path from 'node:path';

import { DesignMemoryError } from '../lib/errors';

let defaultCwd = process.cwd();

export function setDefaultCwd(cwd: string) {
  defaultCwd = path.resolve(cwd);
}

export function getDefaultCwd() {
  return defaultCwd;
}

export function resolveCwd(cwd?: string) {
  const target = cwd ? path.resolve(cwd) : defaultCwd;
  if (!fs.existsSync(target)) {
    throw new DesignMemoryError('DM_E_PATH_NOT_FOUND', `Repository path ${target} does not exist.`);
  }
  return target;
}
