import { describe, expect, it } from 'vitest';
import { applyCorrect, applyMiss, createClimb, type ClimbState } from '../../engine/climb';
import { PEAKS } from '../../engine/peaks';
import {
  EXTRA_STEP_MS,
  FALL_MS,
  HOP_MS,
  SLIP_MS,
  describeMove,
  moveDurationMs,
  stageFraction,
} from './motion';

const peak = PEAKS[0];

function withPosition(state: ClimbState, position: number): ClimbState {
  return { ...state, position };
}

describe('describeMove (driven by real climb rules)', () => {
  it('a correct answer is a one-step hop', () => {
    const before = createClimb(peak, 1);
    const after = applyCorrect(before, false);
    expect(describeMove(before, after, false, 1)).toEqual({
      id: 1,
      kind: 'hop',
      from: 0,
      to: 1,
      steps: 1,
      fast: false,
    });
  });

  it('a correct answer at full boost is a two-step hop', () => {
    let state = createClimb(peak, 1);
    for (let i = 0; i < 5; i++) state = applyCorrect(state, false);
    expect(state.boost).toBe(state.boostCapacity);
    const after = applyCorrect(state, true);
    const move = describeMove(state, after, true, 7);
    expect(move.kind).toBe('hop');
    expect(move.steps).toBe(2);
    expect(move.fast).toBe(true);
  });

  it('a miss above the base is a one-step slip', () => {
    const before = withPosition(createClimb(peak, 1), 4);
    const after = applyMiss(before);
    expect(describeMove(before, after, false, 2)).toMatchObject({
      kind: 'slip',
      from: 4,
      to: 3,
      steps: 1,
    });
  });

  it('a miss at the base is a zero-step slip (reacts, stays put)', () => {
    const before = createClimb(peak, 1);
    const after = applyMiss(before);
    expect(describeMove(before, after, false, 3)).toMatchObject({ kind: 'slip', steps: 0, to: 0 });
  });

  it('the miss that exceeds fall risk is a fall back to the base', () => {
    let state = withPosition(createClimb(peak, 9), 6);
    while (state.fallRisk < state.fallRiskCapacity) state = applyMiss(state);
    const after = applyMiss(state);
    expect(after.status).toBe('fell');
    const move = describeMove(state, after, false, 4);
    expect(move.kind).toBe('fall');
    expect(move.to).toBe(0);
    expect(move.from).toBe(state.position);
  });

  it('the final correct answer is a summit move', () => {
    const before = withPosition(createClimb(peak, 8), peak.height - 1);
    const after = applyCorrect(before, false);
    expect(after.status).toBe('summited');
    expect(describeMove(before, after, false, 5)).toMatchObject({
      kind: 'summit',
      to: peak.height,
      steps: 1,
    });
  });

  it('an unchanged state is no move', () => {
    const state = createClimb(peak, 1);
    expect(describeMove(state, state, false, 6).kind).toBe('none');
  });
});

describe('moveDurationMs', () => {
  const base = { id: 0, from: 0, to: 1, fast: false };
  it('scales hops by steps and keeps slips and falls fixed', () => {
    expect(moveDurationMs({ ...base, kind: 'hop', steps: 1 })).toBe(HOP_MS);
    expect(moveDurationMs({ ...base, kind: 'hop', steps: 2 })).toBe(HOP_MS + EXTRA_STEP_MS);
    expect(moveDurationMs({ ...base, kind: 'slip', steps: 1 })).toBe(SLIP_MS);
    expect(moveDurationMs({ ...base, kind: 'fall', steps: 0 })).toBe(FALL_MS);
    expect(moveDurationMs({ ...base, kind: 'none', steps: 0 })).toBe(0);
  });

  it('every move fits inside the 1.5 s reveal beat except the fall, which equals it', () => {
    expect(moveDurationMs({ ...base, kind: 'hop', steps: 2 })).toBeLessThan(1500);
    expect(moveDurationMs({ ...base, kind: 'summit', steps: 2 })).toBeLessThan(1500);
    expect(moveDurationMs({ ...base, kind: 'fall', steps: 0 })).toBeLessThanOrEqual(1500);
  });
});

describe('stageFraction', () => {
  it('is position over height, clamped, and zero after a fall', () => {
    expect(stageFraction({ position: 0, height: 20, status: 'climbing' })).toBe(0);
    expect(stageFraction({ position: 10, height: 20, status: 'climbing' })).toBe(0.5);
    expect(stageFraction({ position: 20, height: 20, status: 'summited' })).toBe(1);
    expect(stageFraction({ position: 12, height: 20, status: 'fell' })).toBe(0);
  });
});
