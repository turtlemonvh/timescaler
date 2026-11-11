import { difficultyProfile } from '../difficulty';
import { randInt, type Rng } from '../rng';
import { formatClockFace, makeQuestionId, timeLimitFor } from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const ELAPSED_BETWEEN_TYPE_ID = 'elapsedBetween';

/** A free-typed subtraction between two clock readings — no options to
 * scan, so a touch more time than the choice-mode elapsedAdd. */
const TIME_LIMIT_MULTIPLIER = 1.3;

/**
 * The two clock readings, banded by difficulty. This type is free-entry,
 * and `answerModeWeights.free` is 0 below level 7, so in a climb it only
 * appears from level 7 (debug/preview pages can still ask for any level).
 * Up to level 8 both times sit on 5-minute marks (so the gap is a multiple
 * of 5); at 9–10 they can be any minute. The gap is capped at 5h, well under
 * 24h, so the pair never needs to cross midnight — "how many minutes between
 * these two clock readings" stays same-day and unambiguous.
 */
function pickTimes(rng: Rng, difficulty: number): { startTotal: number; elapsedMinutes: number } {
  if (difficulty <= 8) {
    const elapsedMinutes = randInt(rng, 1, 60) * 5;
    const startTotal = randInt(rng, 0, (1435 - elapsedMinutes) / 5) * 5;
    return { startTotal, elapsedMinutes };
  }
  const elapsedMinutes = randInt(rng, 1, 300);
  return { startTotal: randInt(rng, 0, 1439 - elapsedMinutes), elapsedMinutes };
}

/**
 * Peak 6's free-entry counterpart to `elapsedAdd`: given a start and end
 * clock reading, type the number of minutes between them. Both times are
 * drawn from the same day (see `pickTimes`), so the answer is
 * always their plain difference — no day-boundary bookkeeping.
 */
export function generateElapsedBetween(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  const { startTotal, elapsedMinutes } = pickTimes(rng, ctx.difficulty);
  const endTotal = startTotal + elapsedMinutes;
  const start = { hour: Math.floor(startTotal / 60), minute: startTotal % 60, second: 0 };
  const end = { hour: Math.floor(endTotal / 60), minute: endTotal % 60, second: 0 };
  const startLabel = formatClockFace(start, false);
  const endLabel = formatClockFace(end, false);
  return {
    id: makeQuestionId(rng, ELAPSED_BETWEEN_TYPE_ID),
    typeId: ELAPSED_BETWEEN_TYPE_ID,
    prompt: `It's ${startLabel}. It becomes ${endLabel}. How many minutes have passed?`,
    display: { kind: 'none' },
    answer: { kind: 'number', target: elapsedMinutes, unit: 'minutes' },
    timeLimitMs: timeLimitFor(profile, TIME_LIMIT_MULTIPLIER),
    explainCorrect: `From ${startLabel} to ${endLabel} is ${elapsedMinutes} minutes.`,
  };
}

export const elapsedBetweenType: QuestionType = {
  typeId: ELAPSED_BETWEEN_TYPE_ID,
  answerMode: 'free',
  generate: generateElapsedBetween,
};
