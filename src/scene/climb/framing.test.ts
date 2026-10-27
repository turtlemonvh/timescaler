import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { ANIMALS } from '../animals/roster';
import { ledgePoint } from './cliffPath';
import { buildFlight, flightBody, flightPoint } from './flight';
import {
  CLIMB_SLOT,
  MAX_HOP_DX,
  cardDocksRight,
  climbFollow,
  framingFor,
  heroHalfWidth,
  keepInFrame,
  slotDistance,
} from './framing';

describe('framingFor', () => {
  it('docks the card right exactly where index.css does', () => {
    expect(cardDocksRight(720, 720)).toBe(true);
    expect(cardDocksRight(719, 500)).toBe(false);
    expect(cardDocksRight(900, 901)).toBe(false);
    expect(cardDocksRight(1280, 720)).toBe(true);
  });

  it('keeps the climber left of the docked climb card', () => {
    for (const [w, h] of [
      [720, 720],
      [1024, 768],
      [1280, 720],
      [1920, 1080],
    ]) {
      const { homeX, safe } = framingFor(w, h, 'climb');
      const cardLeftPx = w - 16 - Math.min(0.44 * w, 560);
      const cardLeftNdc = (2 * cardLeftPx) / w - 1;
      expect(safe.maxX).toBeLessThan(cardLeftNdc);
      expect(safe.minX).toBeGreaterThan(-1);
      expect(homeX).toBeGreaterThan(safe.minX);
      expect(homeX).toBeLessThan(safe.maxX);
    }
  });

  it('keeps the climber above a bottom card and below the HUD on a phone', () => {
    const { homeY, safe } = framingFor(390, 844, 'climb');
    expect(safe.minY).toBeGreaterThanOrEqual(-0.1);
    expect(safe.maxY).toBeLessThan(1 - (2 * 64) / 844);
    expect(homeY).toBeGreaterThan(safe.minY);
    expect(homeY).toBeLessThan(safe.maxY);
  });
});

describe('keepInFrame', () => {
  const safe = { minX: -0.9, maxX: 0, minY: -0.9, maxY: 0.8 };
  it('leaves a box that already fits alone', () => {
    expect(keepInFrame({ minX: -0.5, maxX: -0.2, minY: 0, maxY: 0.5 }, safe)).toEqual({
      dx: 0,
      dy: 0,
    });
  });
  it('pans just enough to bring an escaping box back', () => {
    const { dx, dy } = keepInFrame({ minX: -0.2, maxX: 0.3, minY: 0.5, maxY: 1.2 }, safe);
    expect(dx).toBeCloseTo(0.3);
    expect(dy).toBeCloseTo(0.4);
    const left = keepInFrame({ minX: -1.4, maxX: -1.0, minY: -1.3, maxY: -1.0 }, safe);
    expect(left.dx).toBeCloseTo(-0.5);
    expect(left.dy).toBeCloseTo(-0.4);
  });
  it('prefers the head when the box is taller than the safe area', () => {
    const { dy } = keepInFrame({ minX: -0.5, maxX: -0.2, minY: -1.5, maxY: 1.5 }, safe);
    expect(1.5 - dy).toBeCloseTo(safe.maxY);
  });
});

const TAN_HALF = Math.tan((21 * Math.PI) / 180);

describe('slotDistance', () => {
  it('pulls back on a narrow docked layout only', () => {
    const square = framingFor(720, 720, 'climb');
    const wide = framingFor(1280, 720, 'climb');
    expect(slotDistance(7.2, wide.safe, 1280 / 720, TAN_HALF, 3.6)).toBe(7.2);
    const d = slotDistance(7.2, square.safe, 1, TAN_HALF, 3.6);
    expect(d).toBeGreaterThan(7.2);
    expect((square.safe.maxX - square.safe.minX) * d * TAN_HALF).toBeCloseTo(3.6);
  });
});

describe('climbFollow', () => {
  it('leaves roomy layouts exactly as they were', () => {
    for (const [w, h] of [
      [1280, 720],
      [1920, 1080],
    ]) {
      const { safe } = framingFor(w, h, 'climb');
      for (const animal of ANIMALS) {
        expect(climbFollow(7.2, safe, w / h, TAN_HALF, animal.height)).toEqual({
          distance: 7.2,
          lead: 0.55,
          track: 0.9,
        });
      }
    }
  });

  it('brings the camera in a quarter or more at 720x720 with the card on the right', () => {
    // The old fixed 3.6-unit slot put the camera ~10 units back.
    const { safe } = framingFor(720, 720, 'climb');
    const old = slotDistance(7.2, safe, 1, TAN_HALF, 3.6);
    for (const animal of ANIMALS) {
      const { distance } = climbFollow(7.2, safe, 1, TAN_HALF, animal.height);
      expect(old / distance).toBeGreaterThan(1.24);
      // Open width at the climber's depth is the slot: the guard's box fits it.
      const room = (safe.maxX - safe.minX) * distance * TAN_HALF;
      expect(room).toBeCloseTo(CLIMB_SLOT);
      expect(2 * heroHalfWidth(animal.height)).toBeLessThan(room);
    }
  });

  it('keeps every hop inside the open area at 1:1 without the guard having to pan', () => {
    // Re-derived from the camera's own rule: the framed point is
    // track * lerp(climber, landing, lead), put on `homeX`. Project the guard's
    // box (half-width, at the climber's depth) through a camera that sits on
    // that point at `distance` and check it stays inside the safe area.
    const failures: string[] = [];
    for (const [w, h] of [
      [720, 720],
      [800, 760],
      [1024, 1000],
    ]) {
      const { safe, homeX } = framingFor(w, h, 'climb');
      const aspect = w / h;
      for (const animal of ANIMALS) {
        const follow = climbFollow(7.2, safe, aspect, TAN_HALF, animal.height);
        // The lead alone never spends more than the room the body leaves.
        expect(follow.lead * MAX_HOP_DX + heroHalfWidth(animal.height)).toBeLessThanOrEqual(
          ((safe.maxX - safe.minX) / 2) * follow.distance * TAN_HALF * aspect + 1e-9,
        );
        const half = heroHalfWidth(animal.height);
        for (const peak of PEAKS) {
          for (let i = 0; i < peak.height - 1; i++) {
            const [segment] = buildFlight(
              { id: 1, kind: 'hop', from: i, to: i + 1, steps: 1, fast: false },
              peak.id,
              flightBody(animal.id),
            );
            const goal = ledgePoint(i + 1, peak.id);
            for (let raw = 0; raw <= 1; raw += 0.05) {
              const p = flightPoint(segment, raw);
              const anchorX = follow.track * (p.x + (goal.x - p.x) * follow.lead);
              const anchorZ = p.z + (goal.z - p.z) * follow.lead;
              const depth = follow.distance - (p.z - anchorZ);
              const unit = depth * TAN_HALF * aspect;
              const minX = homeX + (p.x - half - anchorX) / unit;
              const maxX = homeX + (p.x + half - anchorX) / unit;
              if (minX < safe.minX - 0.02 || maxX > safe.maxX + 0.02) {
                failures.push(
                  `${w}x${h} ${animal.id} peak ${peak.id} hop ${i} t=${raw.toFixed(2)}`,
                );
              }
            }
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
