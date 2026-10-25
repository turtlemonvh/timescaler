/**
 * Copies the rendered intro loop and README GIF into the app and docs. The
 * trailer MP4 stays in `out/`: it is hosted as a GitHub attachment rather
 * than committed (see trailer/README.md).
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const copies: [string, string][] = [
  ['out/intro-hero.webm', 'public/intro/intro-hero.webm'],
  ['out/intro-hero-poster.jpg', 'public/intro/intro-hero-poster.jpg'],
  ['out/timescaler.gif', 'docs/media/timescaler.gif'],
];
for (const [from, to] of copies) {
  await mkdir(dirname(join(root, to)), { recursive: true });
  await copyFile(join(here, from), join(root, to));
  console.log(`${from} -> ${to}`);
}
console.log('Trailer: out/timescaler-trailer.mp4 (upload as a GitHub attachment)');
