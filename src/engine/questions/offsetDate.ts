import { getDaysInMonth } from 'date-fns';
import { formatDateLong, offsetDate, type DateOffsetUnit } from '../dateMath';
import { difficultyProfile } from '../difficulty';
import { randInt, weightedPick, type Rng, type WeightedItem } from '../rng';
import { buildChoiceAnswer, makeQuestionId, randomQuestionDate, timeLimitFor } from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const OFFSET_DATE_TYPE_ID = 'offsetDate';

/** Counting a jump across a calendar (and, at higher difficulty, across
 * months or years) is genuinely multi-step compared to reading a single
 * clock face. */
export const OFFSET_DATE_TIME_LIMIT_MULTIPLIER = 1.4;

interface OffsetPlan {
  start: Date;
  unit: DateOffsetUnit;
  amount: number;
  forward: boolean;
}

const UNIT_LABELS: Record<DateOffsetUnit, { one: string; many: string }> = {
  day: { one: 'day', many: 'days' },
  week: { one: 'week', many: 'weeks' },
  month: { one: 'month', many: 'months' },
};

/**
 * The kinds of jump Monthfall Pass asks about, from easiest to hardest:
 *
 * - `daysWithin` / `weeksWithin`: the answer stays in the start date's month,
 *   so it's plain addition/subtraction on the day number.
 * - `months`: whole months on the same day-of-month — crosses months (and
 *   years) without needing any month's length.
 * - `daysAcross` / `weeksAcross`: lands in a different month, so the player
 *   has to know how many days the month they're leaving has. This is the
 *   genuinely hard skill (issue #126), so it ramps in late — short day jumps
 *   first, weeks only at the top two levels.
 */
type OffsetKind = 'daysWithin' | 'weeksWithin' | 'months' | 'daysAcross' | 'weeksAcross';

interface OffsetBand {
  kinds: readonly WeightedItem<OffsetKind>[];
  /** Whether "before" questions are asked, not just "after". */
  backward: boolean;
  dayWithin: readonly [number, number];
  dayAcross: readonly [number, number];
  weeksWithin: readonly [number, number];
  weeksAcross: readonly [number, number];
  months: readonly [number, number];
  /** Wide (2024-2028, two leap years) window instead of a single year. */
  wideYears: boolean;
}

const BASE_BAND: OffsetBand = {
  kinds: [{ value: 'daysWithin', weight: 1 }],
  backward: false,
  dayWithin: [1, 14],
  dayAcross: [2, 7],
  weeksWithin: [1, 3],
  weeksAcross: [2, 4],
  months: [1, 6],
  wideYears: false,
};

