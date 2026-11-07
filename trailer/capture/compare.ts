/**
 * Side-by-side BEFORE | AFTER clip from two captures of the same scenario.
 *
 *   pnpm capture:compare <beforeDir> <afterDir> <scenario> <outStem> [--from ms] [--to ms] [--still ms] [--width 360]
 *
 * Writes <outStem>.gif (each side --width px, 15 fps) and <outStem>.png (the
 * pair at --still ms, twice the size; defaults to the window's midpoint).
 * GitHub accepts GIFs up to 10 MB: shorten the window or narrow --width if needed.
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairHtml, shoot, withPage } from './compose';
import { FPS, encodeGif, frameName, parseArgs, userPath } from './tools';

const { rest, flags } = parseArgs(process.argv.slice(2));
const [beforeDir, afterDir, name, outStem] = [
  userPath(rest[0] ?? ''),
  userPath(rest[1] ?? ''),
  rest[2],
  rest[3] && userPath(rest[3]),
];
if (!outStem) {
  console.error(
    'usage: pnpm capture:compare <beforeDir> <afterDir> <scenario> <outStem> [--from ms] [--to ms] [--still ms] [--width 360]',
  );
  process.exit(1);
}
const count = (dir: string) =>
  readdirSync(join(dir, name)).filter((f) => f.endsWith('.jpg')).length;
const last = Math.min(count(beforeDir), count(afterDir)) - 1;
const toFrame = (ms: number) => Math.min(last, Math.max(0, Math.round((ms * FPS) / 1000)));
const width = flags.width ?? 360;
const first = toFrame(flags.from ?? 0);
const end = flags.to === undefined ? last : toFrame(flags.to);
const still = flags.still === undefined ? Math.round((first + end) / 2) : toFrame(flags.still);
const frame = (dir: string, n: number) => join(dir, name, frameName(n));

const work = mkdtempSync(join(tmpdir(), 'capture-compare-'));
try {
  await withPage(width * 2, async (page) => {
    // Every other frame: the GIF plays at 15 fps.
    for (let n = first, i = 0; n <= end; n += 2, i++) {
      await shoot(
        page,
        pairHtml(frame(beforeDir, n), frame(afterDir, n), width),
        join(work, frameName(i)),
      );
    }
  });
  encodeGif(join(work, 'f%04d.jpg'), `${outStem}.gif`, width * 2, { inputFps: 15 });
  await withPage(width * 4, (page) =>
    shoot(
      page,
      pairHtml(frame(beforeDir, still), frame(afterDir, still), width * 2),
      `${outStem}.png`,
    ),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`${outStem}.gif\n${outStem}.png`);
