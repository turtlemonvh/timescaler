import { difficultyProfile } from '../difficulty';
import { pick, randInt, shuffle, type Rng } from '../rng';
import type { TimeOfDay } from '../timeMath';
import {
  buildChoiceAnswer,
  clockSortKey,
  formatClockFace,
  makeQuestionId,
  shiftTime,
  timeLimitFor,
} from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const ELAPSED_ADD_TYPE_ID = 'elapsedAdd';

/** A minute's worth of mental addition/subtraction on top of reading a
 * clock — a bit more than a single glance, well short of offsetDate's
 * multi-step date jump. */
const TIME_LIMIT_MULTIPLIER = 1.2;

/** One drawn question: where the clock starts, how far it moves, and which way. */
interface ElapsedPlan {
  start: TimeOfDay;
  amount: number;
  forward: boolean;
}

/**
 * Every (start minute, amount) pair at a `step`-minute grain, up to
 * `amountMax`, whose result stays inside the start's hour (minute 0..`lastMinute`).
 * `startGrain` is the grain of the start minute itself (1 = any minute).
 */
function sameHourPairs(
  forward: boolean,
  startGrain: number,
  step: number,
  amountMax: number,
  lastMinute: number,
): [number, number][] {
  const pairs: [number, number][] = [];
  for (let minute = 0; minute <= lastMinute; minute += startGrain) {
    for (let amount = step; amount <= amountMax; amount += step) {
      const end = forward ? minute + amount : minute - amount;
      if (end >= 0 && end <= lastMinute) pairs.push([minute, amount]);
    }
  }
  return pairs;
}

/**
 * The per-level curriculum agreed in issue #164:
 *
 * | Level | Start minute | Amount                          | Direction | Crosses hour |
 * |-------|--------------|---------------------------------|-----------|--------------|
 * | 1     | steps of 10  | 10–50, steps of 10              | add       | no           |
 * | 2     | steps of 5   | 5–55, steps of 5                | add       | no           |
 * | 3     | steps of 5   | 5–55, steps of 5                | both      | no           |
 * | 4     | steps of 5   | 5–55 steps of 5, or 1h / 2h     | both      | yes          |
 * | 5     | any          | 5–55, steps of 5                | both      | no           |
 * | 6     | any          | 5–55, steps of 5                | both      | yes          |
 * | 7     | any          | 1–2h plus 5–55 min, steps of 5  | both      | yes          |
 * | 8–10  | any          | 1–180 minutes                   | both      | yes          |
 *
 * The no-crossing levels draw uniformly over every valid (start, amount)
 * pair, so a start of :00 isn't over-represented just because it has the
 * most amounts available.
 */
function planElapsed(rng: Rng, difficulty: number): ElapsedPlan {
  const hour = randInt(rng, 0, 23);
  const at = (minute: number) => ({ hour, minute, second: 0 });
  if (difficulty <= 3) {
    const forward = difficulty <= 2 || rng() < 0.5;
    const pairs =
      difficulty === 1
        ? sameHourPairs(forward, 10, 10, 50, 50)
        : sameHourPairs(forward, 5, 5, 55, 55);
    const [minute, amount] = pick(rng, pairs);
    return { start: at(minute), amount, forward };
  }
  const forward = rng() < 0.5;
  if (difficulty === 4) {
    const amount = rng() < 0.25 ? pick(rng, [60, 120]) : randInt(rng, 1, 11) * 5;
    return { start: at(randInt(rng, 0, 11) * 5), amount, forward };
  }
  if (difficulty === 5) {
    const [minute, amount] = pick(rng, sameHourPairs(forward, 1, 5, 55, 59));
    return { start: at(minute), amount, forward };
  }
  const start = at(randInt(rng, 0, 59));
  if (difficulty === 6) return { start, amount: randInt(rng, 1, 11) * 5, forward };
  if (difficulty === 7) {
    return { start, amount: randInt(rng, 1, 2) * 60 + randInt(rng, 1, 11) * 5, forward };
  }
  return { start, amount: randInt(rng, 1, 180), forward };
}

