import { PEAKS, type Peak } from '../../engine/peaks';

/** A point on the island's ground plane, in scene units (Y is up, so this is X/Z). */
export interface Vec2 {
  x: number;
  z: number;
}

/** Where a peak stands on the overworld island, in scene units. */
export interface PeakSpot {
  id: number;
  x: number;
  z: number;
  /** Base radius of the mountain cone. */
  radius: number;
  /** Height of the cone. Grows with id, not with `peak.height` — see
   * `peaks.ts`: height is a pacing number, not a visual curve. */
  height: number;
}

/**
 * Peak centres, front (+Z, nearest the camera) to back. The trail switches
 * back and forth across the island in three rows — 1→4 left to right, 4→7
 * right to left, 7→9 left to right — and ends with the tallest peak alone at
 * the back. Consecutive peaks sit mostly side by side rather than one behind
 * the other, so from the map camera one mountain doesn't hide the foot (or
 * the animal standing at it) of the next. Hand-placed rather than generated
 * from a curve: the old sine curve's turnarounds bunched peaks 4/5 and 8/9/10
 * into overlapping cones. `peakLayout.test.ts` pins the clearances.
 */
const CENTRES: readonly Vec2[] = [
  { x: -6.3, z: 11.0 },
  { x: -2.5, z: 9.0 },
  { x: 1.7, z: 7.5 },
  { x: 6.0, z: 5.5 },
  { x: 2.6, z: 2.0 },
  { x: -2.1, z: 0.4 },
  { x: -7.6, z: -1.6 },
  { x: -3.6, z: -5.9 },
  { x: 3.3, z: -7.0 },
  { x: 1.0, z: -12.4 },
];

/** Each peak a little taller and wider than the last, so the whole run reads
 * as a journey even before any of them is climbed. */
export function peakSpot(peak: Peak): PeakSpot {
  const t = (peak.id - 1) / (PEAKS.length - 1);
  const centre = CENTRES[peak.id - 1];
  if (!centre) throw new Error(`peakSpot: no layout for peak id ${peak.id}`);
  return {
    id: peak.id,
    x: centre.x,
    z: centre.z,
    radius: 0.9 + t * 0.8,
    height: 1.8 + t * 3.4,
  };
}

export const PEAK_SPOTS: readonly PeakSpot[] = PEAKS.map(peakSpot);

export function peakSpotFor(peakId: number): PeakSpot {
  const spot = PEAK_SPOTS.find((entry) => entry.id === peakId);
  if (!spot) throw new Error(`peakSpotFor: no spot for peak id ${peakId}`);
  return spot;
}

/** Island radius that comfortably contains every peak with some beach to spare. */
export const ISLAND_RADIUS = 16;

/** How far from its own cone's foot the animal stands. */
export const STAND_GAP = 0.75;
/** Minimum distance from a stand point to any *other* cone's foot. */
export const STAND_CLEARANCE = 1.0;

/**
 * Where the animal stands for a given peak: at its foot, on the camera side
 * (+Z) where possible. If that spot is too close to another mountain the
 * stand point swings around the peak (±30°, ±60°, …) to the first clear
 * spot, so the animal is never half-buried in a neighbour.
 */
export function standPoint(spot: PeakSpot): Vec2 {
  const distance = spot.radius + STAND_GAP;
  for (let step = 0; step <= 6; step++) {
    for (const sign of step === 0 ? [1] : [1, -1]) {
      const angle = sign * step * (Math.PI / 6);
      const point = {
        x: spot.x + Math.sin(angle) * distance,
        z: spot.z + Math.cos(angle) * distance,
      };
      const clear = PEAK_SPOTS.every(
        (other) =>
          other.id === spot.id ||
          Math.hypot(other.x - point.x, other.z - point.z) >= other.radius + STAND_CLEARANCE,
      );
      if (clear) return point;
    }
  }
  throw new Error(`standPoint: no clear spot around peak ${spot.id}`);
}
