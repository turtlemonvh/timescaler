import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import {
  ISLAND_RADIUS,
  PEAK_SPOTS,
  STAND_CLEARANCE,
  STAND_GAP,
  peakSpotFor,
  standPoint,
} from './peakLayout';

describe('peakLayout', () => {
  it('places every peak once, inside the island', () => {
    expect(PEAK_SPOTS.map((s) => s.id)).toEqual(PEAKS.map((p) => p.id));
    for (const spot of PEAK_SPOTS) {
      expect(Math.hypot(spot.x, spot.z) + spot.radius).toBeLessThan(ISLAND_RADIUS);
    }
  });

  it('leaves walking room between every pair of mountains', () => {
    for (const a of PEAK_SPOTS) {
      for (const b of PEAK_SPOTS) {
        if (a.id >= b.id) continue;
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        // Room for both animals' stand points plus a trail between the feet.
        expect(distance, `${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(a.radius + b.radius + 2.2);
      }
    }
  });

  it('stands the animal at its own peak, clear of every other mountain and on the island', () => {
    for (const spot of PEAK_SPOTS) {
      const stand = standPoint(spot);
      expect(Math.hypot(stand.x - spot.x, stand.z - spot.z)).toBeCloseTo(
        spot.radius + STAND_GAP,
        6,
      );
      expect(Math.hypot(stand.x, stand.z), `peak ${spot.id}`).toBeLessThan(ISLAND_RADIUS - 1.5);
      for (const other of PEAK_SPOTS) {
        if (other.id === spot.id) continue;
        expect(
          Math.hypot(stand.x - other.x, stand.z - other.z),
          `stand ${spot.id} vs cone ${other.id}`,
        ).toBeGreaterThanOrEqual(other.radius + STAND_CLEARANCE);
      }
    }
  });

  it('keeps consecutive peaks side by side rather than hidden one behind the other', () => {
    // The map camera looks along -Z, so a peak directly behind the previous
    // one is occluded by it. Each step moves sideways at least a cone width
    // (bar the last: peak 10 stands alone at the back, behind nothing tall).
    for (let i = 1; i < PEAK_SPOTS.length - 1; i++) {
      const a = PEAK_SPOTS[i - 1];
      const b = PEAK_SPOTS[i];
      expect(Math.abs(a.x - b.x), `${a.id}→${b.id}`).toBeGreaterThan(a.radius + b.radius);
    }
  });

  it('gets taller and wider with peak id', () => {
    for (let i = 1; i < PEAK_SPOTS.length; i++) {
      expect(PEAK_SPOTS[i].height).toBeGreaterThan(PEAK_SPOTS[i - 1].height);
      expect(PEAK_SPOTS[i].radius).toBeGreaterThan(PEAK_SPOTS[i - 1].radius);
    }
  });

  it('throws on an unknown id', () => {
    expect(() => peakSpotFor(42)).toThrow();
  });
});
