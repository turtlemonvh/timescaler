/**
 * Sprite normalizer (issue #93, art pipeline 1/6).
 *
 * Turns whatever an art pack or an image model hands us into the one shape the
 * game reads: square, fixed-size, true-alpha PNGs on a shared baseline, plus a
 * manifest describing them.
 *
 *   pnpm sprites:normalize scripts/sprite-sources/bunny.json [--src <dir|sheet.png>] [--out <dir>]
 *
 * Input is a source manifest (see `src/ui/sprites/manifest.ts`) naming either a
 * directory of PNGs or a single sprite sheet cut into a fixed grid.
 *
 * Output is `public/sprites/<animal>/<pose>_<NN>.png` plus
 * `public/sprites/<animal>/manifest.json` and, if the source manifest names one,
 * the pack's own LICENSE file copied alongside.
 *
 * What "normalized" means here:
 *
 * - **True alpha, no exceptions.** A frame without an alpha channel is refused
 *   with the file name and the reason. Art with a baked-in white or
 *   checkerboard background is a reject, not something to key out.
 * - **One shared scale.** Every frame is trimmed to its alpha bounding box, then
 *   *all* of them are scaled by a single factor derived from the largest
 *   trimmed frame, so a character's poses keep their relative sizes.
 * - **One shared baseline.** Each frame's trimmed content is horizontally
 *   centred and its bottom edge placed on a common baseline row, so a pose
 *   change doesn't make the character hop.
 *
 * NOTE: this file imports from `src/`, which is compiled under
 * `tsconfig.app.json`'s bundler resolution (extension-less relative imports).
 * It is therefore excluded from `tsconfig.node.json` — pulling it into that
 * nodenext program would force explicit `.js` extensions across every file it
 * reaches. It runs under `tsx` (type-stripping only), same as the other scripts
 * here; `pnpm typecheck` covers the imported parsers via the app project.
 */
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import sharp from 'sharp';
import {
  parseSpriteManifest,
  parseSpriteSourceManifest,
  type SpriteManifest,
  type SpriteSourceManifest,
} from '../src/ui/sprites/manifest';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

/** Transparent margin kept on every side, in output pixels. */
const MARGIN = 2;
/** Alpha below this counts as empty when trimming. */
const ALPHA_FLOOR = 8;

type Box = { left: number; top: number; width: number; height: number };

type SourceFrame = {
  /** Stable key: file name, or `cell:<n>` for a sheet. */
  readonly key: string;
  /** Where the pixels come from. */
  readonly file: string;
  /** Sub-rectangle of `file` to read, or null for the whole image. */
  readonly cell: Box | null;
};

class NormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NormalizeError';
  }
}

