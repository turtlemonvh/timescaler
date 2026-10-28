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
/** How far behind the standing point the slab's back edge sits: buried in the route's groove. */
const SLAB_BACK = 0.7;
/** The route's groove: how far the wall is cut back around the ledges, so the rope can run behind the climber. */
export const ROUTE_GROOVE = 0.6;
/** Where the rope runs, relative to the standing point: behind the climber's body, in front of the groove. */
export const ROPE_Z = -0.5;
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
  const depth = SLAB_BACK + 0.35 + rng() * 0.2;
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

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function wallNoise(x: number, y: number, seed: number): number {
  return (
    Math.sin(x * 1.3 + y * 0.7 + seed) * 0.45 +
    Math.sin(x * 0.45 - y * 1.15 + seed * 0.3) * 0.35 +
    Math.sin(x * 2.7 + y * 2.1) * 0.2
  );
}

/** Largest per-vertex jitter `CliffWorld` adds on top of `wallSurface` (half of its ±0.35 colour/shape noise). */
export const WALL_JITTER = 0.5 * 0.175;

/**
 * The cliff face's z at (x, y): the lean, rock noise (calmer near the route),
 * the route's groove and the sides receding. `jitter` is the per-vertex
 * random term the mesh adds; anything placed on the wall without knowing it
 * (wall pines) is off by at most `WALL_JITTER`. `n` is the noise value, which
 * also drives the rock colour.
 */
export function wallSurface(
  x: number,
  y: number,
  peakId: number,
  route: readonly Vec3[],
  jitter = 0,
): { z: number; n: number } {
  let nearest = Infinity;
  for (const point of route) {
    const d = Math.hypot(point.x - x, point.y - y);
    if (d < nearest) nearest = d;
  }
  const routeDamp = clamp01((nearest - 0.7) / 1.2);
  const n = wallNoise(x, y, peakId) + jitter;
  const edgeRecede = Math.abs(x) > 3.3 ? (Math.abs(x) - 3.3) * 0.75 : 0;
  // A groove follows the route: calmer rock near the ledges, and room for
  // the rope to run behind the climber instead of through its body.
  const groove = ROUTE_GROOVE * (1 - routeDamp);
  const z = wallZ(y) + n * 0.5 * (0.1 + 0.9 * routeDamp) - edgeRecede - groove;
  return { z, n };
}

/** Bottom of the cliff mesh, under the forest floor. */
export const WALL_BOTTOM = -5;
/** How far the cliff's peak rises above the summit plateau, just behind it. */
export const PEAK_RISE = 3.2;
/** Mean half-width of the face below the peak; buttresses push it in and out around this. */
const WALL_HALF = 5.25;
/**
 * Nearest z of the backdrop behind the cliff: the clouds' range starts
 * here and the distant ranges' bases reach about this far forward. The
 * cliff stays well in front of it, so no cloud pokes through the rock.
 */
export const BACKDROP_Z = -14;

/**
 * How far out to the side the peak's ridges are, `drop` units below it:
 * the inverse of a drop of `0.7 d + 0.06 d²`, ever steeper further out.
 */
function ridgeReach(drop: number): number {
  return (-0.7 + Math.sqrt(0.7 * 0.7 + 4 * 0.06 * drop)) / (2 * 0.06);
}

/** One side's buttressed edge at height `y`: a rocky outline, never a ruler-straight one. */
function buttressEdge(y: number, peakId: number, side: 1 | -1): number {
  return (
    WALL_HALF +
    Math.sin(y * 0.37 + peakId * 1.3 + side) * 0.35 +
    Math.sin(y * 0.83 + peakId * 0.7 + 2 * side) * 0.2
  );
}

/**
 * The cliff's outline at height `y`: the x range the face spans there.
 * At the top it is a peak just behind the summit plateau, with ridges falling
 * away ever steeper on both sides, so the summit swing sees sky past sloping
 * shoulders instead of the knife edge of a flat-topped slab. Lower down the
 * face keeps about its old width (the climb's vista past its sides stays),
 * between buttressed edges that wander in and out.
 */
export function wallOutline(
  y: number,
  height: number,
  peakId: number,
): { minX: number; maxX: number } {
  const peak = ledgePoint(height, peakId);
  const drop = peak.y + PEAK_RISE - y;
  if (drop <= 0) return { minX: peak.x, maxX: peak.x };
  const reach = ridgeReach(drop) * (1 + 0.12 * Math.sin(y * 1.1 + peakId));
  return {
    minX: Math.max(peak.x - reach, -buttressEdge(y, peakId, -1)),
    maxX: Math.min(peak.x + reach, buttressEdge(y, peakId, 1)),
  };
}

/** The top of the cliff: the peak, `PEAK_RISE` above the summit. */
export function wallPeakY(height: number): number {
  return summitY(height) + PEAK_RISE;
}

/** Rope tube radius. */
export const ROPE_RADIUS = 0.045;

/**
 * The rope between ledge `index` and the next, as points along a sagging
 * curve at `ROPE_Z`, pushed out wherever the rock bulges in front of it.
 * The route's groove is cut around the ledges, not along the whole route,
 * so halfway between two ledges the (less grooved, noisier) face can stand
 * proud of `ROPE_Z` and would swallow the middle of a straight rope —
 * which read as a broken rope with a gap. Pure, so the clearance is tested.
 */
export function ropePoints(
  index: number,
  peakId: number,
  route: readonly Vec3[],
  samples = 14,
): Vec3[] {
  const a = route[index];
  const b = route[index + 1];
  const dir = Math.sign(b.x - a.x) || 1;
  const reach = Math.abs(b.x - a.x) < 1.2 ? 0.3 : 0.6;
  const start = { x: a.x + dir * reach, y: a.y + 0.02, z: a.z + ROPE_Z };
  const end = { x: b.x - dir * reach, y: b.y - 0.08, z: b.z + ROPE_Z };
  const clearance = WALL_JITTER + ROPE_RADIUS + 0.03;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    // Quadratic sag: the control point hangs 0.3 below the chord's midpoint.
    const sag = 2 * t * (1 - t) * -0.3;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t + sag;
    const ideal = start.z + (end.z - start.z) * t;
    const surface = wallSurface(x, y, peakId, route).z;
    return { x, y, z: Math.max(ideal, surface + clearance) };
  });
}
