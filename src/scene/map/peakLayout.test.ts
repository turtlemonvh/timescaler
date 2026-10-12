import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { ISLAND_RADIUS, PEAK_SPOTS, peakSpotFor } from './peakLayout';

describe('peakLayout', () => {
  it('places every peak once, inside the island', () => {
    expect(PEAK_SPOTS.map((s) => s.id)).toEqual(PEAKS.map((p) => p.id));
    for (const spot of PEAK_SPOTS) {
      expect(Math.hypot(spot.x, spot.z) + spot.radius).toBeLessThan(ISLAND_RADIUS);
    }
  });

  it('never overlaps two peaks', () => {
    for (const a of PEAK_SPOTS) {
      for (const b of PEAK_SPOTS) {
        if (a.id >= b.id) continue;
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        expect(distance, `${a.id} vs ${b.id}`).toBeGreaterThan((a.radius + b.radius) * 0.85);
      }
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
