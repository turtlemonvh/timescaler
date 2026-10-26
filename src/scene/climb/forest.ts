import { mulberry32 } from '../../engine/rng';
import type { PineSpot } from '../world/Pines';
import { FOREST_FLOOR, fallLanding, summitY, wallZ, type Vec3 } from './cliffPath';

/**
 * Where the climb's pines stand, as pure data (the same draws from the same
 * seeds as before, so each peak's forest keeps its look). Pure so the tests
 * can check a fallen climber never lands inside a tree.
 */

/** Room kept clear around the fall landing: the fallen animal lies about this far from where it lands. */
export const LANDING_CLEARANCE = 1.9;
/** Radius of a pine's lower canopy at scale 1 (`Pines.tsx`'s LOWER cone). */
export const PINE_RADIUS = 0.55;

function nearLanding(x: number, z: number, scale: number, landing: Vec3): boolean {
  return Math.hypot(x - landing.x, z - landing.z) < LANDING_CLEARANCE + PINE_RADIUS * scale;
}

export function basePines(peakId: number): PineSpot[] {
  const rng = mulberry32(peakId * 101 + 3);
  const landing = fallLanding(peakId);
  const spots: PineSpot[] = [];
  for (let i = 0; i < 90; i++) {
    const x = (rng() - 0.5) * 34;
    const z = 0.8 + rng() * 5;
    // Keep the camera's lane (straight in front of the route) clear.
    if (Math.abs(x) < 3.2) continue;
    const scale = 0.7 + rng() * 0.9;
    const rotation = rng() * Math.PI;
    if (nearLanding(x, z, scale, landing)) continue;
    spots.push({ x, y: FOREST_FLOOR, z, scale, rotation });
  }
  // A thin fringe right under the first ledge, well below eye level.
  for (let i = 0; i < 14; i++) {
    const x = (rng() - 0.5) * 6;
    const z = 0.6 + rng() * 1.6;
    const scale = 0.45 + rng() * 0.35;
    const rotation = rng() * Math.PI;
    if (nearLanding(x, z, scale, landing)) continue;
    spots.push({ x, y: FOREST_FLOOR, z, scale, rotation });
  }
  return spots;
}

export function wallPines(height: number, peakId: number): PineSpot[] {
  const rng = mulberry32(peakId * 211 + 5);
  const spots: PineSpot[] = [];
  const top = summitY(height);
  for (let i = 0; i < 16; i++) {
    const side = rng() > 0.5 ? 1 : -1;
    const y = 1 + rng() * Math.max(1, top - 3);
    const x = side * (3.1 + rng() * 1.3);
    spots.push({
      x,
      y: y - 0.2,
      z: wallZ(y) + 0.25,
      scale: 0.45 + rng() * 0.45,
      rotation: rng() * Math.PI,
    });
  }
  return spots;
}
