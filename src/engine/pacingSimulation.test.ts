import { describe, expect, it } from 'vitest';
import { climbHeight } from './climb';
import { PEAKS } from './peaks';
import { simulatePeakCompletion, type PacingProfile } from './pacingSimulation';
import { mulberry32 } from './rng';

/**
 * A player who's found their comfortable difficulty — the adaptive-difficulty
 * design's whole intent is that a player mostly succeeds at whatever level
 * they're on, not that they scrape by. 90% accuracy, answering in well under
 * half of each question's own time limit (so "fast" answers, and the boost
 * bonus they earn, are the common case rather than the exception).
 */
const TYPICAL_PROFILE: PacingProfile = { accuracy: 0.9, answerSpeedFraction: 0.4 };

/** Runs enough independent attempts that the average isn't dominated by one
 * unlucky (or lucky) run — a single simulated climb can swing wildly (an
 * early streak of misses can trigger a fall-and-retry that multiplies the
 * total), so this is the number that made repeated runs across several
 * different seed offsets land consistently within the target band during
 * tuning; fewer made the test itself flaky, not just the game. */
const SAMPLES_PER_COMBO = 20;

/**
 * Target average minutes per peak, by level. Levels 1-5 climb half the
 * peak's height (`climbLengthFactor`, issue #131), so their target is about
 * half the full-length 2-5 minutes.
 */
const TARGET_MINUTES: Readonly<Record<number, { min: number; max: number }>> = {
  3: { min: 1, max: 2.5 },
  8: { min: 2, max: 5 },
};

/** Distinct, reproducible seed per (peak, difficulty, sample) triple. */
function seedFor(peakId: number, difficulty: number, sample: number): number {
  return peakId * 1_000_003 + difficulty * 7919 + sample * 65537 + 29;
}

function averageCompletionMinutes(peakId: number, difficulty: number): number {
  const peak = PEAKS.find((p) => p.id === peakId);
  if (!peak) throw new Error(`no peak with id ${peakId}`);
  let totalMs = 0;
  for (let sample = 0; sample < SAMPLES_PER_COMBO; sample++) {
    const rng = mulberry32(seedFor(peakId, difficulty, sample));
    const result = simulatePeakCompletion(rng, peak, difficulty, TYPICAL_PROFILE);
    totalMs += result.totalElapsedMs;
  }
  return totalMs / SAMPLES_PER_COMBO / 60_000;
}

describe('simulatePeakCompletion', () => {
  it('returns 1 attempt and a positive elapsed time for a trivially generous profile', () => {
    const peak = PEAKS[0];
    const rng = mulberry32(1);
    const result = simulatePeakCompletion(rng, peak, 1, { accuracy: 1, answerSpeedFraction: 0.1 });
    expect(result.attempts).toBe(1);
    expect(result.totalElapsedMs).toBeGreaterThan(0);
    expect(result.questionsAnswered).toBeGreaterThan(0);
    // Perfect accuracy still needs at least height/2 correct answers (2 steps
    // per hit once boost maxes out), never fewer.
    expect(result.questionsAnswered).toBeGreaterThanOrEqual(climbHeight(peak, 1) / 2);
  });

  it('is deterministic for a given seed', () => {
    const peak = PEAKS[0];
    const a = simulatePeakCompletion(mulberry32(7), peak, 5, TYPICAL_PROFILE);
    const b = simulatePeakCompletion(mulberry32(7), peak, 5, TYPICAL_PROFILE);
    expect(a).toEqual(b);
  });

  /**
   * The pacing tuning pass this test represents: per the design spec's own
   * testing-strategy section, a typical player's completion time per peak
   * should land in 2-5 minutes at full climb length — about half that at
   * the half-length levels 1-5 (`TARGET_MINUTES`). Checked at difficulty 3 and 8 — the same two
   * levels the spec's own M5 "Verify" line names for a human playtest pass
   * — across every peak, since `selectGenerator` restricts each peak to
   * only its own on-theme generator(s) (`peakEmphasis.ts`), and different
   * peaks' matched generators carry different `TIME_LIMIT_MULTIPLIER`s.
   */
  describe.each([3, 8])('at difficulty %i', (difficulty) => {
    const { min, max } = TARGET_MINUTES[difficulty];
    for (const peak of PEAKS) {
      it(`peak ${peak.id} (${peak.name}, ${climbHeight(peak, difficulty)} steps) completes in ${min}-${max} minutes on average`, () => {
        const minutes = averageCompletionMinutes(peak.id, difficulty);
        expect(minutes).toBeGreaterThanOrEqual(min);
        expect(minutes).toBeLessThanOrEqual(max);
      });
    }
  });
});