function parseArgs(argv: readonly string[]) {
  const positional: string[] = [];
  let src: string | undefined;
  let out: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--src' || arg === '--out') {
      const value = argv[i + 1];
      if (value === undefined) throw new NormalizeError(`${arg} needs a path`);
      if (arg === '--src') src = value;
      else out = value;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new NormalizeError(`unknown option ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length !== 1) {
    throw new NormalizeError(
      'usage: tsx scripts/normalize-sprites.ts <source-manifest.json> [--src <dir|sheet.png>] [--out <dir>]',
    );
  }
  return { manifestPath: positional[0], src, out };
}

/** Every distinct source frame referenced by the manifest, deduplicated. */
function collectSourceFrames(
  source: SpriteSourceManifest,
  srcPath: string,
): Map<string, SourceFrame> {
  const frames = new Map<string, SourceFrame>();

  for (const pose of Object.values(source.poses)) {
    for (const frame of pose.frames) {
      if (source.source.kind === 'dir') {
        const key = String(frame);
        if (!frames.has(key)) {
          frames.set(key, { key, file: path.join(srcPath, key), cell: null });
        }
      } else {
        const index = Number(frame);
        const { frameWidth, frameHeight, columns } = source.source;
        const key = `cell:${index}`;
        if (!frames.has(key)) {
          frames.set(key, {
            key,
            file: srcPath,
            cell: {
              left: (index % columns) * frameWidth,
              top: Math.floor(index / columns) * frameHeight,
              width: frameWidth,
              height: frameHeight,
            },
          });
        }
      }
    }
  }
  return frames;
}

/**
 * Refuse anything without a real alpha channel, and say why. This is the check
 * `docs/art/prompts.md` promises image-model output has to survive.
 */
async function assertAlpha(frame: SourceFrame) {
  const metadata = await sharp(frame.file).metadata();
  if (!metadata.hasAlpha) {
    throw new NormalizeError(
      `${frame.file}: refusing frame "${frame.key}" — no alpha channel ` +
        `(${metadata.channels ?? '?'} channels, format ${metadata.format ?? '?'}, ` +
        `space ${metadata.space ?? '?'}). Sprites must be true transparent PNGs; ` +
        'an opaque or matted background cannot be keyed out safely.',
    );
  }
}

/**
 * Bounding box of the non-transparent pixels, in the *source file's* coordinate
 * space, or null if the frame is empty.
 *
 * Absolute rather than cell-relative on purpose: sharp only honours one
 * `extract()` before a resize, so a sheet cell and its trim box have to be
 * combined into a single rectangle before the frame is written out.
 */
async function alphaBounds(frame: SourceFrame): Promise<Box | null> {
  const source = sharp(frame.file);
  const { data, info } = await (frame.cell === null ? source : source.extract(frame.cell))
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new NormalizeError(
      `${frame.file}: refusing frame "${frame.key}" — decoded to ${info.channels} channels, ` +
        'expected 4 (RGBA). Sprites must be true transparent PNGs.',
    );
  }

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    const rowStart = y * info.width * 4;
    for (let x = 0; x < info.width; x += 1) {
      if (data[rowStart + x * 4 + 3] > ALPHA_FLOOR) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;
  return {
    left: (frame.cell?.left ?? 0) + minX,
    top: (frame.cell?.top ?? 0) + minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function frameFileName(pose: string, index: number): string {
  return `${pose}_${String(index).padStart(2, '0')}.png`;
}

async function main() {
  const { manifestPath, src, out } = parseArgs(process.argv.slice(2));

  const source = parseSpriteSourceManifest(
    JSON.parse(await readFile(path.resolve(repoRoot, manifestPath), 'utf8')),
  );

  const srcPath = path.resolve(repoRoot, src ?? source.source.path);
  const outDir = path.resolve(repoRoot, out ?? path.join('public', 'sprites', source.animal));
  const size = source.frameSize;

  const sourceFrames = collectSourceFrames(source, srcPath);

  // Pass 1 — validate alpha and measure, before writing anything.
  const bounds = new Map<string, Box>();
  for (const frame of sourceFrames.values()) {
    await assertAlpha(frame);
    const box = await alphaBounds(frame);
    if (box === null) {
      throw new NormalizeError(
        `${frame.file}: frame "${frame.key}" is fully transparent — nothing to normalize.`,
      );
    }
    bounds.set(frame.key, box);
  }

  // One scale for the whole character, so poses keep their relative sizes.
  const usable = size - MARGIN * 2;
  const widest = Math.max(...[...bounds.values()].map((box) => box.width));
  const tallest = Math.max(...[...bounds.values()].map((box) => box.height));
  const scale = Math.min(usable / widest, usable / tallest);
  const baseline = size - MARGIN;

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const blank = {
    create: {
      width: size,
      height: size,
      channels: 4 as const,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  };

  const poses: Record<string, { frames: string[]; fps: number; loop: boolean }> = {};
  let written = 0;

  for (const [poseName, pose] of Object.entries(source.poses)) {
    const files: string[] = [];
    for (const [index, frameRef] of pose.frames.entries()) {
      const key = source.source.kind === 'dir' ? String(frameRef) : `cell:${frameRef}`;
      const frame = sourceFrames.get(key)!;
      const box = bounds.get(key)!;

      const width = Math.max(1, Math.round(box.width * scale));
      const height = Math.max(1, Math.round(box.height * scale));

      const scaled = await sharp(frame.file)
        .extract(box)
        .resize({ width, height, fit: 'fill', kernel: 'lanczos3' })
        .png()
        .toBuffer();

      const fileName = frameFileName(poseName, index);
      await sharp(blank)
        .composite([
          {
            input: scaled,
            left: Math.round((size - width) / 2),
            top: baseline - height,
          },
        ])
        .png({ compressionLevel: 9 })
        .toFile(path.join(outDir, fileName));

      files.push(fileName);
      written += 1;
    }
    poses[poseName] = { frames: files, fps: pose.fps, loop: pose.loop };
  }

  const manifest: SpriteManifest = parseSpriteManifest({
    animal: source.animal,
    displayName: source.displayName,
    frameSize: size,
    basePath: `sprites/${source.animal}`,
    credit: source.credit,
    poses,
  });

  // `public/sprites` is in .prettierignore — this is generated output, and
  // JSON.stringify's fully-expanded arrays are easier to read in a diff than
  // Prettier's collapsed ones.
  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (source.licenseFile !== undefined) {
    await copyFile(path.resolve(repoRoot, source.licenseFile), path.join(outDir, 'LICENSE.txt'));
  }

  const relative = path.relative(repoRoot, outDir);
  const relOut = relative.startsWith('..') ? outDir : relative;
  console.log(
    `Normalized ${written} frame(s) across ${Object.keys(poses).length} pose(s) ` +
      `into ${relOut}/ at ${size}x${size} (scale ${scale.toFixed(3)}, baseline row ${baseline}).`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof NormalizeError) {
    console.error(`normalize-sprites: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
