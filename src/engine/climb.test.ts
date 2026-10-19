import { describe, expect, it } from 'vitest';
import {
  applyCorrect,
  applyMiss,
  climbHeight,
  climbLengthFactor,
  climbLengthLabel,
  createClimb,
  isFastAnswer,
} from './climb';
import { PEAKS, type Peak } from './peaks';

// A fixed-height fixture, deliberately independent of the real PEAKS data
// (whose heights are tuned per peak against the pacing simulation and don't
// hold still — see peaks.ts's own doc comment) — this file tests the pure
// climb state machine, not any particular peak's numbers.
const testPeak: Peak = { id: 99, name: 'Test Peak', emphasis: 'Testing', height: 20 };

describe('createClimb', () => {
  it('starts at position 0, no boost, no fall risk, climbing', () => {
    const state = createClimb(testPeak, 5);
    expect(state.position).toBe(0);
    expect(state.boost).toBe(0);
    expect(state.fallRisk).toBe(0);
    expect(state.status).toBe('climbing');
    expect(state.height).toBe(10); // level 5 climbs half the peak's height
    expect(state.boostCapacity).toBe(5);
  });

  it('climbs the full peak height at difficulty 8-10', () => {
    expect(createClimb(testPeak, 8).height).toBe(20);
    expect(createClimb(testPeak, 10).height).toBe(20);
  });

  it('sets fall-risk capacity to 5 for difficulty 1-3', () => {
    expect(createClimb(testPeak, 1).fallRiskCapacity).toBe(5);
    expect(createClimb(testPeak, 3).fallRiskCapacity).toBe(5);
  });

  it('sets fall-risk capacity to 4 for difficulty 4-7', () => {
    expect(createClimb(testPeak, 4).fallRiskCapacity).toBe(4);
    expect(createClimb(testPeak, 7).fallRiskCapacity).toBe(4);
  });

  it('sets fall-risk capacity to 3 for difficulty 8-10', () => {
    expect(createClimb(testPeak, 8).fallRiskCapacity).toBe(3);
    expect(createClimb(testPeak, 10).fallRiskCapacity).toBe(3);
  });
});

