import { describe, expect, it } from 'vitest';
import {
  ALLOWED_FRAME_SIZES,
  REQUIRED_POSES,
  parseSpriteManifest,
  parseSpriteSourceManifest,
} from './manifest';

const credit = {
  pack: 'Jumper Pack',
  author: 'Kenney',
  url: 'https://kenney.nl/assets/jumper-pack',
  downloadUrl: 'https://kenney.nl/example.zip',
  license: 'CC0 1.0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
};

function validManifest() {
  return {
    animal: 'bunny',
    displayName: 'Bunny',
    frameSize: 96,
    basePath: 'sprites/bunny',
    credit: { ...credit },
    poses: {
      idle: { frames: ['idle_00.png', 'idle_01.png'], fps: 2, loop: true },
      move: {
        frames: ['move_00.png', 'move_01.png', 'move_02.png', 'move_03.png'],
        fps: 8,
        loop: true,
      },
      hurt: { frames: ['hurt_00.png'], fps: 4, loop: false },
      celebrate: {
        frames: ['celebrate_00.png', 'celebrate_01.png', 'celebrate_02.png', 'celebrate_03.png'],
        fps: 6,
        loop: true,
      },
    },
  };
}

function validSource() {
  return {
    animal: 'bunny',
    displayName: 'Bunny',
    frameSize: 96,
    source: { kind: 'dir', path: 'vendor/pack/PNG' },
    licenseFile: 'vendor/pack/License.txt',
    credit: { ...credit },
    poses: {
      idle: { frames: ['stand.png', 'ready.png'], fps: 2, loop: true },
      move: { frames: ['w1.png', 'stand.png', 'w2.png', 'stand.png'], fps: 8, loop: true },
      hurt: { frames: ['hurt.png'], fps: 4, loop: false },
      celebrate: { frames: ['ready.png', 'jump.png', 'stand.png', 'jump.png'], fps: 6, loop: true },
    },
  };
}

describe('parseSpriteManifest', () => {
  it('accepts a well-formed manifest and returns it typed', () => {
    const manifest = parseSpriteManifest(validManifest());
    expect(manifest.animal).toBe('bunny');
    expect(manifest.frameSize).toBe(96);
    expect(manifest.poses.move.frames).toHaveLength(4);
    expect(manifest.credit.license).toBe('CC0 1.0');
  });

  it('requires every pose the game knows how to show', () => {
    for (const pose of REQUIRED_POSES) {
      const broken = validManifest();
      delete (broken.poses as Record<string, unknown>)[pose];
      expect(() => parseSpriteManifest(broken)).toThrow(
        new RegExp(`missing required pose.*${pose}`),
      );
    }
  });

  it('requires at least 4 move frames, so a walk cycle actually reads as walking', () => {
    const broken = validManifest();
    broken.poses.move.frames = ['move_00.png', 'move_01.png'];
    expect(() => parseSpriteManifest(broken)).toThrow(/at least 4 frames, got 2/);
  });

  it('only allows frame sizes the pipeline actually produces', () => {
    for (const size of ALLOWED_FRAME_SIZES) {
      expect(() => parseSpriteManifest({ ...validManifest(), frameSize: size })).not.toThrow();
    }
    expect(() => parseSpriteManifest({ ...validManifest(), frameSize: 100 })).toThrow(
      /frameSize.*expected one of 64, 96/,
    );
    expect(() => parseSpriteManifest({ ...validManifest(), frameSize: '96' })).toThrow(/frameSize/);
  });

  it('rejects a basePath that would double up slashes at join time', () => {
    expect(() => parseSpriteManifest({ ...validManifest(), basePath: '/sprites/bunny' })).toThrow(
      /must not start or end with/,
    );
    expect(() => parseSpriteManifest({ ...validManifest(), basePath: 'sprites/bunny/' })).toThrow(
      /must not start or end with/,
    );
  });

  it('rejects frame entries that are not png file names', () => {
    const broken = validManifest();
    broken.poses.idle.frames = ['idle_00.webp', 'idle_01.png'];
    expect(() => parseSpriteManifest(broken)).toThrow(/poses\.idle\.frames\[0\]/);
  });

  it('rejects an empty frame list', () => {
    const broken = validManifest();
    broken.poses.hurt.frames = [];
    expect(() => parseSpriteManifest(broken)).toThrow(/non-empty array/);
  });

  it('rejects an out-of-range fps', () => {
    const zero = validManifest();
    zero.poses.idle.fps = 0;
    expect(() => parseSpriteManifest(zero)).toThrow(/fps.*\(0, 60]/);

    const tooFast = validManifest();
    tooFast.poses.idle.fps = 240;
    expect(() => parseSpriteManifest(tooFast)).toThrow(/fps/);
  });

  it('requires the full credit block, so nothing ships without attribution', () => {
    for (const field of ['pack', 'author', 'url', 'downloadUrl', 'license', 'licenseUrl']) {
      const broken = validManifest();
      delete (broken.credit as Record<string, unknown>)[field];
      expect(() => parseSpriteManifest(broken)).toThrow(new RegExp(`credit\\.${field}`));
    }
  });

  it('rejects non-objects with a useful message', () => {
    expect(() => parseSpriteManifest(null)).toThrow(/expected an object/);
    expect(() => parseSpriteManifest([])).toThrow(/expected an object, got an array/);
    expect(() => parseSpriteManifest('{}')).toThrow(/expected an object, got string/);
  });
});

