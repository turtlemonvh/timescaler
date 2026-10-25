/**
 * Films each trailer shot from the real game. Starts the Vite dev server,
 * opens `/debug/trailer?shot=<id>` in headless Chromium with
 * `virtual-time.js` injected, and steps the page's clock one frame at a
 * time, saving a JPEG per frame plus the shot's sound as a WAV under
 * `public/shots/<id>/`. Remotion edits those frames together.
 *
 *   pnpm record            # every shot
 *   pnpm record game pick  # just these
 */
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';
import { FPS, SHOTS, type ShotId } from './src/shots';

/** What `virtual-time.js` and the trailer page put on `window`. Callbacks passed to
 * `page.evaluate` run in the browser, so each one casts `window` itself. */
interface FilmSet {
  __vt: {
    step(ms: number): Promise<void>;
    frame(): void;
    markAudioStart(): void;
    renderAudio(durationMs: number): Promise<string | null>;
  };
  __trailer?: { ready: boolean; start(): void };
}

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 5299;
const BASE = `http://localhost:${PORT}`;
const WARMUP_MS = 4000;

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Vite did not start on ${BASE}`);
}

/** Advance the page's clock, then run one animation frame. */
async function tick(page: Page, ms: number) {
  await page.evaluate((step) => (window as unknown as FilmSet).__vt.step(step), ms);
  await page.evaluate(() => (window as unknown as FilmSet).__vt.frame());
}

async function recordShot(id: ShotId) {
  const shot = SHOTS[id];
  const outDir = join(here, 'public', 'shots', id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // llvmpipe (Mesa's software Vulkan) is roughly twice as fast as SwiftShader here.
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
  });
  page.on('pageerror', (error) => console.error(`[${id}] ${error.message}`));
  await page.addInitScript({ path: join(here, 'virtual-time.js') });
  await page.goto(`${BASE}/debug/trailer?shot=${id}`);
  await page.waitForFunction(() => (window as unknown as FilmSet).__trailer?.ready);

  // Let models download and parse while the (virtual) clock idles along.
  const warmUntil = Date.now() + WARMUP_MS;
  while (Date.now() < warmUntil) await tick(page, 1000 / FPS);
  await page.evaluate(() => {
    (window as unknown as FilmSet).__vt.markAudioStart();
    (window as unknown as FilmSet).__trailer!.start();
  });

  const frames = Math.round(shot.seconds * FPS);
  let loadingFrames = 0;
  for (let frame = 0; frame < frames; frame++) {
    await tick(page, 1000 / FPS);
    if (await page.$('.scene-loading')) loadingFrames++;
    await page.screenshot({
      path: join(outDir, `f${String(frame).padStart(4, '0')}.jpg`),
      type: 'jpeg',
      quality: 90,
    });
  }
  if (loadingFrames) console.warn(`[${id}] ${loadingFrames} frames still showed a loading screen`);

  const wav = await page.evaluate(
    (ms) => (window as unknown as FilmSet).__vt.renderAudio(ms),
    shot.seconds * 1000,
  );
  if (wav) await writeFile(join(outDir, 'audio.wav'), Buffer.from(wav, 'base64'));
  await browser.close();
  console.log(`[${id}] ${frames} frames${wav ? ' + audio' : ''}`);
}

const requested = process.argv.slice(2) as ShotId[];
const ids = requested.length ? requested : (Object.keys(SHOTS) as ShotId[]);

const vite = spawn('pnpm', ['exec', 'vite', '--port', String(PORT), '--strictPort'], {
  cwd: join(here, '..'),
  stdio: 'ignore',
  detached: true,
});
try {
  await waitForServer();
  for (const id of ids) await recordShot(id);
} finally {
  process.kill(-vite.pid!, 'SIGTERM');
}