/** One band per difficulty level 1-10 — hand-tuned like `difficulty.ts`'s table. */
const OFFSET_BANDS: readonly OffsetBand[] = [
  BASE_BAND,
  BASE_BAND,
  { ...BASE_BAND, backward: true, dayWithin: [2, 14] },
  {
    ...BASE_BAND,
    backward: true,
    dayWithin: [2, 20],
    kinds: [
      { value: 'daysWithin', weight: 1 },
      { value: 'weeksWithin', weight: 1 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayWithin: [2, 20],
    kinds: [
      { value: 'daysWithin', weight: 35 },
      { value: 'weeksWithin', weight: 35 },
      { value: 'months', weight: 30 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayWithin: [2, 20],
    months: [1, 11],
    kinds: [
      { value: 'daysWithin', weight: 25 },
      { value: 'weeksWithin', weight: 25 },
      { value: 'months', weight: 30 },
      { value: 'daysAcross', weight: 20 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayAcross: [2, 10],
    months: [1, 11],
    kinds: [
      { value: 'weeksWithin', weight: 30 },
      { value: 'months', weight: 30 },
      { value: 'daysAcross', weight: 40 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayAcross: [5, 20],
    months: [2, 18],
    wideYears: true,
    kinds: [
      { value: 'weeksWithin', weight: 20 },
      { value: 'months', weight: 30 },
      { value: 'daysAcross', weight: 50 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayAcross: [8, 25],
    weeksAcross: [2, 4],
    months: [2, 18],
    wideYears: true,
    kinds: [
      { value: 'months', weight: 30 },
      { value: 'daysAcross', weight: 30 },
      { value: 'weeksAcross', weight: 40 },
    ],
  },
  {
    ...BASE_BAND,
    backward: true,
    dayAcross: [10, 25],
    weeksAcross: [2, 8],
    months: [6, 24],
    wideYears: true,
    kinds: [
      { value: 'months', weight: 25 },
      { value: 'daysAcross', weight: 25 },
      { value: 'weeksAcross', weight: 50 },
    ],
  },
];

function offsetBand(difficulty: number): OffsetBand {
  return OFFSET_BANDS[Math.min(10, Math.max(1, Math.round(difficulty))) - 1];
}

function randomMonth(rng: Rng, wideYears: boolean): { year: number; monthIndex: number } {
  const anchor = randomQuestionDate(rng, wideYears ? 'acrossYears' : 'acrossMonths');
  return { year: anchor.getFullYear(), monthIndex: anchor.getMonth() };
}

/**
 * A `days`-long jump that stays inside one month: the start day is drawn so
 * that start ± days is still a day of the same month.
 */
function planWithin(rng: Rng, band: OffsetBand, days: number, forward: boolean): Date {
  const { year, monthIndex } = randomMonth(rng, band.wideYears);
  const monthDays = getDaysInMonth(new Date(year, monthIndex, 1));
  const day = forward ? randInt(rng, 1, monthDays - days) : randInt(rng, days + 1, monthDays);
  return new Date(year, monthIndex, day);
}

/**
 * A `days`-long jump that lands in the next (or previous) month. `days` is
 * at most 28 here, so it crosses exactly one month boundary; longer jumps
 * (the top level's 5-8 weeks) just start anywhere — they can't stay put.
 */
function planAcross(rng: Rng, band: OffsetBand, days: number, forward: boolean): Date {
  const { year, monthIndex } = randomMonth(rng, band.wideYears);
  const monthDays = getDaysInMonth(new Date(year, monthIndex, 1));
  if (days > 28) return new Date(year, monthIndex, randInt(rng, 1, monthDays));
  const day = forward
    ? randInt(rng, Math.max(1, monthDays - days + 1), monthDays)
    : randInt(rng, 1, Math.min(days, monthDays));
  return new Date(year, monthIndex, day);
}

/** Chooses the start date and the jump for this difficulty's band. */
function planOffset(rng: Rng, difficulty: number): OffsetPlan {
  const band = offsetBand(difficulty);
  const kind = weightedPick(rng, band.kinds);
  const forward = band.backward ? rng() < 0.5 : true;
  switch (kind) {
    case 'daysWithin': {
      const amount = randInt(rng, ...band.dayWithin);
      return { start: planWithin(rng, band, amount, forward), unit: 'day', amount, forward };
    }
    case 'weeksWithin': {
      const amount = randInt(rng, ...band.weeksWithin);
      return { start: planWithin(rng, band, amount * 7, forward), unit: 'week', amount, forward };
    }
    case 'daysAcross': {
      const amount = randInt(rng, ...band.dayAcross);
      return { start: planAcross(rng, band, amount, forward), unit: 'day', amount, forward };
    }
    case 'weeksAcross': {
      const amount = randInt(rng, ...band.weeksAcross);
      return { start: planAcross(rng, band, amount * 7, forward), unit: 'week', amount, forward };
    }
    case 'months': {
      const { year, monthIndex } = randomMonth(rng, band.wideYears);
      // date-fns' addMonths clamps to month-end (e.g. "1 month after Aug 31"
      // becomes "Sep 30"), which a child counting forward on a calendar
      // couldn't derive. Days 1-28 exist in every month, so the start day is
      // kept there for month-unit questions and the answer is always reachable.
      const start = new Date(year, monthIndex, randInt(rng, 1, 28));
      return { start, unit: 'month', amount: randInt(rng, ...band.months), forward };
    }
  }
}

const OFFSET_LEVEL_DESCRIPTIONS: readonly string[] = [
  'Days forward, within one month',
  'Days forward, within one month',
  'Days forward or back, within one month',
  'Days or weeks, within one month',
  'Days or weeks within a month, or whole months',
  'Adds short day jumps into the next month',
  'Day jumps across a month boundary, either way',
  'Longer day jumps across months and years',
  'Adds weeks that cross a month boundary',
  'Long week jumps across several months',
];

/** Plain-English summary of what level `difficulty` asks on Monthfall Pass,
 * for the level-details comparison table (`difficultyDescribe.ts`). */
export function describeOffsetDateLevel(difficulty: number): string {
  const level = Math.min(10, Math.max(1, Math.round(difficulty)));
  return OFFSET_LEVEL_DESCRIPTIONS[level - 1];
}

/**
 * Peak 7's emphasis: "what date is three weeks after ...".
 *
 * Every candidate is a real date produced by `offsetDate`, differing from the
 * answer by the count, the unit, or the direction — the three ways a child
 * actually gets this wrong. Because they are all distinct offsets of the same
 * start date they cannot collide with the correct answer.
 */
export function generateOffsetDate(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  const plan = planOffset(rng, ctx.difficulty);
  const sign = plan.forward ? 1 : -1;
  const correctDate = offsetDate(plan.start, sign * plan.amount, plan.unit);
  const correct = formatDateLong(correctDate);
  const altUnit: DateOffsetUnit = plan.unit === 'day' ? 'week' : 'day';
  const candidates = [
    offsetDate(plan.start, sign * (plan.amount + 1), plan.unit),
    offsetDate(plan.start, sign * (plan.amount - 1), plan.unit),
    offsetDate(plan.start, -sign * plan.amount, plan.unit),
    offsetDate(plan.start, sign * (plan.amount + 2), plan.unit),
    offsetDate(plan.start, sign * plan.amount, altUnit),
    offsetDate(plan.start, sign * (plan.amount + 3), plan.unit),
    offsetDate(plan.start, sign * (plan.amount + 7), plan.unit),
  ].map((d) => ({ label: formatDateLong(d), sort: d.getTime() }));

  const label = UNIT_LABELS[plan.unit];
  const unitWord = plan.amount === 1 ? label.one : label.many;
  const direction = plan.forward ? 'after' : 'before';
  const longStart = formatDateLong(plan.start);
  return {
    id: makeQuestionId(rng, OFFSET_DATE_TYPE_ID),
    typeId: OFFSET_DATE_TYPE_ID,
    prompt: `What date is ${plan.amount} ${unitWord} ${direction} ${longStart}?`,
    display: { kind: 'none' },
    answer: buildChoiceAnswer(rng, { label: correct, sort: correctDate.getTime() }, candidates, {
      ordered: profile.orderedChoices,
    }),
    timeLimitMs: timeLimitFor(profile, OFFSET_DATE_TIME_LIMIT_MULTIPLIER),
    explainCorrect: `${plan.amount} ${unitWord} ${direction} ${longStart} is ${correct}.`,
  };
}

export const offsetDateType: QuestionType = {
  typeId: OFFSET_DATE_TYPE_ID,
  answerMode: 'choice',
  generate: generateOffsetDate,
};