/**
 * Wrong options at the level's grain. While the hour never changes (levels
 * 1–3) every option keeps the correct answer's hour — a different hour
 * would give the answer away — and sits on the level's minute grain (10s at
 * level 1, 5s at 2–3). From level 4 one option is always the correct time
 * ±1 hour (the forgotten-carry mistake), and the other two are ±5–20
 * minute near misses, which keep a 5-minute answer on a 5-minute mark.
 */
function elapsedDistractors(rng: Rng, correct: TimeOfDay, difficulty: number): TimeOfDay[] {
  if (difficulty <= 3) {
    const step = difficulty === 1 ? 10 : 5;
    const pool: TimeOfDay[] = [];
    for (let minute = 0; minute < 60; minute += step) {
      if (minute !== correct.minute) pool.push({ ...correct, minute });
    }
    return pool;
  }
  const carry = shiftTime(correct, (rng() < 0.5 ? 1 : -1) * 3600);
  const nearMisses = shuffle(
    rng,
    [5, -5, 10, -10, 15, -15, 20, -20].map((m) => shiftTime(correct, m * 60)),
  ).slice(0, 2);
  return [carry, ...nearMisses];
}

const ELAPSED_LEVEL_DESCRIPTIONS: readonly string[] = [
  'Adds tens of minutes (2:10 + 30), staying inside the hour',
  'Adds 5-minute steps (2:15 + 25), staying inside the hour',
  'Adds or takes away 5-minute steps, staying inside the hour',
  'Crosses the hour (2:50 + 20), plus whole-hour jumps',
  'Any start minute (2:47 − 15), staying inside the hour',
  'Any start minute, 5-minute steps across the hour',
  'Jumps of over an hour (1 hour and 25 minutes)',
  'Any jump up to 3 hours',
  'Any jump up to 3 hours',
  'Any jump up to 3 hours',
];

/** Plain-English summary of what level `difficulty` asks on Elapsed
 * Escarpment, for the level-details comparison table (`difficultyDescribe.ts`). */
export function describeElapsedAddLevel(difficulty: number): string {
  const level = Math.min(10, Math.max(1, Math.round(difficulty)));
  return ELAPSED_LEVEL_DESCRIPTIONS[level - 1];
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  if (rem === 0) return hourLabel;
  return `${hourLabel} and ${rem} minute${rem === 1 ? '' : 's'}`;
}

/**
 * Peak 6's emphasis: "it's 3:15 — what time will it be in 40 minutes?" (and
 * its mirror, "what time was it 40 minutes ago?"). Text-only, like
 * `offsetDate` — the arithmetic lives in the prompt, not a display, so
 * there's nothing here for `contract.test.ts` to re-derive a display
 * from; its own test file re-computes the arithmetic straight from the
 * prompt instead.
 */
export function generateElapsedAdd(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  const { start, amount, forward } = planElapsed(rng, ctx.difficulty);
  const sign = forward ? 1 : -1;
  const correctTime = shiftTime(start, sign * amount * 60);
  const correct = formatClockFace(correctTime, false);
  const candidates = elapsedDistractors(rng, correctTime, ctx.difficulty).map((t) => ({
    label: formatClockFace(t, false),
    sort: clockSortKey(t),
  }));
  const duration = formatDuration(amount);
  const startLabel = formatClockFace(start, false);
  const prompt = forward
    ? `It's ${startLabel}. What time will it be in ${duration}?`
    : `It's ${startLabel}. What time was it ${duration} ago?`;
  return {
    id: makeQuestionId(rng, ELAPSED_ADD_TYPE_ID),
    typeId: ELAPSED_ADD_TYPE_ID,
    prompt,
    display: { kind: 'none' },
    answer: buildChoiceAnswer(
      rng,
      { label: correct, sort: clockSortKey(correctTime) },
      candidates,
      { ordered: profile.orderedChoices },
    ),
    timeLimitMs: timeLimitFor(profile, TIME_LIMIT_MULTIPLIER),
    explainCorrect: forward
      ? `${duration} after ${startLabel} is ${correct}.`
      : `${duration} before ${startLabel} is ${correct}.`,
  };
}

export const elapsedAddType: QuestionType = {
  typeId: ELAPSED_ADD_TYPE_ID,
  answerMode: 'choice',
  generate: generateElapsedAdd,
};
