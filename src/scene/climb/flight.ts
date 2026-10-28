import { BODY_ENVELOPES } from '../animals/bodyEnvelope';
import type { Pose } from '../animals/clips';
import { ANIMALS, type AnimalId } from '../animals/roster';
import {
  easeIn,
  easeInOut,
  easeOut,
  fallLanding,
  ledgePoint,
  ledgeSlab,
  slabBounds,
  PLATEAU_FRONT,
  type Vec3,
} from './cliffPath';
import {
  EXTRA_STEP_MS,
  FALL_MS,
  HOP_MS,
  SLIP_DROP_MS,
  SLIP_LEAP_MS,
  SLIP_SCRABBLE_MS,
  SUMMIT_HOP_MS,
  type ClimbMove,
} from './motion';

/**
 * The climber's flight paths, as pure data: which segments a move plays and
 * where the animal is at any point of each. Pure so `flight.test.ts` can fly
 * every animal along every move and prove it never passes through a ledge.
 *
 * The ledges are stacked almost straight above each other (the wall leans
 * back only `WALL_LEAN` per unit), so any path that rose straight up the
 * wall would go through the next slab from underneath. Every path therefore
 * leaps *out* from the wall first (`bulge`, towards the camera), passes in
 * front of the slabs, and comes back in over the top of the one it lands on.
 */
export type PathShape = 'hop' | 'leap' | 'hang' | 'drop' | 'settle' | 'fall';

export interface FlightSegment {
  shape: PathShape;
  from: Vec3;
  to: Vec3;
  ms: number;
  /** Height of the arc above the straight line (hop, leap, fall). */
  apex: number;
  /** How far out from the wall the path swings, in front of the straight line. */
  bulge: number;
  squashOnLand: boolean;
  dustOnLand: boolean;
  pose: Pose;
  /** Freeze `pose` at this fraction of its clip instead of playing it. */
  hold?: number;
  /** Start `pose` at this fraction of its clip. */
  startAt?: number;
  /**
   * Stretch the clip (from `startAt` to its end) over this many ms instead of
   * `ms`; the segment then ends part-way through it. A slip's leap uses it
   * to arrive at the reach pose exactly as the hang freezes it.
   */
  clipMs?: number;
  /** Dust particle count when `dustOnLand`; the move kind's default when omitted. */
  dustCount?: number;
  /** Turn side-on towards +X (1) or -X (-1) for this segment; keep the current facing when omitted. */
  face?: 1 | -1;
}

/** How the climber's body is sized and posed, for paths that depend on it. */
export interface FlightBody {
  /** Roster height. */
  height: number;
  /** Half the body's thickness across its facing direction (it flies side-on). */
  halfWidth: number;
  /** `Gallop_Jump` fraction for the slip's frozen reach. */
  reach: number;
  /** `Jump_ToIdle` fraction where the feet touch down. */
  touchdown: number;
}

/** Leap-out distance for a hop, measured from the wall-side standing point. */
export const HOP_BULGE = 1.05;
/** Extra clearance kept between the body and a slab's front face. */
const FRONT_MARGIN = 0.08;
const HOP_APEX = 0.95;
/** Fraction of a hop by which it is fully out from the wall, before the head reaches the slab above. */
const HOP_OUT_RISE = 0.16;
/** A miss leaps harder and earlier (its rise is front-loaded), so it has to get out sooner. */
const LEAP_OUT_RISE = 0.12;
/** The step back from the front lip onto the landing ledge, inside `SLIP_DROP_MS`. */
export const SLIP_SETTLE_MS = 160;
/** How fast (1/s) the climber turns to face its direction of travel while in the air. */
export const AIR_TURN_RATE = 26;
const FAST_APEX = 1.2;

function smooth(t: number): number {
  return easeInOut(t);
}

/** 0 → 1 → 0 profile that is fully out by `rise` and back in from `1 - fall`. */
function outProfile(t: number, rise: number, fall: number): number {
  const up = smooth(Math.min(1, t / rise));
  const down = smooth(Math.min(1, (1 - t) / fall));
  return Math.min(up, down);
}

