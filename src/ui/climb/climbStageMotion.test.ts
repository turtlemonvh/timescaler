import { describe, expect, it } from 'vitest';
import { applyCorrect, applyMiss, createClimb } from '../../engine/climb';
import type { Peak } from '../../engine/peaks';
import {
  BIG_HOP_MS,
  DROP_MS,
  FALL_MS,
  HOP_MS,
  REDUCED_CROSSFADE_MS,
  SUMMIT_MS,
  moveDurationMs,
  moveKindFor,
  phaseAt,
  progressFraction,
  stageFraction,
  stagePose,
  stageVars,
  wallBand,
} from './climbStageMotion';

const peak: Peak = { id: 99, name: 'Test Peak', emphasis: 'Testing', height: 10 };

describe('progressFraction', () => {
  it('maps position/height onto 0..1', () => {
    expect(progressFraction(0, 10)).toBe(0);
    expect(progressFraction(5, 10)).toBe(0.5);
    expect(progressFraction(10, 10)).toBe(1);
  });

  it('clamps out-of-range positions rather than translating off the wall', () => {
    expect(progressFraction(-3, 10)).toBe(0);
    expect(progressFraction(14, 10)).toBe(1);
  });

  it('never divides by zero or returns NaN', () => {
    expect(progressFraction(0, 0)).toBe(0);
    expect(progressFraction(3, 0)).toBe(0);
    expect(progressFraction(Number.NaN, 10)).toBe(0);
    expect(progressFraction(3, Number.NaN)).toBe(0);
  });
});

describe('stageFraction', () => {
  it('follows position while climbing', () => {
    expect(stageFraction({ position: 3, height: 12, status: 'climbing' })).toBe(0.25);
  });

  it('draws a fallen climber at the base even though climb.ts keeps their position', () => {
    // `applyMiss` at the fall-risk cap only flips `status`; `position` is left
    // exactly where it was, so the stage — not the engine — decides that a
    // fallen climber is drawn off the wall.
    expect(stageFraction({ position: 9, height: 12, status: 'fell' })).toBe(0);
  });

  it('draws a summited climber at the top', () => {
    expect(stageFraction({ position: 12, height: 12, status: 'summited' })).toBe(1);
  });
});

describe('wallBand', () => {
  it('splits the wall into three bands so top and bottom read differently', () => {
    expect(wallBand(0)).toBe('base');
    expect(wallBand(0.32)).toBe('base');
    expect(wallBand(0.34)).toBe('middle');
    expect(wallBand(0.65)).toBe('middle');
    expect(wallBand(0.67)).toBe('summit');
    expect(wallBand(1)).toBe('summit');
  });

  it('clamps rather than throwing on nonsense input', () => {
    expect(wallBand(-1)).toBe('base');
    expect(wallBand(4)).toBe('summit');
    expect(wallBand(Number.NaN)).toBe('base');
  });
});

describe('moveKindFor', () => {
  it('reads a hop, a boosted hop, a drop, a fall and a summit off real climb.ts transitions', () => {
    const start = createClimb(peak, 5);

    const oneUp = applyCorrect(start, false);
    expect(moveKindFor(start, oneUp, { fast: false })).toBe('hop');

    // Five fast answers fill the 5-pip boost meter; the sixth moves +2.
    let boosted = start;
    for (let i = 0; i < 3; i++) boosted = applyCorrect(boosted, true);
    expect(boosted.boost).toBe(boosted.boostCapacity);
    const doubleStep = applyCorrect(boosted, false);
    expect(doubleStep.position - boosted.position).toBe(2);
    expect(moveKindFor(boosted, doubleStep, { fast: false })).toBe('bigHop');

    const missed = applyMiss(oneUp);
    expect(moveKindFor(oneUp, missed)).toBe('drop');

    const summit = applyCorrect({ ...start, position: peak.height - 1 }, false);
    expect(summit.status).toBe('summited');
    expect(moveKindFor(start, summit)).toBe('summit');

    let atRisk = start;
    for (let i = 0; i < atRisk.fallRiskCapacity; i++) atRisk = applyMiss(atRisk);
    const fell = applyMiss(atRisk);
    expect(fell.status).toBe('fell');
    expect(moveKindFor(atRisk, fell)).toBe('fall');
  });

  it('gives a fast single-step answer the bigger hop', () => {
    const start = createClimb(peak, 5);
    const oneUp = applyCorrect(start, true);
    expect(oneUp.position - start.position).toBe(1);
    expect(moveKindFor(start, oneUp, { fast: true })).toBe('bigHop');
  });

  it('is "none" when nothing about the position or status changed', () => {
    const start = createClimb(peak, 5);
    expect(moveKindFor(start, start)).toBe('none');
  });

  it('prefers the outcome over the step: a fall reads as a fall even at position 0', () => {
    const start = createClimb(peak, 5);
    expect(moveKindFor(start, { position: 0, status: 'fell' })).toBe('fall');
  });
});

