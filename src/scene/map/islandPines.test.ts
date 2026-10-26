import { describe, expect, it } from 'vitest';
import { ISLAND_RADIUS, PEAK_SPOTS, standPoint } from './peakLayout';
import { islandPines } from './islandPines';
import { TRAIL, trailPointAt } from './trailPath';

describe('islandPines', () => {
  const pines = islandPines(0.75);

  it('plants a full forest on the island', () => {
    expect(pines.length).toBe(140);
    for (const pine of pines) expect(Math.hypot(pine.x, pine.z)).toBeLessThan(ISLAND_RADIUS);
  });

  it('keeps trees off the trail and away from where the animal stands', () => {
    for (const pine of pines) {
      for (let s = 0; s <= TRAIL.length; s += 0.1) {
        const point = trailPointAt(s);
        expect(Math.hypot(point.x - pine.x, point.z - pine.z)).toBeGreaterThan(0.9);
      }
      for (const spot of PEAK_SPOTS) {
        const stand = standPoint(spot);
        expect(Math.hypot(stand.x - pine.x, stand.z - pine.z)).toBeGreaterThan(1.4);
        expect(Math.hypot(spot.x - pine.x, spot.z - pine.z)).toBeGreaterThan(spot.radius + 1.5);
      }
    }
  });
});
