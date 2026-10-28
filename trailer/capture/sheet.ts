/**
 * Contact sheet: every Nth frame of a captured scenario tiled into one PNG,
 * numbered, so a whole clip's motion can be inspected in a single image.
 *
 *   pnpm capture:sheet <captureDir> <scenario> [--every 6] [--cols 6] [--width 300] [--from 0] [--max 48]
 *
 * Writes <captureDir>/<scenario>-sheet[-from<N>].png. Frame N is at N/30 s.
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileUrl, shoot, withPage } from './compose';
import { parseArgs, userPath } from './tools';

const { rest, flags } = parseArgs(process.argv.slice(2));
const [dir, name] = [userPath(rest[0] ?? ''), rest[1]];
if (!name) {
  console.error(
    'usage: pnpm capture:sheet <captureDir> <scenario> [--every 6] [--cols 6] [--width 300] [--from 0] [--max 48]',
  );
  process.exit(1);
}
const { every = 6, cols = 6, width = 300, from = 0, max = 48 } = flags;
const frames = readdirSync(join(dir, name))
  .filter((f) => f.endsWith('.jpg'))
  .sort()
  .filter((_, i) => i >= from && (i - from) % every === 0)
  .slice(0, max);
const tiles = frames
  .map(
    (f) =>
      `<div style="position:relative"><img src="${fileUrl(resolve(dir, name, f))}" style="width:${width}px;display:block"><span style="position:absolute;left:3px;top:3px;background:#000a;color:#ff0;padding:1px 4px;font:bold 14px sans-serif">${f.slice(1, 5)}</span></div>`,
  )
  .join('');
const out = resolve(dir, `${name}-sheet${from ? `-from${from}` : ''}.png`);
await withPage(cols * (width + 4) + 4, (page) =>
  shoot(
    page,
    `<div style="display:grid;grid-template-columns:repeat(${cols},${width}px);gap:4px;padding:4px">${tiles}</div>`,
    out,
  ),
);
console.log(out);
