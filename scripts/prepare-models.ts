/**
 * Downloads the game's animal models and writes optimized copies into
 * `public/models/`.
 *
 * Source: Quaternius' "Ultimate Animated Animals" pack (CC0 1.0), mirrored on
 * poly.pizza. Each GLB ships every clip twice (once as `Walk`, once as
 * `AnimalArmature|Walk`), unwelded and unquantized, at ~1 MB. This script
 * keeps one copy of each clip, dedups/prunes/welds, resamples animation
 * curves and quantizes attributes, which brings each file to a few hundred
 * KB with no visible loss. Only the output under `public/models/` is checked
 * in; raw downloads land in the gitignored `vendor/models/`.
 *
 *   pnpm models:prepare
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, weld } from '@gltf-transform/functions';

interface Source {
  animal: string;
  pageUrl: string;
  fileUrl: string;
}

const SOURCES: Source[] = [
  {
    animal: 'fox',
    pageUrl: 'https://poly.pizza/m/Bc97C66HKi',
    fileUrl: 'https://static.poly.pizza/e18e86df-1692-48d8-ac6e-1e25ab4ad574.glb',
  },
  {
    animal: 'deer',
    pageUrl: 'https://poly.pizza/m/T6Cs7tmMHJ',
    fileUrl: 'https://static.poly.pizza/4b6c2a41-43c7-404c-ae37-e8c4645ff93b.glb',
  },
  {
    animal: 'stag',
    pageUrl: 'https://poly.pizza/m/tQdzbZ1Cmw',
    fileUrl: 'https://static.poly.pizza/a9c69fbc-bf7c-4585-9a49-a82e0be1ac6b.glb',
  },
  {
    animal: 'wolf',
    pageUrl: 'https://poly.pizza/m/P1gU3Qkr9r',
    fileUrl: 'https://static.poly.pizza/f1d12388-e39b-4157-b32a-646a1d089fc4.glb',
  },
  {
    animal: 'alpaca',
    pageUrl: 'https://poly.pizza/m/bCVFD48i2l',
    fileUrl: 'https://static.poly.pizza/444228bb-745d-49b2-89ef-cc12805deaa8.glb',
  },
  {
    animal: 'husky',
    pageUrl: 'https://poly.pizza/m/wcWiuEqwzq',
    fileUrl: 'https://static.poly.pizza/611d25c7-430f-4bb5-ab2c-d8f5f3cb9712.glb',
  },
];

const VENDOR_DIR = path.resolve('vendor/models');
const OUT_DIR = path.resolve('public/models');
const BUDGET_BYTES = 15 * 1024 * 1024;

async function fetchToVendor(source: Source): Promise<string> {
  const file = path.join(VENDOR_DIR, `${source.animal}.glb`);
  try {
    await stat(file);
    return file;
  } catch {
    // not cached yet
  }
  const response = await fetch(source.fileUrl);
  if (!response.ok) throw new Error(`${source.animal}: HTTP ${response.status} from poly.pizza`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function main() {
  await mkdir(VENDOR_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let total = 0;
  const rows: string[] = [];

  for (const source of SOURCES) {
    const rawPath = await fetchToVendor(source);
    const document = await io.read(rawPath);

    // Every clip is present twice; the `Armature|Clip` copies are the
    // Blender export artefact, the bare names are what the game plays.
    for (const animation of document.getRoot().listAnimations()) {
      if (animation.getName().includes('|')) animation.dispose();
    }

    await document.transform(
      dedup(),
      prune(),
      weld(),
      resample(),
      quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    );

    const clips = document
      .getRoot()
      .listAnimations()
      .map((a) => a.getName())
      .sort();
    const outPath = path.join(OUT_DIR, `${source.animal}.glb`);
    await io.write(outPath, document);
    const bytes = (await readFile(outPath)).byteLength;
    total += bytes;
    const rawBytes = (await stat(rawPath)).size;
    console.log(
      `${source.animal.padEnd(7)} ${(rawBytes / 1024).toFixed(0).padStart(5)} KB -> ${(bytes / 1024)
        .toFixed(0)
        .padStart(4)} KB  clips: ${clips.join(', ')}`,
    );
    rows.push(
      `| ${source.animal} | [${source.pageUrl}](${source.pageUrl}) | ${(bytes / 1024).toFixed(0)} KB |`,
    );
  }

  if (total > BUDGET_BYTES) {
    throw new Error(
      `public/models is ${(total / 1024 / 1024).toFixed(1)} MB, over the 15 MB budget`,
    );
  }

  const credits = `# Model credits

Every model in this directory is from Quaternius' **Ultimate Animated Animals** pack, released
under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — public domain, no attribution
required (credited anyway, because it is excellent work).

- Author: [Quaternius](https://quaternius.com/) — pack page:
  <https://quaternius.com/packs/ultimateanimatedanimals.html>
- Mirror used for download: [poly.pizza](https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS)

The files here are optimized copies produced by \`scripts/prepare-models.ts\` (duplicate clips
stripped, dedup, prune, weld, resampled animation, quantized attributes). Total:
${(total / 1024).toFixed(0)} KB.

| Animal | Source | Size |
| --- | --- | --- |
${rows.join('\n')}
`;
  await writeFile(path.join(OUT_DIR, 'CREDITS.md'), credits);
  console.log(`total ${(total / 1024).toFixed(0)} KB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