describe('climb length by level (issue #131)', () => {
  it('is half at 1-5, two thirds at 6, five sixths at 7, full at 8-10', () => {
    const factors = Array.from({ length: 10 }, (_, i) => climbLengthFactor(i + 1));
    expect(factors).toEqual([0.5, 0.5, 0.5, 0.5, 0.5, 2 / 3, 5 / 6, 1, 1, 1]);
  });

  it('never gets shorter as the level goes up', () => {
    for (const peak of PEAKS) {
      for (let level = 2; level <= 10; level++) {
        expect(climbHeight(peak, level)).toBeGreaterThanOrEqual(climbHeight(peak, level - 1));
      }
    }
  });

  it('makes every real peak about half as long at 1-5 as at 8-10', () => {
    for (const peak of PEAKS) {
      const full = climbHeight(peak, 8);
      expect(full).toBe(peak.height);
      expect(climbHeight(peak, 10)).toBe(full);
      for (let level = 1; level <= 5; level++) {
        // Rounded to a whole step, so within half a step of exactly half.
        expect(Math.abs(climbHeight(peak, level) - full / 2)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it('labels the lengths Short, Medium and Full', () => {
    expect(climbLengthLabel(1)).toBe('Short');
    expect(climbLengthLabel(5)).toBe('Short');
    expect(climbLengthLabel(6)).toBe('Medium');
    expect(climbLengthLabel(7)).toBe('Medium');
    expect(climbLengthLabel(8)).toBe('Full');
    expect(climbLengthLabel(10)).toBe('Full');
  });
});

describe('applyCorrect', () => {
  it('advances by 1 step when not boosted', () => {
    const state = applyCorrect(createClimb(testPeak, 5), false);
    expect(state.position).toBe(1);
  });

  it('increments boost by 1 on a normal-speed correct answer', () => {
    const state = applyCorrect(createClimb(testPeak, 5), false);
    expect(state.boost).toBe(1);
  });

  it('increments boost by 2 on a fast correct answer', () => {
    const state = applyCorrect(createClimb(testPeak, 5), true);
    expect(state.boost).toBe(2);
  });

  it('clamps boost at capacity and does not overflow', () => {
    let state = createClimb(testPeak, 5);
    for (let i = 0; i < 5; i++) state = applyCorrect(state, true); // +2 each, would overflow to 10
    expect(state.boost).toBe(5);
  });

  it('doubles step gain once boost reaches capacity', () => {
    let state = createClimb(testPeak, 5);
    // Fill boost to capacity (5) with fast answers: +2,+2,+2,+2,+2 -> clamps at 5 on the 3rd
    state = applyCorrect(state, true); // boost 2, pos 1
    state = applyCorrect(state, true); // boost 4, pos 2
    state = applyCorrect(state, true); // boost capped at 5, pos 3 (still normal speed this answer, since boost was 4 before it)
    expect(state.boost).toBe(5);
    const beforeBoostedStep = state.position;
    state = applyCorrect(state, false); // boost was already at capacity -> this step is worth 2
    expect(state.position).toBe(beforeBoostedStep + 2);
  });

  it('reaches summited exactly at height and clamps position there', () => {
    let state = createClimb(testPeak, 8); // height 20
    for (let i = 0; i < 20; i++) state = applyCorrect(state, false);
    expect(state.status).toBe('summited');
    expect(state.position).toBe(20);
    const beforeExtra = state;
    state = applyCorrect(state, false);
    expect(state).toEqual(beforeExtra); // no-op once summited
  });
});

describe('applyMiss', () => {
  it('decrements position by 1, floored at 0', () => {
    let state = createClimb(testPeak, 5);
    state = applyCorrect(state, false); // position 1
    state = applyMiss(state);
    expect(state.position).toBe(0);
    state = applyMiss(state);
    expect(state.position).toBe(0); // floored, not negative
  });

  it('halves boost (rounding down) on each miss, from capacity down to 0, never negative', () => {
    let state = createClimb(testPeak, 5);
    for (let i = 0; i < 5; i++) state = applyCorrect(state, true);
    expect(state.boost).toBe(5);
    state = applyMiss(state);
    expect(state.boost).toBe(2);
    state = applyMiss(state);
    expect(state.boost).toBe(1);
    state = applyMiss(state);
    expect(state.boost).toBe(0);
    expect(state.status).toBe('climbing');
    // Fall risk is now at capacity (4); stay below it to keep climbing and
    // confirm a miss at boost 0 can't drive it negative.
    state = applyMiss({ ...state, fallRisk: 0 });
    expect(state.boost).toBe(0);
  });

  it('halves a boost of 1 down to 0 (Math.floor boundary)', () => {
    let state = createClimb(testPeak, 5);
    state = applyCorrect(state, false);
    expect(state.boost).toBe(1);
    state = applyMiss(state);
    expect(state.boost).toBe(0);
  });

  it('increments fall risk on each miss up to capacity', () => {
    let state = createClimb(testPeak, 1); // fallRiskCapacity 5
    for (let i = 0; i < 5; i++) {
      state = applyMiss(state);
      expect(state.status).toBe('climbing');
    }
    expect(state.fallRisk).toBe(5);
  });

  it('falls on the miss after fall risk reaches capacity (capacity + 1 total misses)', () => {
    let state = createClimb(testPeak, 1); // fallRiskCapacity 5, so 6 misses fall
    for (let i = 0; i < 5; i++) state = applyMiss(state);
    expect(state.status).toBe('climbing');
    state = applyMiss(state); // 6th miss
    expect(state.status).toBe('fell');
  });

  it('allows exactly 4 misses at difficulty 4-7 before falling on the 5th', () => {
    let state = createClimb(testPeak, 5); // fallRiskCapacity 4
    for (let i = 0; i < 4; i++) state = applyMiss(state);
    expect(state.status).toBe('climbing');
    state = applyMiss(state);
    expect(state.status).toBe('fell');
  });

  it('allows exactly 3 misses at difficulty 8-10 before falling on the 4th', () => {
    let state = createClimb(testPeak, 8); // fallRiskCapacity 3
    for (let i = 0; i < 3; i++) state = applyMiss(state);
    expect(state.status).toBe('climbing');
    state = applyMiss(state);
    expect(state.status).toBe('fell');
  });

  it('is a no-op once fallen', () => {
    let state = createClimb(testPeak, 1);
    for (let i = 0; i < 6; i++) state = applyMiss(state);
    expect(state.status).toBe('fell');
    const fallen = state;
    state = applyMiss(state);
    expect(state).toEqual(fallen);
    state = applyCorrect(state, true);
    expect(state).toEqual(fallen);
  });
});

describe('isFastAnswer', () => {
  it('is true when answered in under half the time limit', () => {
    expect(isFastAnswer(2000, 10000)).toBe(true);
  });

  it('is false when answered at exactly half the time limit', () => {
    expect(isFastAnswer(5000, 10000)).toBe(false);
  });

  it('is false when answered in over half the time limit', () => {
    expect(isFastAnswer(8000, 10000)).toBe(false);
  });

  it('is true for an instant answer (0ms elapsed)', () => {
    expect(isFastAnswer(0, 10000)).toBe(true);
  });
});
