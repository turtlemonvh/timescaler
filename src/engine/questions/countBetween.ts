import { getDaysInMonth } from 'date-fns';
import { daysBetween, formatDateLong, offsetDate, randomDate } from '../dateMath';
import { difficultyProfile } from '../difficulty';
import { randInt, weightedPick, type Rng, type WeightedItem } from '../rng';
import { makeQuestionId, randomQuestionDate, timeLimitFor } from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const COUNT_BETWEEN_TYPE_ID = 'countBetween';

/** Free-typed counting across a span of up to about four months — the most
 * demanding count this engine asks for. */
const TIME_LIMIT_MULTIPLIER = 1.5;

interface SpanBand {
  /** Day-count range; ignored by the `sameMonth` and `oneYear` shapes. */
  days: readonly [number, number];
  shapes: readonly WeightedItem<SpanShape>[];
}

/**
 * - `sameMonth`: both dates in one month — just subtract the day numbers.
 * - `nextMonth`: crosses exactly one month boundary — needs that month's length.
 * - `anywhere`: a longer span from any start date; may cross several months.
 * - `february`: a longer span whose window includes the end of February,
 *   so whether that year has a February 29th changes the answer.
 * - `oneYear`: the same date a year later — 365 or 366, a leap-year fact
 *   rather than an arithmetic slog.
 *
 * Long spans used to run up to 1000 days from level 7 (and 120 at level 5),
 * which was far too hard (issue #126). They're now capped at about four
 * months at the very top, with the old level-5 range as the level-10 ceiling.
 */
type SpanShape = 'sameMonth' | 'nextMonth' | 'anywhere' | 'february' | 'oneYear';

/** One band per difficulty level 1-10. */
const SPAN_BANDS: readonly SpanBand[] = [
  { days: [3, 12], shapes: [{ value: 'sameMonth', weight: 1 }] },
  { days: [3, 15], shapes: [{ value: 'sameMonth', weight: 1 }] },
  { days: [5, 15], shapes: [{ value: 'nextMonth', weight: 1 }] },
  { days: [5, 20], shapes: [{ value: 'nextMonth', weight: 1 }] },
  { days: [10, 25], shapes: [{ value: 'nextMonth', weight: 1 }] },
  { days: [10, 30], shapes: [{ value: 'nextMonth', weight: 1 }] },
  {
    days: [25, 50],
    shapes: [
      { value: 'anywhere', weight: 1 },
      { value: 'february', weight: 1 },
    ],
  },
  {
    days: [30, 60],
    shapes: [
      { value: 'anywhere', weight: 40 },
      { value: 'february', weight: 45 },
      { value: 'oneYear', weight: 15 },
    ],
  },
  {
    days: [40, 90],
    shapes: [
      { value: 'anywhere', weight: 35 },
      { value: 'february', weight: 40 },
      { value: 'oneYear', weight: 25 },
    ],
  },
  {
    days: [60, 120],
    shapes: [
      { value: 'anywhere', weight: 35 },
      { value: 'february', weight: 40 },
      { value: 'oneYear', weight: 25 },
    ],
  },
];

const SPAN_LEVEL_DESCRIPTIONS: readonly string[] = [
  'Both dates in the same month',
  'Both dates in the same month',
  'Into the next month, up to about 2 weeks',
  'Into the next month, up to about 3 weeks',
  'Into the next month, up to about 3 weeks',
  'Into the next month, up to about a month',
  'Up to about 7 weeks, often across February',
  'Up to 2 months across February, or exactly a year',
  'Up to 3 months, or exactly a year (365 or 366 days)',
  'Up to 4 months, or exactly a year (365 or 366 days)',
];

function clampLevel(difficulty: number): number {
  return Math.min(10, Math.max(1, Math.round(difficulty)));
}

/** Plain-English summary of what level `difficulty` asks on Leap Crag, for
 * the level-details comparison table (`difficultyDescribe.ts`). */
