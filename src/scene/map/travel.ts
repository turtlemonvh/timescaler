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
/** One leg between neighbouring peaks (~3-5 u) should take about this long. */
const LEG_SECONDS = 1.2;
/** No trip takes longer than this, however far: a kid tapped a mountain and is waiting. */
export const MAX_TRIP_SECONDS = 4;
/** Clip playback stays within this band of 1×, so the gait still looks like a gait… */
const MIN_TIME_SCALE = 1.0;
const MAX_TIME_SCALE = 1.9;
/** …except on a cross-island dash, which may hurry the clip this far (and, beyond
 * it, accept a little skating rather than a longer wait). */
export const MAX_DASH_TIME_SCALE = 2.6;
/** Even the slowest gallop (the alpaca's) may cover a leg at this speed, so no
 * animal is much slower to get about than the others. */
const MIN_TOP_SPEED = 5.5;

export interface TravelPlan {
  pose: Pose;
  /** Ground speed, units per second. */
  speed: number;
  ms: number;
  /** Clip playback rate that matches `speed` (up to MAX_DASH_TIME_SCALE), so the feet plant. */
  timeScale: number;
}

/**
 * How the animal covers `distance` units of trail: a gallop whose playback
 * rate matches its ground speed. Short hops take about a second; a long trip
 * is capped at MAX_TRIP_SECONDS by galloping faster.

 */
export function travelPlan(distance: number, animalId: AnimalId): TravelPlan {
  const gallop = GALLOP_SPEED[animalId];
  const capped = distance / MAX_TRIP_SECONDS;
  if (distance < WALK_BELOW) {
    const timeScale = 1.6;
    const speed = WALK_SPEED * timeScale;
    return { pose: 'walk', speed, ms: (distance / speed) * 1000, timeScale };
  }
  const top = Math.max(gallop * MAX_TIME_SCALE, MIN_TOP_SPEED);
  const speed = Math.max(
    capped,
    Math.min(top, Math.max(gallop * MIN_TIME_SCALE, distance / LEG_SECONDS)),
  );
  return {
    pose: 'run',
    speed,
    ms: (distance / speed) * 1000,
    timeScale: Math.min(MAX_DASH_TIME_SCALE, speed / gallop),
  };
}
