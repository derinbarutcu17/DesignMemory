import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'apps/procure-dash');
const outDir = path.join(root, 'docs/graphics');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chrome-shots-'));
const PORT = 4517;

const shots = [
  { url: `http://localhost:${PORT}/#/overview`, out: 'app-overview.png', width: 1600, height: 1000 },
  { url: `http://localhost:${PORT}/#/suppliers`, out: 'portfolio-hero.png', width: 1600, height: 900 },
  { url: `http://localhost:${PORT}/#/contracts`, out: 'app-contracts.png', width: 1600, height: 900 },
  { url: `http://localhost:${PORT}/?state=empty#/suppliers`, out: 'app-empty-state.png', width: 1600, height: 900 },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${PORT}/`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`preview server did not start on port ${PORT}`);
}

async function screenshot(shot: (typeof shots)[number]) {
  const outPath = path.join(outDir, shot.out);
  fs.rmSync(outPath, { force: true });
  const started = Date.now();
  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--disable-extensions',
      `--user-data-dir=${profile}`,
      `--window-size=${shot.width},${shot.height}`,
      `--virtual-time-budget=4000`,
      `--screenshot=${outPath}`,
      shot.url,
    ],
    { stdio: 'ignore' },
  );

  let rendered = false;
  while (Date.now() - started < 45_000) {
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
      rendered = true;
      break;
    }
    await sleep(150);
  }
  child.kill('SIGKILL');
  if (!rendered) {
    throw new Error(`chrome did not produce ${shot.out}`);
  }
  console.log(`${shot.out} ${Math.round(fs.statSync(outPath).size / 1024)}KB`);
}

async function main() {
  const preview = spawn('node', [path.join(appDir, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: appDir,
    stdio: 'ignore',
  });

  try {
    await waitForServer();
    for (const shot of shots) {
      await screenshot(shot);
    }
  } finally {
    preview.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
