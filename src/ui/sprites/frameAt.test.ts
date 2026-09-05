import { describe, expect, it } from 'vitest';
import { frameAt, poseDurationMs } from './frameAt';
import type { SpritePose } from './manifest';

const looping: SpritePose = {
  frames: ['a.png', 'b.png', 'c.png', 'd.png'],
  fps: 8,
  loop: true,
};

const once: SpritePose = {
  frames: ['a.png', 'b.png', 'c.png'],
  fps: 4,
  loop: false,
};

const single: SpritePose = { frames: ['only.png'], fps: 4, loop: false };

describe('frameAt', () => {
  it('starts on frame 0', () => {
    expect(frameAt(looping, 0)).toBe(0);
  });

  it('advances one frame per 1/fps seconds', () => {
    // 8 fps => 125 ms per frame.
    expect(frameAt(looping, 124)).toBe(0);
    expect(frameAt(looping, 125)).toBe(1);
    expect(frameAt(looping, 249)).toBe(1);
    expect(frameAt(looping, 250)).toBe(2);
    expect(frameAt(looping, 375)).toBe(3);
  });

  it('wraps a looping pose back to frame 0 after a full cycle', () => {
    expect(frameAt(looping, 500)).toBe(0);
    expect(frameAt(looping, 625)).toBe(1);
    expect(frameAt(looping, 5000)).toBe(0);
  });

  it('holds the last frame of a non-looping pose forever', () => {
    expect(frameAt(once, 0)).toBe(0);
    expect(frameAt(once, 250)).toBe(1);
    expect(frameAt(once, 500)).toBe(2);
    expect(frameAt(once, 750)).toBe(2);
    expect(frameAt(once, 60_000)).toBe(2);
  });

  it('never returns a frame outside the pose', () => {
    for (const pose of [looping, once, single]) {
      for (let ms = 0; ms < 4000; ms += 7) {
        const frame = frameAt(pose, ms);
        expect(Number.isInteger(frame)).toBe(true);
        expect(frame).toBeGreaterThanOrEqual(0);
        expect(frame).toBeLessThan(pose.frames.length);
      }
    }
  });

  it('is frame 0 for a single-frame pose at any time', () => {
    expect(frameAt(single, 0)).toBe(0);
    expect(frameAt(single, 10_000)).toBe(0);
  });

  it('treats negative and non-finite time as the start of the pose', () => {
    expect(frameAt(looping, -1)).toBe(0);
    expect(frameAt(looping, -10_000)).toBe(0);
    expect(frameAt(looping, Number.NaN)).toBe(0);
    expect(frameAt(looping, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('is a pure function of time — same input, same frame', () => {
    expect(frameAt(looping, 300)).toBe(frameAt(looping, 300));
    expect(frameAt(looping, 300)).toBe(frameAt(looping, 300 + poseDurationMs(looping)));
  });
});

describe('poseDurationMs', () => {
  it('is frames / fps, in ms', () => {
    expect(poseDurationMs(looping)).toBe(500);
    expect(poseDurationMs(once)).toBe(750);
  });
});
