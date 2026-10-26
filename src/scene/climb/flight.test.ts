import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { BODY_ENVELOPES, envelopeAt, type BodyEnvelope } from '../animals/bodyEnvelope';
import { ANIMALS, type AnimalId } from '../animals/roster';
import {
  FOREST_FLOOR,
  ledgePoint,
  ledgeSlab,
  slabBounds,
  summitPlateau,
  type Box3Like,
  type Vec3,
} from './cliffPath';
import {
  AIR_TURN_RATE,
  buildFlight,
  flightPoint,
  flightBody,
  tumbleAngles,
  type FlightSegment,
} from './flight';
import type { ClimbMove } from './motion';

/**
 * The rendering analogue of "re-derive the answer": fly every animal along
 * every kind of move on every peak, pose its measured mesh bounds the way
 * `Climber` does (facing, clip phase, tumble), and check the box never
 * overlaps a ledge slab or the summit plateau. A failure here is an animal's
 * body visibly inside rock — the "legs disappearing" bug.
 */

const REST_FACING = (Math.PI / 2) * 0.45;
/** Overlap allowed before it counts: hooves resting on a slab's top face dip into it a hair. */
const TOLERANCE = 0.06;
const STEP = 0.01;

interface Hit {
  what: string;
  t: number;
  depth: number;
}

function overlap(a: Box3Like, b: Box3Like): number {
  const ox = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
  const oy = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
  const oz = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
  return Math.min(ox, oy, oz);
}

/** World bounds of the body's box: model box → tumble (Euler XYZ) → facing about Y → position. */
function bodyBox(
  env: BodyEnvelope,
  y: readonly [number, number],
  position: Vec3,
  facing: number,
  tumble: { x: number; z: number } = { x: 0, z: 0 },
  x: readonly [number, number] = env.x,
): Box3Like {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const [cx, sx] = [Math.cos(tumble.x), Math.sin(tumble.x)];
  const [cz, sz] = [Math.cos(tumble.z), Math.sin(tumble.z)];
  const [cy, sy] = [Math.cos(facing), Math.sin(facing)];
  for (const px of x)
    for (const py of y)
      for (const pz of env.z) {
        // Rz, then Rx (three's 'XYZ' order applies Z first to a vector).
        const x1 = px * cz - py * sz;
        const y1 = px * sz + py * cz;
        const y2 = y1 * cx - pz * sx;
        const z2 = y1 * sx + pz * cx;
        // Ry
        const wx = x1 * cy + z2 * sy;
        const wz = -x1 * sy + z2 * cy;
        const w = { x: wx + position.x, y: y2 + position.y, z: wz + position.z };
        min.x = Math.min(min.x, w.x);
        min.y = Math.min(min.y, w.y);
        min.z = Math.min(min.z, w.z);
        max.x = Math.max(max.x, w.x);
        max.y = Math.max(max.y, w.y);
        max.z = Math.max(max.z, w.z);
      }
  return { min, max };
}

function obstacles(peakId: number, height: number, near: number[]): [string, Box3Like][] {
  const lo = Math.max(0, Math.min(...near) - 2);
  const hi = Math.min(height, Math.max(...near) + 2);
  const out: [string, Box3Like][] = [];
  for (let i = lo; i <= hi; i++) {
    // The summit has no slab of its own: it stands on the plateau.
    if (i === height) continue;
    out.push([`slab ${i}`, slabBounds(ledgeSlab(i, peakId))]);
  }
  if (hi === height) out.push(['plateau', summitPlateau(height, peakId)]);
  return out;
}

/** The Death clip keels over sideways (model +X) once it gets going. */
function deathX(env: BodyEnvelope, raw: number): readonly [number, number] {
  return raw < 0.3 ? env.x : [-0.45, Math.max(1.4, env.x[1])];
}

