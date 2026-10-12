import { mulberry32 } from '../../engine/rng';

/**
 * Where each climb position sits on the cliff, in scene units. Pure, so the
 * climber, the ledges, the camera and the tests all agree on the same
 * geometry without any of them owning it.
 *
 * Y is up. The wall faces +Z (towards the camera) and leans back as it rises
 * (`wallZ`), so looking up along it reads as "a long way to the top".
 */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Vertical distance between consecutive positions — a bit more than one
 * fox height, so a hop is visibly "a body length or more" (fun bar F2). */
export const LEDGE_DY = 1.15;
/** Horizontal swing of the zig-zag route. */
export const ROUTE_AMPLITUDE = 1.5;
/** How far the wall leans back per unit of height. */
export const WALL_LEAN = 0.1;

export function wallZ(y: number): number {
  return y === 0 ? 0 : -y * WALL_LEAN;
}

function jitter(index: number, peakId: number): number {
  const rng = mulberry32(peakId * 7919 + index * 104729 + 17);
  return (rng() - 0.5) * 0.5;
}

/** The point the climber stands on at `index` (0 = base, `height` = summit). */
export function ledgePoint(index: number, peakId: number): Vec3 {
  const y = index * LEDGE_DY;
  const x =
    index === 0 ? 0 : ROUTE_AMPLITUDE * Math.sin(index * 0.85 + peakId) + jitter(index, peakId);
  return { x, y, z: wallZ(y) };
}

export function ledgePoints(height: number, peakId: number): Vec3[] {
  return Array.from({ length: height + 1 }, (_, i) => ledgePoint(i, peakId));
}

export function summitY(height: number): number {
  return height * LEDGE_DY;
}

/**
 * Parabolic arc from `from` to `to`, `t` in 0..1, rising `apex` units above
 * the straight line at its midpoint. Used for hops (apex > 0) and for the
 * slide down after a miss (apex < 0 dips below the line, which reads as a
 * slip rather than a graceful step).
 */
export function arcPoint(from: Vec3, to: Vec3, t: number, apex: number): Vec3 {
  const clamped = Math.max(0, Math.min(1, t));
  const lift = 4 * apex * clamped * (1 - clamped);
  return {
    x: from.x + (to.x - from.x) * clamped,
    y: from.y + (to.y - from.y) * clamped + lift,
    z: from.z + (to.z - from.z) * clamped,
  };
}

/** Smoothstep ease so hops decelerate into the landing. */
export function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Accelerating ease for drops — gravity, not a glide. */
export function easeIn(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c;
}