function side(dx: number): 1 | -1 {
  return dx >= 0 ? 1 : -1;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Where the animal is `raw` (0..1, linear time) through `segment`. */
export function flightPoint(segment: FlightSegment, raw: number): Vec3 {
  const t = Math.max(0, Math.min(1, raw));
  const { from, to, apex, bulge } = segment;
  switch (segment.shape) {
    case 'hop': {
      // Out from the wall first, up and across, back in over the landing slab.
      const s = smooth(t);
      return {
        x: lerp(from.x, to.x, s),
        y: lerp(from.y, to.y, s) + 4 * apex * s * (1 - s),
        z: lerp(from.z, to.z, s) + bulge * outProfile(t, HOP_OUT_RISE, 0.3),
      };
    }
    case 'leap': {
      // A miss: out and up, running out of steam short of the ledge.
      const s = easeOut(t);
      const out = smooth(Math.min(1, t / LEAP_OUT_RISE));
      return {
        x: lerp(from.x, to.x, s),
        y: lerp(from.y, to.y, s) + 4 * apex * s * (1 - s),
        z: lerp(from.z, to.z, out),
      };
    }
    case 'hang': {
      // Scrabbling at the lip: a small, fast shiver around the hang point.
      const shake = Math.sin(t * Math.PI * 6) * (1 - t);
      const s = smooth(t);
      return {
        x: lerp(from.x, to.x, s) + shake * 0.04,
        y: lerp(from.y, to.y, s) + Math.abs(shake) * 0.05,
        z: lerp(from.z, to.z, s),
      };
    }
    case 'drop': {
      // Gravity straight down, in front of the slabs, onto the front lip.
      const s = easeIn(t);
      return {
        x: lerp(from.x, to.x, smooth(t)),
        y: lerp(from.y, to.y, s),
        z: lerp(from.z, to.z, s),
      };
    }
    case 'settle': {
      const s = smooth(t);
      return { x: lerp(from.x, to.x, s), y: lerp(from.y, to.y, s), z: lerp(from.z, to.z, s) };
    }
    case 'fall': {
      // Pitch off and away from the wall fast, then drop.
      const out = easeOut(Math.min(1, t / 0.45));
      const s = easeIn(t);
      return {
        x: lerp(from.x, to.x, out),
        y: lerp(from.y, to.y, s) + 4 * apex * t * (1 - t),
        z: lerp(from.z, to.z, out),
      };
    }
  }
}

/**
 * Which fraction of its clip `segment.pose` shows `raw` (0..1, linear time)
 * through the segment, as `Climber` plays it: frozen at `hold`, else running
 * from `startAt` to the clip's end over `clipMs` (default: the segment).
 */
export function clipPhase(segment: FlightSegment, raw: number): number {
  if (segment.hold !== undefined) return segment.hold;
  const start = segment.startAt ?? 0;
  const t = Math.max(0, Math.min(1, raw)) * (segment.ms / (segment.clipMs ?? segment.ms));
  return Math.min(1, start + (1 - start) * t);
}

/** The z a body side-on to the wall must be at to pass in front of the slab at `index`. */
function clearOf(index: number, peakId: number, body: FlightBody): number {
  // The move does not know the climb's height, so allow for the summit
  // plateau at any index; it reaches out no further than the deepest slab.
  const front = Math.max(
    slabBounds(ledgeSlab(index, peakId)).max.z,
    ledgePoint(index, peakId).z + PLATEAU_FRONT,
  );
  return front + body.halfWidth + FRONT_MARGIN;
}

/** Where a climber leaping out from `index` passes, given the slabs it must clear. */
function hopBulge(from: Vec3, to: Vec3, clear: number): number {
  // The path is fully out (`outProfile` = 1) while it is between the two
  // ledges' heights; at that point the straight line is somewhere between
  // `from.z` and `to.z`, so clear the deeper of the two.
  return Math.max(HOP_BULGE, clear - Math.min(from.z, to.z));
}

export function buildFlight(move: ClimbMove, peakId: number, body: FlightBody): FlightSegment[] {
  const from = ledgePoint(move.from, peakId);
  const segments: FlightSegment[] = [];
  if (move.kind === 'hop' || move.kind === 'summit') {
    // One facing for the whole move: a boosted double hop whose steps zig-zag
    // would otherwise spin round mid-air, swinging nose or tail into the rock.
    const face = side(ledgePoint(move.to, peakId).x - from.x);
    for (let step = 1; step <= move.steps; step++) {
      const a = ledgePoint(move.from + step - 1, peakId);
      const b = ledgePoint(move.from + step, peakId);
      const clear = clearOf(move.from + step, peakId, body);
      segments.push({
        shape: 'hop',
        from: a,
        to: b,
        apex: move.fast ? FAST_APEX : HOP_APEX,
        bulge: hopBulge(a, b, clear),
        ms: step === 1 ? (move.kind === 'summit' ? SUMMIT_HOP_MS : HOP_MS) : EXTRA_STEP_MS,
        squashOnLand: true,
        dustOnLand: step === move.steps,
        pose: 'jump',
        face,
      });
    }
  } else if (move.kind === 'slip') {
    // Leap for the next ledge, come up short in front of its lip, scrabble,
    // drop in front of the slabs onto the front of the landing ledge, step back.
    const target = ledgePoint(move.from + 1, peakId);
    const landing = move.steps === 0 ? from : ledgePoint(move.to, peakId);
    // Out in front of every slab the miss passes: the one it reached for, the
    // one it left and the one it lands on.
    const outZ = Math.max(
      clearOf(move.from + 1, peakId, body),
      clearOf(move.from, peakId, body),
      clearOf(move.to, peakId, body),
    );
    const hangPoint: Vec3 = {
      x: from.x + (target.x - from.x) * 0.6,
      // Forepaws at the lip of the slab it missed.
      y: target.y - body.height * 0.75,
      z: outZ,
    };
    const slipped: Vec3 = { x: hangPoint.x, y: hangPoint.y - 0.22, z: hangPoint.z };
    const lip: Vec3 = {
      x: landing.x,
      y: landing.y,
      z: outZ,
    };
    // One continuous jump clip across leap, hang and drop: the leap plays it
    // up to the reach, the hang freezes it there, and the drop carries on from
    // the same frame — no pose pops where the segments meet.
    const reachPose = { pose: 'jump' as const, hold: body.reach };
    const face = side(target.x - from.x);
    segments.push(
      {
        shape: 'leap',
        from,
        to: hangPoint,
        apex: 0.2,
        bulge: hangPoint.z - from.z,
        ms: SLIP_LEAP_MS,
        clipMs: SLIP_LEAP_MS / body.reach,
        squashOnLand: false,
        dustOnLand: true,
        dustCount: 5,
        pose: 'jump',
        face,
      },
      {
        shape: 'hang',
        from: hangPoint,
        to: slipped,
        apex: 0,
        bulge: 0,
        ms: SLIP_SCRABBLE_MS,
        squashOnLand: false,
        dustOnLand: false,
        ...reachPose,
      },
      {
        shape: 'drop',
        from: slipped,
        to: lip,
        apex: 0,
        bulge: 0,
        ms: SLIP_DROP_MS - SLIP_SETTLE_MS,
        squashOnLand: true,
        dustOnLand: true,
        pose: 'jump',
        startAt: body.reach,
      },
      {
        shape: 'settle',
        from: lip,
        to: landing,
        apex: 0,
        bulge: 0,
        ms: SLIP_SETTLE_MS,
        squashOnLand: false,
        dustOnLand: false,
        pose: 'land',
        startAt: body.touchdown,
      },
    );
  } else if (move.kind === 'fall') {
    segments.push({
      shape: 'fall',
      from,
      to: fallLanding(peakId),
      apex: 0.5,
      bulge: 0,
      ms: FALL_MS,
      squashOnLand: false,
      dustOnLand: true,
      pose: 'fall',
      face: side(fallLanding(peakId).x - from.x),
    });
  }
  return segments;
}

/** Body measurements `buildFlight` needs, from the roster and the measured envelopes. */
export function flightBody(id: AnimalId): FlightBody {
  const env = BODY_ENVELOPES[id];
  return {
    height: ANIMALS.find((animal) => animal.id === id)?.height ?? 1,
    halfWidth: Math.max(Math.abs(env.x[0]), Math.abs(env.x[1])),
    reach: env.reach,
    touchdown: env.touchdown,
  };
}

/**
 * The tumble's roll (about the wall-parallel axis) and wobble, `raw` 0..1
 * through the fall. The roll eases in, so the animal is already out from the
 * wall before it rolls far enough to sweep its back through its own ledge.
 */
export function tumbleAngles(raw: number): { x: number; z: number } {
  const t = Math.max(0, Math.min(1, raw));
  return { x: -easeIn(t) * Math.PI * 2.2, z: Math.sin(t * 9) * 0.5 * Math.min(1, t * 2.5) };
}