function poseY(env: BodyEnvelope, segment: FlightSegment, raw: number): [number, number] {
  if (segment.pose === 'jump') {
    const phase = segment.hold ?? raw;
    return envelopeAt(env.jump, phase - 0.06, phase + 0.06);
  }
  if (segment.pose === 'land') return envelopeAt(env.land, segment.startAt ?? 0, 1);
  // Death clip: still upright at first, then crumples and rolls on its side.
  return [raw < 0.3 ? -0.05 : -0.45, env.idleTop + 0.15];
}

/** Flies `move` for `animal` and returns every overlap with rock, plus the rest pose at the end. */
function fly(
  animal: AnimalId,
  peakId: number,
  height: number,
  move: ClimbMove,
  startFacing: number,
): Hit[] {
  const env = BODY_ENVELOPES[animal];
  const body = flightBody(animal);
  const segments = buildFlight(move, peakId, body);
  const near = [move.from, move.to, move.from + 1];
  const rocks = obstacles(peakId, height, near);
  const hits: Hit[] = [];
  let facing = startFacing;
  let prevY: [number, number] = [0, env.idleTop];
  segments.forEach((segment, index) => {
    const start = facing;
    const target = segment.face === undefined ? start : segment.face * (Math.PI / 2);
    for (let raw = 0; raw <= 1 + 1e-9; raw += STEP) {
      const ms = raw * segment.ms;
      facing = target + (start - target) * Math.exp((-AIR_TURN_RATE * ms) / 1000);
      const p = flightPoint(segment, raw);
      let y = poseY(env, segment, raw);
      // Crossfading in from the previous pose.
      if (ms < 150) y = [Math.min(y[0], prevY[0]), Math.max(y[1], prevY[1])];
      const tumble = segment.shape === 'fall' ? tumbleAngles(raw) : undefined;
      const xs = segment.shape === 'fall' ? deathX(env, raw) : env.x;
      const box = bodyBox(env, y, p, facing, tumble, xs);
      for (const [what, rock] of rocks) {
        const depth = overlap(box, rock);
        if (depth > TOLERANCE) hits.push({ what: `${what} (segment ${index})`, t: raw, depth });
      }
    }
    prevY = poseY(env, segment, 1);
  });
  // Standing at the end: the land clip from touchdown, then idle.
  const last = segments[segments.length - 1];
  if (last && move.kind !== 'fall') {
    const rest = last.to;
    const y: [number, number] = [
      0,
      Math.max(env.idleTop, envelopeAt(env.land, body.touchdown, 1)[1]),
    ];
    for (const side of [-1, 1]) {
      const box = bodyBox(env, y, rest, side * REST_FACING);
      for (const [what, rock] of rocks) {
        const depth = overlap(box, rock);
        if (depth > TOLERANCE) hits.push({ what: `${what} (at rest)`, t: 1, depth });
      }
    }
  }
  return hits;
}

function report(label: string, hits: Hit[]): string[] {
  if (hits.length === 0) return [];
  const worst = hits.reduce((a, b) => (b.depth > a.depth ? b : a));
  return [
    `${label}: ${hits.length} samples, worst ${worst.what} t=${worst.t.toFixed(2)} by ${worst.depth.toFixed(2)}`,
  ];
}

function move(
  kind: ClimbMove['kind'],
  from: number,
  to: number,
  steps: number,
  fast = false,
): ClimbMove {
  return { id: 1, kind, from, to, steps, fast };
}

const HEIGHTS = [...new Set(PEAKS.flatMap((peak) => [peak.height, Math.round(peak.height / 2)]))];

