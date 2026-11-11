import { describe, expect, it } from 'vitest';
import { climbHeight } from '../../engine/climb';
import { PEAKS } from '../../engine/peaks';
import { WALL_COLUMNS, ledgePoint, wallGrid, wallOutline, type WallGrid } from '../climb/cliffPath';
import { FLAG, summitFlagFoot } from '../climb/flag';
import {
  HAWK_CYCLE,
  HAWK_FLAP,
  hawkOrbit,
  hawkPose,
  songbirdPose,
  songbirdRhythm,
  warp,
} from './birdFlight';

const DT = 1 / 240;

/** Time spent with the shoulder falling vs rising, over the flapping part of one cycle. */
function strokeTimes(seed: number) {
  const { flapping, offset } = songbirdRhythm(seed);
  // Start of a cycle: t + offset ≡ 0.
  const start = -offset;
  let down = 0;
  let up = 0;
  let prev = songbirdPose(start, seed).shoulder;
  for (let t = start + DT; t < start + flapping; t += DT) {
    const s = songbirdPose(t, seed).shoulder;
    if (s < prev) down += DT;
    else if (s > prev) up += DT;
    prev = s;
  }
  return { down, up };
}

describe('warp', () => {
  it('maps the downstroke share of the beat onto the first half of the cosine', () => {
    expect(warp(0)).toBe(0);
    expect(warp(0.4)).toBeCloseTo(0.5);
    expect(warp(0.999)).toBeCloseTo(1, 2);
    expect(warp(0.45, 0.45)).toBeCloseTo(0.5);
  });
});

describe('songbirdPose', () => {
  it.each([0, 1, 2])('bird %i: the downstroke is shorter than the upstroke', (seed) => {
    const { down, up } = strokeTimes(seed);
    expect(down).toBeGreaterThan(0);
    expect(down).toBeLessThan(up * 0.8);
  });

  it.each([0, 1, 2])('bird %i: wings swing through a full beat while flapping', (seed) => {
    const { flapping, offset } = songbirdRhythm(seed);
    const shoulders: number[] = [];
    for (let t = -offset; t < -offset + flapping; t += DT)
      shoulders.push(songbirdPose(t, seed).shoulder);
    expect(Math.max(...shoulders)).toBeGreaterThan(0.9);
    expect(Math.min(...shoulders)).toBeLessThan(-0.6);
  });

  it.each([0, 1, 2])('bird %i: glide frames hold the wings steady and slightly raised', (seed) => {
    const { flapping, glide, offset } = songbirdRhythm(seed);
    const start = -offset + flapping + 0.01;
    for (let t = start; t < start + glide - 0.02; t += DT) {
      const pose = songbirdPose(t, seed);
      expect(pose.shoulder).toBeGreaterThanOrEqual(0.1);
      expect(pose.shoulder).toBeLessThanOrEqual(0.14);
      expect(pose.wrist).toBe(-0.05);
    }
  });

  it('the three birds never flap in sync', () => {
    const rhythms = [0, 1, 2].map(songbirdRhythm);
    expect(new Set(rhythms.map((r) => r.beat)).size).toBe(3);
    // Sampled over a long stretch, no two birds hold the same wing angle throughout.
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      let apart = 0;
      let samples = 0;
      for (let t = 0; t < 30; t += 0.05) {
        samples++;
        if (Math.abs(songbirdPose(t, a).shoulder - songbirdPose(t, b).shoulder) > 0.2) apart++;
      }
      expect(apart / samples).toBeGreaterThan(0.3);
    }
  });

  it('banks only slightly', () => {
    for (let t = 0; t < 20; t += 0.1)
      expect(Math.abs(songbirdPose(t, 1).bank)).toBeLessThanOrEqual(0.08);
  });
});

/** Every summit height a peak's climbs can have (one per difficulty). */
function summitHeights(peak: (typeof PEAKS)[number]): number[] {
  return [...new Set(Array.from({ length: 10 }, (_, d) => climbHeight(peak, d + 1)))];
}

