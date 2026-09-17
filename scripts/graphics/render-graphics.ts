import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const assets = [
  { html: 'architecture.html', out: 'architecture.png', width: 1600, height: 1000 },
  { html: 'loop.html', out: 'loop.png', width: 1600, height: 900 },
  { html: 'drift-before-after.html', out: 'drift-before-after.png', width: 1600, height: 900 },
  { html: 'decision-memory.html', out: 'decision-memory.png', width: 1600, height: 900 },
  { html: 'social-preview.html', out: 'social-preview.png', width: 1280, height: 640 },
];

const root = path.resolve(__dirname, '..', '..');
const srcDir = path.join(root, 'docs/graphics/src');
const outDir = path.join(root, 'docs/graphics');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chrome-'));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function render(asset: (typeof assets)[number]) {
  const htmlPath = path.join(srcDir, asset.html);
  const outPath = path.join(outDir, asset.out);
  const started = Date.now();
  fs.rmSync(outPath, { force: true });

  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--disable-extensions',
      `--user-data-dir=${profile}`,
      `--window-size=${asset.width},${asset.height}`,
      `--screenshot=${outPath}`,
      `file://${htmlPath}`,
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
    throw new Error(`chrome did not produce ${asset.out} within 45s`);
  }
  await sleep(100);
  const size = fs.statSync(outPath).size;
  console.log(`${asset.out} ${asset.width}x${asset.height} ${Math.round(size / 1024)}KB`);
}

async function main() {
  for (const asset of assets) {
    await render(asset);
  }
  fs.rmSync(profile, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
