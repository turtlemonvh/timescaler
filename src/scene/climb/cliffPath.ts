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

/** Vertical distance between consecutive positions. The gap under the ledge
 * above (`LEDGE_DY - SLAB_THICKNESS`) has to fit the tallest animal mid-clip —
 * the stag's antlers reach 1.84 at the top of its own jump clip — so a
 * climber standing or landing on a ledge never has its head inside the slab
 * over it. Also keeps a hop visibly "a body length or more" (fun bar F2). */
export const LEDGE_DY = 2.2;
/** Ledge slab thickness; its top face is the standing surface. */
export const SLAB_THICKNESS = 0.24;
/** How far behind the standing point the slab's back edge sits (inside the route's groove). */
const SLAB_BACK = 0.45;
/** How far the summit plateau reaches out from the wall: no further than the deepest ledge slab. */
export const PLATEAU_FRONT = 0.6;
/** Horizontal swing of the zig-zag route. */
export const ROUTE_AMPLITUDE = 1.5;
/** How far the wall leans back per unit of height. */
export const WALL_LEAN = 0.1;
/** The forest floor sits below the first ledge, so the trees frame the climb from underneath
 * and a fall has somewhere to land. */
export const FOREST_FLOOR = -2.6;

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

/** The rock slab a ledge is made of, as an oriented box (yaw about Y). */
export interface LedgeSlab {
  center: Vec3;
  width: number;
  depth: number;
  thickness: number;
  yaw: number;
}

/** Axis-aligned bounds, for clearance checks. */
export interface Box3Like {
  min: Vec3;
  max: Vec3;
}

/**
 * The slab under the standing point at `index`. Shallow and set back into the
 * wall, so a climber hopping past it can clear its front edge by leaping out
 * from the wall a little, and it never sticks out over a climber standing
 * below. Shared by `CliffWorld` (which draws it) and the flight tests (which
 * check nothing flies through it).
 */
export function ledgeSlab(index: number, peakId: number): LedgeSlab {
  const point = ledgePoint(index, peakId);
  const rng = mulberry32(peakId * 977 + index * 13);
  rng(); // was the under-slab boulder's tilt; still drawn so each ledge keeps its old width
  const yaw = (rng() - 0.5) * 0.5 * 0.4;
  const width = 1.2 + rng() * 0.5;
  const depth = 0.8 + rng() * 0.2;
  return {
    center: { x: point.x, y: point.y - SLAB_THICKNESS / 2, z: point.z - SLAB_BACK + depth / 2 },
    width,
    depth,
    thickness: SLAB_THICKNESS,
    yaw,
  };
}

export function slabBounds(slab: LedgeSlab): Box3Like {
  const c = Math.cos(slab.yaw);
  const s = Math.abs(Math.sin(slab.yaw));
  const hx = (slab.width / 2) * c + (slab.depth / 2) * s;
  const hz = (slab.width / 2) * s + (slab.depth / 2) * c;
  const { x, y, z } = slab.center;
  return {
    min: { x: x - hx, y: y - slab.thickness / 2, z: z - hz },
    max: { x: x + hx, y: y + slab.thickness / 2, z: z + hz },
  };
}

/** The snowy summit plateau the last ledge sits on; its top is the summit's standing surface. */
export function summitPlateau(height: number, peakId: number): Box3Like {
  const p = ledgePoint(height, peakId);
  return {
    min: { x: p.x - 2.1, y: p.y - SLAB_THICKNESS, z: p.z - 0.6 },
    max: { x: p.x + 2.1, y: p.y, z: p.z + PLATEAU_FRONT },
  };
}

/** Where a tumble ends: on the forest floor, out in front of the fringe pines at the foot of the wall. */
export function fallLanding(peakId: number): Vec3 {
  const base = ledgePoint(0, peakId);
  return { x: base.x + 1.2, y: FOREST_FLOOR, z: base.z + 3.4 };
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

/** Decelerating ease for a leap that runs out of steam at its apex. */
export function easeOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

/** Accelerating ease for drops — gravity, not a glide. */
export function easeIn(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c;
}
