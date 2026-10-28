/** Shared by the capture, sheet and compare scripts. */
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';

export const FPS = 30;
export const TRAILER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VIRTUAL_TIME = join(TRAILER_DIR, 'virtual-time.js');
/** Where captures land unless an explicit directory is given. Gitignored. */
export const OUT_DIR = join(TRAILER_DIR, 'out', 'capture');

/** Headless Chromium that renders WebGL (llvmpipe, as `record.ts` uses). */
export function launchWebGL(): Promise<Browser> {
  return chromium.launch({
    args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
}

/** Headless Chromium for composing frames from local files. */
export function launchPlain(): Promise<Browser> {
  return chromium.launch({ args: ['--allow-file-access-from-files'] });
}

/** Remotion's bundled ffmpeg. It has scale/trim/split/palettegen/paletteuse and the
 * gif and libx264 encoders, but no overlay, hstack, pad or drawtext, so anything
 * composited (labels, side-by-sides, tiles) is drawn in Chromium first. */
export function ffmpeg(args: string[]) {
  execFileSync(
    join(TRAILER_DIR, 'node_modules', '.bin', 'remotion'),
    ['ffmpeg', '-y', '-loglevel', 'error', ...args],
    {
      stdio: 'inherit',
    },
  );
}

/** A numbered frame sequence → a 15 fps palette-optimised GIF `width` px wide. */
export function encodeGif(pattern: string, out: string, width: number, { inputFps = FPS } = {}) {
  ffmpeg([
    '-framerate',
    String(inputFps),
    '-i',
    pattern,
    '-r',
    '15',
    '-filter_complex',
    `scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    out,
  ]);
}

export function encodeMp4(pattern: string, out: string) {
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    pattern,
    '-vf',
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    out,
  ]);
}

/** A path the user typed, resolved against the directory they ran `pnpm` from
 * (`pnpm --dir trailer` changes into trailer/ before running the script). */
export const userPath = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path);

export const frameName = (n: number) => `f${String(n).padStart(4, '0')}.jpg`;

/** Reads `--name value` flags as numbers, leaving positional arguments in `rest`. */
export function parseArgs(argv: string[]) {
  const rest: string[] = [];
  const flags: Record<string, number> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) flags[argv[i].slice(2)] = Number(argv[++i]);
    else rest.push(argv[i]);
  }
  return { rest, flags };
}