export function describeCountBetweenLevel(difficulty: number): string {
  return SPAN_LEVEL_DESCRIPTIONS[clampLevel(difficulty) - 1];
}

function randomMonthStart(rng: Rng, span: 'acrossMonths' | 'acrossYears'): Date {
  const anchor = randomQuestionDate(rng, span);
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

/** Picks the two dates for this difficulty's band. `end` is always after `start`. */
function planSpan(rng: Rng, difficulty: number): { start: Date; end: Date } {
  const band = SPAN_BANDS[clampLevel(difficulty) - 1];
  const shape = weightedPick(rng, band.shapes);
  switch (shape) {
    case 'sameMonth': {
      const month = randomMonthStart(rng, 'acrossMonths');
      const monthDays = getDaysInMonth(month);
      const days = randInt(rng, ...band.days);
      const startDay = randInt(rng, 1, monthDays - days);
      const start = new Date(month.getFullYear(), month.getMonth(), startDay);
      return { start, end: offsetDate(start, days, 'day') };
    }
    case 'nextMonth': {
      // The start day is drawn so start + days lands in the following month,
      // and not past it: one boundary, whatever the two months' lengths.
      const month = randomMonthStart(rng, 'acrossMonths');
      const monthDays = getDaysInMonth(month);
      const nextDays = getDaysInMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
      const days = randInt(rng, ...band.days);
      const startDay = randInt(
        rng,
        Math.max(1, monthDays - days + 1),
        Math.min(monthDays, monthDays + nextDays - days),
      );
      const start = new Date(month.getFullYear(), month.getMonth(), startDay);
      return { start, end: offsetDate(start, days, 'day') };
    }
    case 'anywhere': {
      const start = randomQuestionDate(rng, 'acrossYears');
      return { start, end: offsetDate(start, randInt(rng, ...band.days), 'day') };
    }
    case 'february': {
      // Start no later than Feb 28 and end on or after Mar 1, so the span
      // always includes February's last day(s) — leap year or not.
      const year = randomMonthStart(rng, 'acrossYears').getFullYear();
      const days = randInt(rng, ...band.days);
      const march1 = new Date(year, 2, 1);
      const start = randomDate(rng, offsetDate(march1, -days, 'day'), new Date(year, 1, 28));
      return { start, end: offsetDate(start, days, 'day') };
    }
    case 'oneYear': {
      // Days 1-28 so the same date exists next year (no Feb 29 start).
      const month = randomMonthStart(rng, 'acrossYears');
      const start = new Date(month.getFullYear(), month.getMonth(), randInt(rng, 1, 28));
      return { start, end: new Date(start.getFullYear() + 1, start.getMonth(), start.getDate()) };
    }
  }
}

/**
 * Peak 9's emphasis: counting the days between two real calendar dates,
 * typed in. It ramps from same-month subtraction, through one month
 * boundary, to spans across February (where a leap day changes the answer)
 * and whole years (365 or 366). No display: both dates are stated in the
 * prompt.
 */
export function generateCountBetween(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  const { start, end } = planSpan(rng, ctx.difficulty);
  const target = daysBetween(start, end);
  const startLabel = formatDateLong(start);
  const endLabel = formatDateLong(end);
  return {
    id: makeQuestionId(rng, COUNT_BETWEEN_TYPE_ID),
    typeId: COUNT_BETWEEN_TYPE_ID,
    prompt: `How many days are there from ${startLabel} to ${endLabel}?`,
    display: { kind: 'none' },
    answer: { kind: 'number', target, unit: 'days' },
    timeLimitMs: timeLimitFor(profile, TIME_LIMIT_MULTIPLIER),
    explainCorrect: `From ${startLabel} to ${endLabel} is ${target} days.`,
  };
}

export const countBetweenType: QuestionType = {
  typeId: COUNT_BETWEEN_TYPE_ID,
  answerMode: 'free',
  generate: generateCountBetween,
};
