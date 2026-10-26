import { describe, expect, it } from 'vitest';
import { PEAK_SPOTS, standPoint } from './peakLayout';
import { TRAIL, trailHeadingAt, trailPointAt, trailSamples, trailStop } from './trailPath';

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe('trailPath', () => {
  it('runs through every stand point, in peak order', () => {
    for (const spot of PEAK_SPOTS) {
      const at = trailPointAt(trailStop(spot.id));
      expect(distance(at, standPoint(spot)), `peak ${spot.id}`).toBeLessThan(1e-6);
    }
    for (let id = 2; id <= PEAK_SPOTS.length; id++) {
      expect(trailStop(id)).toBeGreaterThan(trailStop(id - 1));
    }
    expect(trailStop(1)).toBe(0);
    expect(trailStop(PEAK_SPOTS.length)).toBeCloseTo(TRAIL.length, 9);
  });

  it('never passes inside a mountain', () => {
    // Re-derived from the cones themselves (centre + base radius), sampled far
    // finer than the trail's own points so no chord between them sneaks in.
    for (let s = 0; s <= TRAIL.length; s += 0.05) {
      const point = trailPointAt(s);
      for (const spot of PEAK_SPOTS) {
        expect(
          distance(point, spot),
          `s=${s.toFixed(2)} (${point.x.toFixed(2)}, ${point.z.toFixed(2)}) vs cone ${spot.id}`,
        ).toBeGreaterThanOrEqual(spot.radius + 0.6);
      }
    }
  });

  it('takes the short way round, not a wild detour', () => {
    for (let id = 2; id <= PEAK_SPOTS.length; id++) {
      const leg = trailStop(id) - trailStop(id - 1);
      const chord = distance(standPoint(PEAK_SPOTS[id - 2]), standPoint(PEAK_SPOTS[id - 1]));
      expect(leg, `${id - 1}→${id}`).toBeLessThan(chord * 1.5);
    }
  });

  it('has no kinks: the heading turns gently along the way', () => {
    for (let s = 0.5; s < TRAIL.length - 0.5; s += 0.1) {
      let turn = Math.abs(trailHeadingAt(s + 0.1) - trailHeadingAt(s));
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      // Stand points are corners by design (the trail arrives and leaves), so
      // allow a sharper turn there.
      const nearStop = TRAIL.stops.some((stop) => Math.abs(stop - s) < 0.6);
      if (!nearStop) expect(turn, `s=${s.toFixed(1)}`).toBeLessThan(0.35);
    }
  });

  it('turns through every stand point without a hairpin', () => {
    // A through-trip shouldn't overshoot a stand point and pirouette back:
    // the stand sits on the inside of the trail's bend.
    for (let id = 2; id < PEAK_SPOTS.length; id++) {
      const stop = trailStop(id);
      let turn = Math.abs(trailHeadingAt(stop + 0.8) - trailHeadingAt(stop - 0.8));
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      expect(turn, `peak ${id}`).toBeLessThan(Math.PI / 2);
    }
  });

  it('clamps beyond the ends and samples evenly', () => {
    expect(trailPointAt(-5)).toEqual(trailPointAt(0));
    expect(trailPointAt(TRAIL.length + 5)).toEqual(trailPointAt(TRAIL.length));
    const stones = trailSamples(0.9);
    for (let i = 1; i < stones.length; i++) {
      expect(distance(stones[i], stones[i - 1])).toBeLessThanOrEqual(0.9 + 1e-6);
      // Stand points are corners, where neighbouring stones can bunch up.
      const nearStop = TRAIL.stops.some((stop) => Math.abs(stop - i * 0.9) < 1);
      if (!nearStop) expect(distance(stones[i], stones[i - 1])).toBeGreaterThan(0.5);
    }
  });
});