describe('flight clearance', () => {
  for (const animal of ANIMALS) {
    it(`${animal.id}: hops, boosted double hops and fast hops never pass through a ledge`, () => {
      const failures: string[] = [];
      for (const peak of PEAKS) {
        for (let i = 0; i < peak.height - 1; i++) {
          for (const facing of [-REST_FACING, REST_FACING]) {
            const label = `peak ${peak.id} ${i}→`;
            failures.push(
              ...report(
                `${label}${i + 1}`,
                fly(animal.id, peak.id, peak.height, move('hop', i, i + 1, 1), facing),
              ),
            );
            failures.push(
              ...report(
                `${label}${i + 1} fast`,
                fly(animal.id, peak.id, peak.height, move('hop', i, i + 1, 1, true), facing),
              ),
            );
            if (i + 2 < peak.height) {
              failures.push(
                ...report(
                  `${label}${i + 2} boosted`,
                  fly(animal.id, peak.id, peak.height, move('hop', i, i + 2, 2, true), facing),
                ),
              );
            }
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${animal.id}: slips and summit hops never pass through a ledge or the plateau`, () => {
      const failures: string[] = [];
      for (const peak of PEAKS) {
        for (const facing of [-REST_FACING, REST_FACING]) {
          failures.push(
            ...report(
              `peak ${peak.id} slip at base`,
              fly(animal.id, peak.id, peak.height, move('slip', 0, 0, 0), facing),
            ),
          );
          for (let i = 1; i < peak.height; i++) {
            failures.push(
              ...report(
                `peak ${peak.id} slip ${i}→${i - 1}`,
                fly(animal.id, peak.id, peak.height, move('slip', i, i - 1, 1), facing),
              ),
            );
          }
        }
        for (const height of HEIGHTS) {
          for (const steps of [1, 2]) {
            if (height - steps < 0) continue;
            failures.push(
              ...report(
                `peak ${peak.id} summit ${height} (${steps})`,
                fly(
                  animal.id,
                  peak.id,
                  height,
                  move('summit', height - steps, height, steps, steps > 1),
                  REST_FACING,
                ),
              ),
            );
          }
        }
      }
      expect(failures).toEqual([]);
    });

    it(`${animal.id}: a fall tumbles clear of every ledge on the way down`, () => {
      const failures: string[] = [];
      for (const peak of PEAKS) {
        for (let i = 1; i < peak.height; i++) {
          // A fall passes every ledge below it, so check them all.
          const hits: Hit[] = [];
          const env = BODY_ENVELOPES[animal.id];
          const [segment] = buildFlight(move('fall', i, 0, 0), peak.id, flightBody(animal.id));
          for (let raw = 0; raw <= 1; raw += STEP) {
            const p = flightPoint(segment, raw);
            const box = bodyBox(
              env,
              [raw < 0.3 ? -0.05 : -0.45, env.idleTop + 0.15],
              p,
              (segment.face ?? 1) * (Math.PI / 2),
              tumbleAngles(raw),
              deathX(env, raw),
            );
            for (let k = 0; k <= i; k++) {
              const depth = overlap(box, slabBounds(ledgeSlab(k, peak.id)));
              if (depth > TOLERANCE) hits.push({ what: `slab ${k}`, t: raw, depth });
            }
          }
          failures.push(...report(`peak ${peak.id} fall from ${i}`, hits));
        }
      }
      expect(failures).toEqual([]);
    });
  }

  it('re-derives a hop independently: the midpoint is out in front of the landing slab', () => {
    // Independent of buildFlight's maths: a side-on fox at the hop's midpoint
    // must be further from the wall than the landing slab's front face.
    const segment = buildFlight(move('hop', 3, 4, 1), 1, flightBody('fox'))[0];
    const mid = flightPoint(segment, 0.5);
    const slab = ledgeSlab(4, 1);
    const front = slab.center.z + slab.depth / 2;
    expect(mid.z - BODY_ENVELOPES.fox.x[1]).toBeGreaterThan(front);
    expect(flightPoint(segment, 0)).toEqual(ledgePoint(3, 1));
    expect(flightPoint(segment, 1)).toEqual(ledgePoint(4, 1));
  });

  it('lands a fall on the forest floor', () => {
    const [segment] = buildFlight(move('fall', 5, 0, 0), 2, flightBody('stag'));
    expect(flightPoint(segment, 1).y).toBeCloseTo(FOREST_FLOOR);
  });
});
