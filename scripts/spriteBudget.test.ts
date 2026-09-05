import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * `public/sprites/` is the one directory in this repo where binary assets are
 * allowed (issue #93 relaxes M0's no-binaries rule for it). The price of that
 * is a hard, enforced ceiling: this is an offline-first PWA that precaches
 * every PNG into the service worker, so unbounded art means an unbounded
 * install size.
 *
 * This test lives under `scripts/` rather than next to the sprite code in
 * `src/` on purpose: it needs `node:fs`, and `tsconfig.app.json` deliberately
 * does not pull in Node's types, so browser code can't reach for them by
 * accident. The runtime side of the same contract (that the shipped manifest
 * parses, and names all four poses) is covered in
 * `src/ui/sprites/SpriteAnimator.test.tsx`.
 */
const BUDGET_BYTES = 2 * 1024 * 1024;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spritesDir = path.join(repoRoot, 'public', 'sprites');

type Manifest = {
  animal: string;
  frameSize: number;
  poses: Record<string, { frames: string[] }>;
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const animalDirs = readdirSync(spritesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const manifests: Manifest[] = animalDirs.map(
  (animal) =>
    JSON.parse(readFileSync(path.join(spritesDir, animal, 'manifest.json'), 'utf8')) as Manifest,
);

describe('public/sprites budget', () => {
  it('stays under the 2 MB budget for the whole directory', () => {
    const files = walk(spritesDir);
    const total = files.reduce((sum, file) => sum + statSync(file).size, 0);
    const report = files
      .map((file) => `  ${path.relative(spritesDir, file)}: ${statSync(file).size}`)
      .join('\n');
    expect(
      total,
      `public/sprites is ${total} bytes, over the ${BUDGET_BYTES} byte budget:\n${report}`,
    ).toBeLessThanOrEqual(BUDGET_BYTES);
  });

  it('ships at least one normalized animal', () => {
    expect(animalDirs.length).toBeGreaterThan(0);
  });
});

describe.each(manifests)('public/sprites/$animal', (manifest) => {
  const dir = path.join(spritesDir, manifest.animal);
  const promised = new Set(Object.values(manifest.poses).flatMap((pose) => pose.frames));
  const onDisk = new Set(readdirSync(dir).filter((name) => name.endsWith('.png')));

  it('has a LICENSE file alongside the frames', () => {
    expect(readdirSync(dir)).toContain('LICENSE.txt');
    expect(readFileSync(path.join(dir, 'LICENSE.txt'), 'utf8')).toMatch(
      /CC0|Creative Commons Zero/i,
    );
  });

  it('has every frame its manifest promises, and nothing stale alongside them', () => {
    for (const frame of promised) {
      expect(onDisk, `${manifest.animal}/${frame} is in the manifest but not on disk`).toContain(
        frame,
      );
    }
    for (const frame of onDisk) {
      expect(promised, `${manifest.animal}/${frame} is on disk but in no pose`).toContain(frame);
    }
  });

  it('normalized every frame to the manifest frame size, with a true alpha channel', () => {
    for (const frame of promised) {
      // PNG IHDR: 8-byte signature, 4-byte chunk length, 4-byte "IHDR",
      // then width (4), height (4), bit depth (1), colour type (1).
      const bytes = readFileSync(path.join(dir, frame));
      const where = `${manifest.animal}/${frame}`;
      expect(bytes.readUInt32BE(16), `${where} width`).toBe(manifest.frameSize);
      expect(bytes.readUInt32BE(20), `${where} height`).toBe(manifest.frameSize);
      // Colour type 6 is truecolour + alpha; 4 is greyscale + alpha.
      expect([4, 6], `${where} has no alpha channel`).toContain(bytes[25]);
    }
  });
});