describe('parseSpriteSourceManifest', () => {
  it('accepts a directory source', () => {
    const source = parseSpriteSourceManifest(validSource());
    expect(source.source).toEqual({ kind: 'dir', path: 'vendor/pack/PNG' });
    expect(source.licenseFile).toBe('vendor/pack/License.txt');
    expect(source.poses.celebrate.frames).toEqual([
      'ready.png',
      'jump.png',
      'stand.png',
      'jump.png',
    ]);
  });

  it('accepts a sprite-sheet source with cell indices', () => {
    const sheet = {
      ...validSource(),
      source: {
        kind: 'sheet',
        path: 'vendor/pack/sheet.png',
        frameWidth: 32,
        frameHeight: 32,
        columns: 8,
      },
      poses: {
        idle: { frames: [0, 1], fps: 2, loop: true },
        move: { frames: [8, 9, 10, 11], fps: 8, loop: true },
        hurt: { frames: [16], fps: 4, loop: false },
        celebrate: { frames: [24, 25, 26, 27], fps: 6, loop: true },
      },
    };
    const parsed = parseSpriteSourceManifest(sheet);
    expect(parsed.source).toEqual({
      kind: 'sheet',
      path: 'vendor/pack/sheet.png',
      frameWidth: 32,
      frameHeight: 32,
      columns: 8,
    });
    expect(parsed.poses.move.frames).toEqual([8, 9, 10, 11]);
  });

  it('rejects an unknown source kind', () => {
    const broken = { ...validSource(), source: { kind: 'atlas', path: 'x' } };
    expect(() => parseSpriteSourceManifest(broken)).toThrow(/expected "dir" or "sheet"/);
  });

  it('rejects sheet cell indices in a dir source, and file names in a sheet source', () => {
    const dirWithIndices = validSource();
    (dirWithIndices.poses.idle as { frames: unknown[] }).frames = [0, 1];
    expect(() => parseSpriteSourceManifest(dirWithIndices)).toThrow(/needs file names/);

    const sheetWithNames = {
      ...validSource(),
      source: { kind: 'sheet', path: 's.png', frameWidth: 32, frameHeight: 32, columns: 4 },
    };
    expect(() => parseSpriteSourceManifest(sheetWithNames)).toThrow(/needs cell indices/);
  });

  it('rejects a sheet source missing its grid dimensions', () => {
    const broken = { ...validSource(), source: { kind: 'sheet', path: 's.png', frameWidth: 32 } };
    expect(() => parseSpriteSourceManifest(broken)).toThrow(/frameHeight/);
  });

  it('makes licenseFile optional but typed', () => {
    const withoutLicense = validSource();
    delete (withoutLicense as { licenseFile?: string }).licenseFile;
    expect(parseSpriteSourceManifest(withoutLicense).licenseFile).toBeUndefined();

    expect(() => parseSpriteSourceManifest({ ...validSource(), licenseFile: 7 })).toThrow(
      /licenseFile/,
    );
  });

  it('applies the same required-pose and move-length rules as the output manifest', () => {
    const noHurt = validSource();
    delete (noHurt.poses as Record<string, unknown>).hurt;
    expect(() => parseSpriteSourceManifest(noHurt)).toThrow(/missing required pose\(s\): hurt/);

    const shortMove = validSource();
    shortMove.poses.move.frames = ['w1.png', 'w2.png'];
    expect(() => parseSpriteSourceManifest(shortMove)).toThrow(/at least 4 frames/);
  });
});
