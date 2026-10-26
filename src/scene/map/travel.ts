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
/** No trip takes longer than this, however far — even peak 1 to peak 10: a kid
 * tapped a mountain and is waiting. */
export const MAX_TRIP_SECONDS = 1.9;
/** Clip playback stays within this band of 1× on ordinary hops, so the gait
 * still looks like a gait… */
const MIN_TIME_SCALE = 1.0;
const MAX_TIME_SCALE = 1.9;
/** …a longer dash may hurry the clip up to this (still reads as a sprint), and
 * beyond it the animal covers more ground per stride than the clip shows — a
 * little skating on the longest trips rather than a longer wait. */
export const MAX_DASH_TIME_SCALE = 3;
/** Every animal may cover ground at least this fast, so the slow alpaca gallop
 * doesn't make it the slowest to get about. */
const MIN_TOP_SPEED = 7;
/** Fraction of a trip spent speeding up from a standstill, and slowing to a stop. */
export const RAMP = 0.15;

export interface TravelPlan {
  pose: Pose;
  /** Cruising ground speed (between the ramps), units per second. */
  speed: number;
  ms: number;
  /** Clip playback rate that matches `speed` (up to MAX_DASH_TIME_SCALE). */
  timeScale: number;
  /** Whether the trip starts from a standstill (false: a re-target mid-gallop). */
  rampIn: boolean;
}

/** How much faster than average a trip cruises, given the time lost in its ramps. */
function cruiseFactor(rampIn: boolean): number {
  return 1 / (1 - ((rampIn ? RAMP : 0) + RAMP) / 2);
}

/**
 * How far along a trip (0..1) the animal is at time fraction `t` (0..1):
 * constant cruising speed, with a short linear speed-up at the start (from a
 * standstill) and slow-down at the end, so a dash reads as one.
 */
export function tripProgress(t: number, rampIn: boolean): number {
  const clamped = Math.max(0, Math.min(1, t));
  const inRamp = rampIn ? RAMP : 0;
  const peak = cruiseFactor(rampIn);
  if (clamped < inRamp) return (peak * clamped * clamped) / (2 * inRamp);
  if (clamped > 1 - RAMP) return 1 - (peak * (1 - clamped) ** 2) / (2 * RAMP);
  return peak * (clamped - inRamp / 2);
}

/**
 * How the animal covers `distance` units of trail: a gallop whose playback
 * rate matches its cruising speed on ordinary hops (about a second each). The
 * farther the trip, the faster it goes, so no trip takes as long as
 * MAX_TRIP_SECONDS; on the longest the clip runs up to MAX_DASH_TIME_SCALE
 * and the feet skate a little.
 *
 * `runningTimeScale` is the playback rate of a gallop already under way (a
 * new pick mid-trip). The plan then keeps that rate — changing it would
 * restart the clip from frame 0, a visible hitch — and cruises at the speed
 * it matches, only going faster if the cap demands. No ramp-in: it is
 * already running.
 */
export function travelPlan(
  distance: number,
  animalId: AnimalId,
  runningTimeScale?: number,
): TravelPlan {
  const gallop = GALLOP_SPEED[animalId];
  const rampIn = runningTimeScale === undefined;
  const factor = cruiseFactor(rampIn);
  // The cruising speed that makes the whole trip, ramps included, fit the cap.
  const capped = (distance / MAX_TRIP_SECONDS) * factor;
  const msFor = (speed: number) => ((distance * factor) / speed) * 1000;
  if (runningTimeScale !== undefined) {
    const speed = Math.max(gallop * runningTimeScale, capped);
    return { pose: 'run', speed, ms: msFor(speed), timeScale: runningTimeScale, rampIn };
  }
  if (distance < WALK_BELOW) {
    const timeScale = 1.6;
    const speed = WALK_SPEED * timeScale;
    return { pose: 'walk', speed, ms: msFor(speed), timeScale, rampIn };
  }
  const top = Math.max(gallop * MAX_TIME_SCALE, MIN_TOP_SPEED);
  const speed = Math.max(
    capped,
    Math.min(top, Math.max(gallop * MIN_TIME_SCALE, (distance / LEG_SECONDS) * factor)),
  );
  return {
    pose: 'run',
    speed,
    ms: msFor(speed),
    timeScale: Math.min(MAX_DASH_TIME_SCALE, speed / gallop),
    rampIn,
  };
}
