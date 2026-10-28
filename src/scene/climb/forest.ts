import { mulberry32 } from '../../engine/rng';
import type { PineSpot } from '../world/Pines';
import {
  FOREST_FLOOR,
  WALL_JITTER,
  fallLanding,
  ledgePoints,
  summitY,
  wallSurface,
  type Vec3,
} from './cliffPath';

/**
 * Where the climb's pines stand, as pure data (the same draws from the same
 * seeds as before, so each peak's forest keeps its look). Pure so the tests
 * can check a fallen climber never lands inside a tree.
 */

/** How far a wall pine leans out from the rock (radians, about X). */
export const WALL_PINE_TILT = 0.22;

export interface WallPine extends PineSpot {
  /** The rock ledge its roots grip: a squashed boulder centred here. */
  shelf: Vec3 & { size: number };
}

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

/**
 * Pines clinging to the sides of the cliff. Each stands on a rock shelf
 * just in front of the actual face (`wallSurface`, which knows the edge
 * recede and the noise the old flat `wallZ + 0.25` ignored, so the trees
 * hung up to a unit in front of the rock), leaning out from the wall like a
 * tree growing towards the light.
 */
export function wallPines(height: number, peakId: number): WallPine[] {
  const rng = mulberry32(peakId * 211 + 5);
  const spots: WallPine[] = [];
  const top = summitY(height);
  const route = ledgePoints(height, peakId);
  for (let i = 0; i < 16; i++) {
    const side = rng() > 0.5 ? 1 : -1;
    // Below the peak's shoulders, where the face is its full width.
    const y = 1 + rng() * Math.max(1, top - 9);
    // Inside the buttressed edge (never nearer than ~4.7), shelf and all.
    const x = side * (3.0 + rng() * 0.9);
    const scale = 0.45 + rng() * 0.45;
    const rotation = rng() * Math.PI;
    const base = y - 0.2;
    const surface = wallSurface(x, base, peakId, route).z;
    const size = 0.35 + scale * 0.35;
    spots.push({
      x,
      y: base,
      // Clear of the face even where the mesh's jitter bulges it out.
      z: surface + WALL_JITTER + 0.12,
      scale,
      rotation,
      tilt: WALL_PINE_TILT,
      // Its top face a little above the trunk's base, so the roots are in it.
      shelf: { x, y: base - size * 0.2, z: surface + 0.15, size },
    });
  }
  return spots;
}