describe('moveDurationMs', () => {
  it('uses the per-kind durations, with the drop slower than the hop', () => {
    expect(moveDurationMs('hop', false)).toBe(HOP_MS);
    expect(moveDurationMs('bigHop', false)).toBe(BIG_HOP_MS);
    expect(moveDurationMs('drop', false)).toBe(DROP_MS);
    expect(moveDurationMs('fall', false)).toBe(FALL_MS);
    expect(moveDurationMs('summit', false)).toBe(SUMMIT_MS);
    expect(moveDurationMs('none', false)).toBe(0);
    expect(DROP_MS).toBeGreaterThan(HOP_MS);
  });

  it('collapses every move to one short crossfade under reduced motion', () => {
    for (const kind of ['hop', 'bigHop', 'drop', 'fall', 'summit'] as const) {
      expect(moveDurationMs(kind, true)).toBe(REDUCED_CROSSFADE_MS);
    }
    expect(moveDurationMs('none', true)).toBe(0);
  });
});

describe('phaseAt', () => {
  it('is moving right up to the duration, then settled', () => {
    expect(phaseAt('hop', 0, false)).toBe('moving');
    expect(phaseAt('hop', HOP_MS - 1, false)).toBe('moving');
    expect(phaseAt('hop', HOP_MS, false)).toBe('settled');
    expect(phaseAt('hop', HOP_MS + 5000, false)).toBe('settled');
  });

  it('settles a drop later than a hop, at the same elapsed time', () => {
    expect(phaseAt('hop', 450, false)).toBe('settled');
    expect(phaseAt('drop', 450, false)).toBe('moving');
  });

  it('is settled almost immediately under reduced motion', () => {
    expect(phaseAt('drop', 0, true)).toBe('moving');
    expect(phaseAt('drop', REDUCED_CROSSFADE_MS, true)).toBe('settled');
  });

  it('never reports a non-move or a broken clock as moving', () => {
    expect(phaseAt('none', 0, false)).toBe('settled');
    expect(phaseAt('hop', Number.NaN, false)).toBe('settled');
  });
});

describe('stagePose', () => {
  it('describes the move while travelling', () => {
    expect(stagePose('hop', 'moving', 'climbing')).toBe('move');
    expect(stagePose('bigHop', 'moving', 'climbing')).toBe('move');
    expect(stagePose('drop', 'moving', 'climbing')).toBe('hurt');
    expect(stagePose('fall', 'moving', 'fell')).toBe('hurt');
    expect(stagePose('summit', 'moving', 'summited')).toBe('celebrate');
  });

  it('returns to idle once a mid-climb move has settled', () => {
    expect(stagePose('hop', 'settled', 'climbing')).toBe('idle');
    expect(stagePose('drop', 'settled', 'climbing')).toBe('idle');
    expect(stagePose('none', 'settled', 'climbing')).toBe('idle');
  });

  it('holds the outcome pose once the climb is over', () => {
    expect(stagePose('summit', 'settled', 'summited')).toBe('celebrate');
    expect(stagePose('fall', 'settled', 'fell')).toBe('hurt');
  });
});

describe('stageVars', () => {
  it('emits the destination and the duration together as CSS custom properties', () => {
    expect(stageVars(0.25, 'hop', false)).toEqual({
      '--climb-progress': '0.25',
      '--climb-move-ms': `${HOP_MS}ms`,
    });
  });

  it('clamps the destination and shortens the duration under reduced motion', () => {
    expect(stageVars(1.4, 'drop', true)).toEqual({
      '--climb-progress': '1',
      '--climb-move-ms': `${REDUCED_CROSSFADE_MS}ms`,
    });
  });

  it('never emits NaN into the stylesheet', () => {
    expect(stageVars(Number.NaN, 'none', false)['--climb-progress']).toBe('0');
  });
});
