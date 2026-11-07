import { difficultyProfile, type DifficultyProfile } from '../difficulty';
import type { Rng } from '../rng';
import { randomTime, type TimePrecision } from '../timeMath';
import { formatClockFace, makeQuestionId, pickPrecision, timeLimitFor } from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const SET_HANDS_TYPE_ID = 'setHands';

/** Stepping both hands to a target with the buttons takes real, hands-on
 * time — well above a single glance-and-pick multiple-choice question. */
const TIME_LIMIT_MULTIPLIER = 1.3;

/**
 * Like `pickPrecision`, but never returns `'second'`: the interactive
 * `AnalogClock` has no control for a second hand (see `SetHandsAnswer`'s doc
 * comment — grading itself ignores seconds), so a second-precision target
 * would just be a `'minute'`-precision one with an unused, invisible extra
 * digit of "precision" nobody can act on.
 */
function pickHandsPrecision(rng: Rng, profile: DifficultyProfile): TimePrecision {
  const precision = pickPrecision(rng, profile);
  return precision === 'second' ? 'minute' : precision;
}

/**
 * Peak 4's emphasis: set the clock's hands to match a spoken/written time.
 * No display — the interactive `AnalogClock` the player steps *is* the
 * answer widget (see `Climb.tsx`), not something separately shown.
 */
export function generateSetHands(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  const precision = pickHandsPrecision(rng, profile);
  const target = randomTime(rng, precision);
  const label = formatClockFace(target, false);
  return {
    id: makeQuestionId(rng, SET_HANDS_TYPE_ID),
    typeId: SET_HANDS_TYPE_ID,
    prompt: `Set the clock to ${label}.`,
    display: { kind: 'none' },
    answer: { kind: 'setHands', target, precision },
    timeLimitMs: timeLimitFor(profile, TIME_LIMIT_MULTIPLIER),
    explainCorrect: `The clock should show ${label}.`,
  };
}

export const setHandsType: QuestionType = {
  typeId: SET_HANDS_TYPE_ID,
  answerMode: 'interactive',
  generate: generateSetHands,
};
