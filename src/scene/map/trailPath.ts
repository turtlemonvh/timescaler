import { PEAK_SPOTS, STAND_GAP, standPoint, type PeakSpot, type Vec2 } from './peakLayout';

/**
 * The overworld trail: one polyline from peak 1's stand point to peak 10's,
 * through every stand point in order, bending round the foot of any mountain
 * in the way. Pure, so the stepping stones, the walking animal and the tests
 * all share the same path (the old trail was straight chords, which cut
 * through cones 4 and 8 — stones and animal alike vanished into the rock).
 *
 * Distances along the trail are arc lengths in scene units; `stops[i]` is the
 * arc length of peak `i + 1`'s stand point.
 */
export interface TrailPath {
  points: Vec2[];
  /** Arc length at each of `points`. */
  distances: number[];
  /** Arc length of each peak's stand point, indexed by `peakId - 1`. */
  stops: number[];
  length: number;
}

/** How far from a cone's foot the trail keeps — the same as a stand point. */
export const TRAIL_GAP = STAND_GAP;
/** Spacing of the trail's sample points. */
const STEP = 0.2;

function pushOut(point: Vec2, spots: readonly PeakSpot[]): Vec2 {
  let { x, z } = point;
  for (const spot of spots) {
    const dx = x - spot.x;
    const dz = z - spot.z;
    const distance = Math.hypot(dx, dz);
    const clearance = spot.radius + TRAIL_GAP;
    if (distance < clearance && distance > 1e-9) {
      x = spot.x + (dx / distance) * clearance;
      z = spot.z + (dz / distance) * clearance;
    }
  }
  return { x, z };
}

function resample(points: Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [points[0]];
  const total = points.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z)),
    0,
  );
  const n = Math.max(1, Math.round(total / step));
  let index = 0;
  let travelled = 0;
  for (let k = 1; k < n; k++) {
    const wanted = (total * k) / n;
    for (;;) {
      const a = points[index];
      const b = points[index + 1];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (travelled + length >= wanted || index + 2 >= points.length) {
        const t = length > 0 ? (wanted - travelled) / length : 0;
        out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        break;
      }
      travelled += length;
      index += 1;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * One leg between two stand points: the straight chord, relaxed like an
 * elastic band — smoothed towards straight, then pushed back out of every
 * cone's clearance circle — until it is the short way round the mountains
 * in the way, hugging their feet.
 */
function trailLeg(from: Vec2, to: Vec2, spots: readonly PeakSpot[]): Vec2[] {
  const n = Math.max(2, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / STEP));
  let points = Array.from({ length: n + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / n,
    z: from.z + ((to.z - from.z) * i) / n,
  }));
  for (let iteration = 0; iteration < 200; iteration++) {
    const next = points.map((point, i) => {
      if (i === 0 || i === points.length - 1) return point;
      const mid = {
        x: (points[i - 1].x + points[i + 1].x) / 2,
        z: (points[i - 1].z + points[i + 1].z) / 2,
      };
      return pushOut({ x: (point.x + mid.x) / 2, z: (point.z + mid.z) / 2 }, spots);
    });
    // Pushing bunches points up against a cone; re-spacing them keeps the band even.
    points = iteration % 20 === 19 ? resample(next, STEP) : next;
  }
  return resample(points, STEP).map((point, i, all) =>
    i === 0 || i === all.length - 1 ? point : pushOut(point, spots),
  );
}

export function buildTrail(spots: readonly PeakSpot[]): TrailPath {
  const stands = spots.map(standPoint);
  const points: Vec2[] = [stands[0]];
  const stops = [0];
  for (let i = 1; i < stands.length; i++) {
    const leg = trailLeg(stands[i - 1], stands[i], spots);
    points.push(...leg.slice(1));
    stops.push(points.length - 1);
  }
  const distances = points.map(() => 0);
  for (let i = 1; i < points.length; i++) {
    distances[i] =
      distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  return {
    points,
    distances,
    stops: stops.map((index) => distances[index]),
    length: distances[distances.length - 1],
  };
}

export const TRAIL: TrailPath = buildTrail(PEAK_SPOTS);

/** Arc length of a peak's stand point along the trail. */
export function trailStop(peakId: number, trail: TrailPath = TRAIL): number {
  const stop = trail.stops[peakId - 1];
  if (stop === undefined) throw new Error(`trailStop: no stop for peak id ${peakId}`);
  return stop;
}

function segmentAt(trail: TrailPath, s: number): number {
  // Binary search for the last sample at or before `s`.
  let lo = 0;
  let hi = trail.points.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (trail.distances[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The point `s` units along the trail (clamped to its ends). */
export function trailPointAt(s: number, trail: TrailPath = TRAIL): Vec2 {
  const clamped = Math.max(0, Math.min(trail.length, s));
  const i = segmentAt(trail, clamped);
  const a = trail.points[i];
  const b = trail.points[i + 1];
  const span = trail.distances[i + 1] - trail.distances[i];
  const t = span > 0 ? (clamped - trail.distances[i]) / span : 0;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}

/**
 * Which way the trail runs at `s`, as a Y rotation (`atan2(dx, dz)`, so 0
 * faces +Z), averaged over a short window so the animal doesn't twitch at
 * every sample point.
 */
export function trailHeadingAt(s: number, trail: TrailPath = TRAIL): number {
  const a = trailPointAt(s - 0.35, trail);
  const b = trailPointAt(s + 0.35, trail);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Points every `spacing` units along the whole trail, for stepping stones. */
export function trailSamples(spacing: number, trail: TrailPath = TRAIL): Vec2[] {
  const n = Math.floor(trail.length / spacing);
  return Array.from({ length: n + 1 }, (_, k) => trailPointAt(k * spacing, trail));
}
