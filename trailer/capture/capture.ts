/**
 * Films gameplay scenarios deterministically, for before/after comparisons of
 * rendering changes. Each scenario runs under `virtual-time.js`, like
 * `record.ts`, so the same scenario on two builds lines up frame for frame.
 *
 *   pnpm capture <devServerUrl> [outDir] [scenario ...]
 *   pnpm capture --list
 *
 * `outDir` defaults to out/capture/<host-port>. Per scenario it writes
 * <name>/fNNNN.jpg (30 fps), <name>.gif, <name>.mp4, <name>-still-<ms>.png
 * and, if the page logged any, <name>-errors.txt. The server must be a Vite
 * dev server: the debug routes don't exist in a production build.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { SCENARIOS, type Action } from './scenarios';
import {
  FPS,
  OUT_DIR,
  VIRTUAL_TIME,
  encodeGif,
  encodeMp4,
  frameName,
  launchWebGL,
  userPath,
} from './tools';

interface FilmSet {
  __vt: { step(ms: number): Promise<void>; frame(): void };
  __trailer?: { ready: boolean; start(): void };
}

const WARMUP_MS = 5000;

async function tick(page: Page) {
  await page.evaluate((ms) => (window as unknown as FilmSet).__vt.step(ms), 1000 / FPS);
  await page.evaluate(() => (window as unknown as FilmSet).__vt.frame());
}

/** Drives the `/debug/scene` control bar: selects by label text, buttons by text. */
async function act(page: Page, action: Action) {
  await page.evaluate((a) => {
    if (a.do === 'select') {
      const label = [...document.querySelectorAll('.debug-scene__controls label')].find((l) =>
        l.textContent?.trim().startsWith(a.label),
      );
      const select = label?.querySelector('select');
      if (!select) throw new Error(`no select labelled ${a.label}`);
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(
        select,
        String(a.value),
      );
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const button = [...document.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === a.text,
      );
      if (!button) throw new Error(`no button ${a.text}`);
      button.click();
    }
  }, action);
}

async function capture(base: string, outDir: string, name: string) {
  const s = SCENARIOS[name];
  const dir = join(outDir, name);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const errors: string[] = [];
  const browser = await launchWebGL();
  try {
    const page = await browser.newPage({ viewport: s.viewport });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript({ path: VIRTUAL_TIME });
    if (s.css) {
      await page.addInitScript((css) => {
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = css;
          document.head.appendChild(style);
        });
      }, s.css);
    }
    await page.goto(base.replace(/\/$/, '') + s.url);
    const isTake = s.url.startsWith('/debug/trailer');
    if (isTake) await page.waitForFunction(() => (window as unknown as FilmSet).__trailer?.ready);
    else await page.waitForSelector('.debug-scene__controls');
    for (const action of s.setup ?? []) {
      await act(page, action);
      await tick(page);
    }
    // Let models download and parse while the virtual clock idles along.
    const warmUntil = Date.now() + WARMUP_MS;
    while (Date.now() < warmUntil) await tick(page);
    if (isTake) await page.evaluate(() => (window as unknown as FilmSet).__trailer!.start());

    const steps = [...(s.steps ?? [])].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    const stills = new Set((s.stills ?? []).map((ms) => Math.round((ms * FPS) / 1000)));
    let loading = 0;
    for (let f = 0; f < Math.round(s.seconds * FPS); f++) {
      const t = (f * 1000) / FPS;
      while (steps.length && (steps[0].at ?? 0) <= t) await act(page, steps.shift()!);
      await tick(page);
      if (await page.$('.scene-loading')) loading++;
      await page.screenshot({ path: join(dir, frameName(f)), type: 'jpeg', quality: 88 });
      if (stills.has(f))
        await page.screenshot({ path: join(outDir, `${name}-still-${Math.round(t)}.png`) });
    }
    if (loading) console.warn(`[${name}] ${loading} frames still showed a loading screen`);
  } finally {
    await browser.close();
  }
  encodeMp4(join(dir, 'f%04d.jpg'), join(outDir, `${name}.mp4`));
  encodeGif(
    join(dir, 'f%04d.jpg'),
    join(outDir, `${name}.gif`),
    Math.round(s.viewport.width / 4) * 2,
  );
  if (errors.length) await writeFile(join(outDir, `${name}-errors.txt`), errors.join('\n'));
  console.log(`[${name}] done${errors.length ? ` (${errors.length} page errors)` : ''}`);
}

const args = process.argv.slice(2);
if (!args.length || args[0] === '--list') {
  for (const [name, s] of Object.entries(SCENARIOS)) console.log(`${name.padEnd(22)} ${s.about}`);
  if (!args.length) console.log('\nusage: pnpm capture <devServerUrl> [outDir/] [scenario ...]');
  process.exit(0);
}
const [base, ...rest] = args;
// An output directory must look like a path, so a mistyped scenario name is
// reported rather than silently becoming the directory.
const looksLikePath = (arg = '') => arg.includes('/') || arg.startsWith('.');
const outDir = looksLikePath(rest[0])
  ? userPath(rest.shift()!)
  : join(OUT_DIR, new URL(base).host.replace(':', '-'));
const names = rest.length ? rest : Object.keys(SCENARIOS);
const unknown = names.filter((n) => !SCENARIOS[n]);
if (unknown.length)
  throw new Error(`unknown scenario(s): ${unknown.join(', ')} — see pnpm capture --list`);

await mkdir(outDir, { recursive: true });
let failed = 0;
for (const name of names) {
  try {
    await capture(base, outDir, name);
  } catch (error) {
    failed++;
    console.error(`[${name}] FAILED: ${(error as Error).message}`);
  }
}
console.log(`${names.length - failed}/${names.length} scenarios → ${outDir}`);
process.exitCode = failed ? 1 : 0;
