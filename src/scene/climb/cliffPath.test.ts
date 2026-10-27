import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import {
  BACKDROP_Z,
  LEDGE_DY,
  ROPE_RADIUS,
  ROUTE_AMPLITUDE,
  WALL_BOTTOM,
  WALL_JITTER,
  arcPoint,
  easeIn,
  easeInOut,
  easeOut,
  ledgePoint,
  ledgePoints,
  ropePoints,
  summitY,
  wallSurface,
  wallOutline,
  wallPeakY,
  wallZ,
} from './cliffPath';
import { wallPines } from './forest';

describe('cliffPath', () => {
  it('starts at the origin and climbs one LEDGE_DY per position on the wall surface', () => {
    for (const peak of PEAKS) {
      const points = ledgePoints(peak.height, peak.id);
      expect(points).toHaveLength(peak.height + 1);
      expect(points[0]).toEqual({ x: 0, y: 0, z: 0 });
      points.forEach((p, i) => {
        expect(p.y).toBeCloseTo(i * LEDGE_DY);
        expect(p.z).toBeCloseTo(wallZ(p.y));
      });
      expect(points[peak.height].y).toBeCloseTo(summitY(peak.height));
    }
  });

  it('keeps every hop reachable: horizontal gap under twice the amplitude plus jitter', () => {
    for (const peak of PEAKS) {
      const points = ledgePoints(peak.height, peak.id);
      for (let i = 1; i < points.length; i++) {
        expect(Math.abs(points[i].x - points[i - 1].x)).toBeLessThan(2 * ROUTE_AMPLITUDE + 0.5);
        expect(Math.abs(points[i].x)).toBeLessThan(ROUTE_AMPLITUDE + 0.3);
      }
    }
  });

  it('is deterministic per (index, peak) and differs between peaks', () => {
    expect(ledgePoint(5, 2)).toEqual(ledgePoint(5, 2));
    expect(ledgePoint(5, 2).x).not.toBeCloseTo(ledgePoint(5, 3).x);
  });

  it('arcPoint interpolates endpoints and lifts the midpoint by apex', () => {
    const from = { x: 0, y: 0, z: 0 };
    const to = { x: 2, y: 2, z: -1 };
    expect(arcPoint(from, to, 0, 1)).toEqual(from);
    expect(arcPoint(from, to, 1, 1)).toEqual(to);
    const mid = arcPoint(from, to, 0.5, 0.8);
    expect(mid.x).toBeCloseTo(1);
    expect(mid.y).toBeCloseTo(1 + 0.8);
    expect(mid.z).toBeCloseTo(-0.5);
    expect(arcPoint(from, to, 0.5, -0.4).y).toBeCloseTo(1 - 0.4);
  });

  it('eases are clamped and monotonic', () => {
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
    expect(easeIn(0.5)).toBeCloseTo(0.25);
    expect(easeOut(0.5)).toBeCloseTo(0.75);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.1) {
      const v = easeInOut(t);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe('ropePoints', () => {
  it('keeps the whole rope in front of the rock, so no stretch of it disappears', () => {
    for (const peak of PEAKS) {
      const route = ledgePoints(peak.height, peak.id);
      for (let i = 0; i < route.length - 1; i++) {
        for (const p of ropePoints(i, peak.id, route)) {
          const rock = wallSurface(p.x, p.y, peak.id, route).z + WALL_JITTER;
          expect(p.z - ROPE_RADIUS).toBeGreaterThan(rock);
        }
      }
    }
  });

  it('stays behind the climber at the ledges it hangs between', () => {
    const peak = PEAKS[0];
    const route = ledgePoints(peak.height, peak.id);
    const points = ropePoints(0, peak.id, route);
    expect(points[0].z).toBeLessThan(route[0].z - 0.3);
    expect(points[points.length - 1].z).toBeLessThan(route[1].z - 0.3);
  });
});

describe('cliff silhouette', () => {
  it('spans every ledge and the climber standing on it, the summit too', () => {
    for (const peak of PEAKS) {
      for (const p of ledgePoints(peak.height, peak.id)) {
        // The tallest animal mid-clip is 1.84 tall and 2.3 long side-on.
        for (const y of [p.y, p.y + 1.9]) {
          const { minX, maxX } = wallOutline(y, peak.height, peak.id);
          expect(minX).toBeLessThan(p.x - 1.2);
          expect(maxX).toBeGreaterThan(p.x + 1.2);
        }
      }
    }
  });

  it('grows every wall pine on rock, not out of the sky', () => {
    for (const peak of PEAKS) {
      for (const pine of wallPines(peak.height, peak.id)) {
        const { minX, maxX } = wallOutline(pine.y + 0.5, peak.height, peak.id);
        expect(pine.x - pine.shelf.size).toBeGreaterThan(minX);
        expect(pine.x + pine.shelf.size).toBeLessThan(maxX);
      }
    }
  });

  it('tapers to a peak behind the summit, with buttressed, wandering sides below', () => {
    for (const peak of PEAKS) {
      const summit = ledgePoint(peak.height, peak.id);
      const width = (y: number) => {
        const { minX, maxX } = wallOutline(y, peak.height, peak.id);
        return maxX - minX;
      };
      expect(width(wallPeakY(peak.height))).toBe(0);
      // Sloping shoulders where the summit swing looks: no vertical edge.
      expect(width(summit.y + 2)).toBeLessThan(width(summit.y) - 2);
      expect(width(summit.y)).toBeLessThan(width(summit.y - 3) - 1.2);
      // Below that, about the old ribbon's width, but never a straight edge.
      const edges: number[] = [];
      for (let y = 0; y < summit.y - 8; y += 0.5) {
        const { minX, maxX } = wallOutline(y, peak.height, peak.id);
        expect(minX).toBeLessThan(-4.6);
        expect(maxX).toBeGreaterThan(4.6);
        expect(maxX).toBeLessThan(6);
        edges.push(maxX);
      }
      expect(Math.max(...edges) - Math.min(...edges)).toBeGreaterThan(0.7);
    }
  });

  it('keeps every part of the cliff well in front of the clouds and distant ranges', () => {
    // A cloud's puffs reach up to ~3 units in front of its centre.
    for (const peak of PEAKS) {
      const route = ledgePoints(peak.height, peak.id);
      for (let y = WALL_BOTTOM; y <= wallPeakY(peak.height); y += 1) {
        const { minX, maxX } = wallOutline(y, peak.height, peak.id);
        for (let x = minX; x <= maxX; x += 0.5) {
          const z = wallSurface(x, y, peak.id, route).z - WALL_JITTER;
          expect(z).toBeGreaterThan(BACKDROP_Z + 3.2);
        }
      }
    }
  });
});