/** The nearest and furthest z of the cliff mesh over a box of the face, or null where it has no rock. */
function rockDepth(grid: WallGrid, minX: number, maxX: number, minY: number, maxY: number) {
  const { rows, positions } = grid;
  const stride = WALL_COLUMNS + 1;
  let min = Infinity;
  let max = -Infinity;
  // Rows run bottom to top and vertices wander under a row's spacing, so a
  // one-row margin is enough to skip rows that can't reach the box.
  const rowStep = (positions[stride * rows * 3 + 1] - positions[1]) / rows;
  for (let row = 0; row < rows; row++) {
    const rowY = positions[row * stride * 3 + 1];
    if (rowY + 2 * rowStep < minY || rowY - rowStep > maxY) continue;
    for (let col = 0; col < WALL_COLUMNS; col++) {
      const a = row * stride + col;
      const corners = [a, a + 1, a + stride, a + stride + 1];
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const v of corners) {
        x0 = Math.min(x0, positions[v * 3]);
        x1 = Math.max(x1, positions[v * 3]);
        y0 = Math.min(y0, positions[v * 3 + 1]);
        y1 = Math.max(y1, positions[v * 3 + 1]);
      }
      if (x1 < minX || x0 > maxX || y1 < minY || y0 > maxY) continue;
      for (const v of corners) {
        min = Math.min(min, positions[v * 3 + 2]);
        max = Math.max(max, positions[v * 3 + 2]);
      }
    }
  }
  return min === Infinity ? null : { min, max };
}

describe('hawkOrbit', () => {
  // The hawk's half-span (shoulder + inner + outer panel) at its default scale of 0.8.
  const REACH = (0.06 + 0.3 + 0.32) * 0.8;
  // One full circle and more, so every point of it (and of the bob) is covered.
  const samples = Array.from({ length: 300 }, (_, i) => hawkOrbit(i * 0.1));
  // How far behind the summit standing point the climber's body can reach.
  const CLIMBER_BACK = 0.6;

  it('is always further back than the flag and the climber, on every peak', () => {
    for (const peak of PEAKS) {
      for (const height of summitHeights(peak)) {
        const summit = ledgePoint(height, peak.id);
        const foot = summitFlagFoot(height, peak.id);
        // The cloth only swings forward, so the pole and finial are the flag's back.
        const flagBack = foot.z - Math.max(FLAG.poleRadius, FLAG.finialRadius);
        const back = Math.min(flagBack, summit.z - CLIMBER_BACK) - 0.5;
        for (const p of samples) expect(summit.z + p.z + REACH).toBeLessThan(back);
      }
    }
  });

  it('never pokes through the rock: wherever the face is behind it, it is wholly behind the face', () => {
    for (const peak of PEAKS) {
      for (const height of summitHeights(peak)) {
        const summit = ledgePoint(height, peak.id);
        let grid: WallGrid | null = null;
        for (const p of samples) {
          const x = summit.x + p.x;
          const y = summit.y + p.y;
          const z = summit.z + p.z;
          const outlines = [y - REACH, y + REACH].map((h) => wallOutline(h, height, peak.id));
          if (outlines.every((o) => x + REACH < o.minX || x - REACH > o.maxX)) continue;
          grid ??= wallGrid(height, peak.id);
          const rock = rockDepth(grid, x - REACH, x + REACH, y - REACH, y + REACH);
          if (rock) expect(z + REACH).toBeLessThan(rock.min);
        }
      }
    }
  });

  it('faces along the circle', () => {
    const a = hawkOrbit(1);
    const b = hawkOrbit(1.01);
    const heading = Math.atan2(-(b.z - a.z), b.x - a.x);
    const diff = Math.atan2(Math.sin(heading - a.yaw), Math.cos(heading - a.yaw));
    expect(Math.abs(diff)).toBeLessThan(0.05);
  });
});

describe('hawkPose', () => {
  it('mostly glides on a shallow V', () => {
    let gliding = 0;
    let samples = 0;
    for (let t = 0; t < HAWK_CYCLE; t += DT) {
      samples++;
      const { shoulder } = hawkPose(t);
      if (Math.abs(shoulder - 0.18) <= 0.031) gliding++;
    }
    expect(gliding / samples).toBeGreaterThan(0.6);
  });

  it('makes two slow beats each cycle', () => {
    // Count the bottoms of the stroke (shoulder below the glide's dihedral, turning upwards).
    let bottoms = 0;
    let prev = hawkPose(0).shoulder;
    let falling = false;
    for (let t = DT; t < HAWK_FLAP; t += DT) {
      const s = hawkPose(t).shoulder;
      if (falling && s > prev && s < 0) bottoms++;
      falling = s < prev;
      prev = s;
    }
    expect(bottoms).toBe(2);
  });
});
