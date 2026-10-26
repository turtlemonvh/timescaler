import { mulberry32 } from '../../engine/rng';
import type { PineSpot } from '../world/Pines';
import { ISLAND_RADIUS, PEAK_SPOTS, standPoint } from './peakLayout';
import { trailSamples } from './trailPath';

/** Keep trees this far from the trail's centre line, so the walk never brushes a pine. */
export const PINE_TRAIL_CLEARANCE = 1.0;
/** …and this far from where the animal stands, so it isn't nose-to-trunk with one. */
export const PINE_STAND_CLEARANCE = 1.6;

/**
 * The island's forest: seeded, so it is the same every visit, and kept off
 * the mountains, the trail and the stand points.
 */
export function islandPines(topY: number, count = 140): PineSpot[] {
  const rng = mulberry32(2026);
  const trail = trailSamples(0.3);
  const stands = PEAK_SPOTS.map(standPoint);
  const spots: PineSpot[] = [];
  let guard = 0;
  while (spots.length < count && guard++ < 4000) {
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (ISLAND_RADIUS - 1.2);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const scale = 0.55 + rng() * 0.6;
    const rotation = rng() * Math.PI;
    const blocked =
      PEAK_SPOTS.some((spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius + 1.6) ||
      trail.some((point) => Math.hypot(point.x - x, point.z - z) < PINE_TRAIL_CLEARANCE) ||
      stands.some((point) => Math.hypot(point.x - x, point.z - z) < PINE_STAND_CLEARANCE);
    if (blocked) continue;
    spots.push({ x, y: topY - 0.05, z, scale, rotation });
  }
  return spots;
}
