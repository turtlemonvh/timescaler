import type { Pose } from '../animals/clips';
import type { AnimalId } from '../animals/roster';

/**
 * How fast each animal's Gallop clip carries it over the ground, in scene
 * units per second at the map's 0.9 scale and 1× playback — measured from
 * the models by tracking the hooves' backward speed while planted. Playing
 * the clip faster or slower than ground speed ÷ this makes the feet skate.
 */
export const GALLOP_SPEED: Readonly<Record<AnimalId, number>> = {
  fox: 2.9,
  deer: 3.4,
  stag: 3.2,
  wolf: 3.1,
  alpaca: 2.3,
  husky: 2.9,
};

/** The Walk clips are slow ambles (~0.6 u/s); only worth it for a shuffle. */
const WALK_SPEED = 0.7;
/** A trip shorter than this walks instead of galloping. */
const WALK_BELOW = 0.8;
/** One leg between neighbouring peaks (~4-6 u) should take about this long. */
const LEG_SECONDS = 1.2;
/** Clip playback stays within this band of 1×, so the gait still looks like a gait. */
const MIN_TIME_SCALE = 1.0;
const MAX_TIME_SCALE = 1.9;

export interface TravelPlan {
  pose: Pose;
  /** Ground speed, units per second. */
  speed: number;
  ms: number;
  /** Clip playback rate that matches `speed`, so the feet plant. */
  timeScale: number;
}

/**
 * How the animal covers `distance` units of trail: a gallop whose playback
 * rate always matches its ground speed. Short hops take about a second;
 * crossing the whole island takes longer rather than skating.
 */
export function travelPlan(distance: number, animalId: AnimalId): TravelPlan {
  if (distance < WALK_BELOW) {
    const timeScale = 1.6;
    const speed = WALK_SPEED * timeScale;
    return { pose: 'walk', speed, ms: (distance / speed) * 1000, timeScale };
  }
  const gallop = GALLOP_SPEED[animalId];
  const speed = Math.min(
    gallop * MAX_TIME_SCALE,
    Math.max(gallop * MIN_TIME_SCALE, distance / LEG_SECONDS),
  );
  return { pose: 'run', speed, ms: (distance / speed) * 1000, timeScale: speed / gallop };
}
