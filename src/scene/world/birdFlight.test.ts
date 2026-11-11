import { describe, expect, it } from 'vitest';
import { HAWK_CYCLE, HAWK_FLAP, hawkPose, songbirdPose, songbirdRhythm, warp } from './birdFlight';

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
