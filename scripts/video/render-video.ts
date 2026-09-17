import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = path.resolve(__dirname, '..', '..');
const motionDir = path.join(root, 'docs/video/motion');
const framesDir = path.join(root, 'docs/video/frames');
const captureSeconds = Number(process.env.DM_VIDEO_SECONDS ?? 64);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.mkdirSync(framesDir, { recursive: true });
  for (const file of fs.readdirSync(framesDir)) {
    fs.rmSync(path.join(framesDir, file));
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-video-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--disable-extensions',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      '--window-size=1920,1080',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let attempt = 0; attempt < 100 && !fs.existsSync(portFile); attempt += 1) {
      await sleep(100);
    }
    if (!fs.existsSync(portFile)) throw new Error('chrome did not expose a devtools port');
    const port = fs.readFileSync(portFile, 'utf-8').split('\n')[0].trim();

    let target: { webSocketDebuggerUrl: string } | undefined;
    for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
      target = targets.find((entry) => entry.type === 'page');
      if (!target) await sleep(100);
    }
    if (!target) throw new Error('no page target available');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', () => reject(new Error('websocket failed')));
    });

    let nextId = 1;
    const pending = new Map<number, (value: { result?: unknown; error?: { message: string } }) => void>();
    let frameCount = 0;
    const startedAt = Date.now();
    let screencastStartedAt = 0;

    ws.addEventListener('message', (event: MessageEvent) => {
      const payload = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        params?: { data: string; sessionId: number };
        result?: { result?: { value?: unknown } };
        error?: { message: string };
      };

      if (payload.method === 'Page.screencastFrame' && payload.params) {
        const framePath = path.join(framesDir, `frame-${String(frameCount).padStart(5, '0')}.jpg`);
        fs.writeFileSync(framePath, Buffer.from(payload.params.data, 'base64'));
        frameCount += 1;
        ws.send(JSON.stringify({ id: nextId++, method: 'Page.screencastFrameAck', params: { sessionId: payload.params.sessionId } }));
        return;
      }

      if (payload.id !== undefined) {
        const resolver = pending.get(payload.id);
        if (resolver) {
          pending.delete(payload.id);
          resolver(payload);
        }
      }
    });

    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<{ result?: unknown; error?: { message: string } }>((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `file://${path.join(motionDir, 'index.html')}` });
    await sleep(700);
    await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
    screencastStartedAt = Date.now();

    while (Date.now() - screencastStartedAt < captureSeconds * 1000) {
      await sleep(500);
      if (frameCount % 120 === 0 && frameCount > 0) {
        console.log(`captured ${frameCount} frames (${((Date.now() - screencastStartedAt) / 1000).toFixed(1)}s)`);
      }
    }

    await send('Page.stopScreencast');
    const elapsed = (Date.now() - screencastStartedAt) / 1000;
    const fps = Math.max(1, Math.round((frameCount / elapsed) * 100) / 100);
    console.log(`captured ${frameCount} frames in ${elapsed.toFixed(1)}s (~${fps} fps)`);

    const mainOut = path.join(root, 'docs/video/design-memory-motion.mp4');
    const loopOut = path.join(root, 'docs/video/design-memory-loop.mp4');
    const run = (args: string[]) =>
      new Promise<void>((resolve, reject) => {
        const ff = spawn('ffmpeg', args, { stdio: 'ignore' });
        ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
      });

    await run([
      '-y',
      '-framerate', String(fps),
      '-i', path.join(framesDir, 'frame-%05d.jpg'),
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0b0f14',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      mainOut,
    ]);
    await run(['-y', '-ss', '17', '-t', '15', '-i', mainOut, '-vf', 'crop=1080:1080:420:0', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', loopOut]);

    console.log(`main: ${mainOut} (${Math.round(fs.statSync(mainOut).size / 1024)}KB)`);
    console.log(`loop: ${loopOut} (${Math.round(fs.statSync(loopOut).size / 1024)}KB)`);
    console.log(`capture wall time: ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
  } finally {
    chrome.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
