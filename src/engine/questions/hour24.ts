import { difficultyProfile, type DifficultyProfile } from '../difficulty';
import { pick, randInt, shuffle, type Rng } from '../rng';
import {
  formatTime12,
  formatTime24,
  randomTime,
  type TimeOfDay,
  type TimePrecision,
} from '../timeMath';
import {
  buildChoiceAnswer,
  distractorTimes,
  OPTION_COUNT,
  makeQuestionId,
  pickPrecision,
  shiftTime,
  timeLimitFor,
} from './support';
import type { GeneratorContext, Question, QuestionType } from './types';

export const HOUR24_TYPE_ID = 'hour24';

/**
 * A single conversion is quick once learned — The Meridian was too easy with
 * extra time on top (issue #126), so it gets the plain profile timer. The
 * ordering variant converts four times at once and keeps more headroom.
 */
export const HOUR24_TIME_LIMIT_MULTIPLIER = 1.0;
export const HOUR24_ORDER_TIME_LIMIT_MULTIPLIER = 1.4;

/** From level 4, this share of conversions lands in the 12 o'clock hours —
 * 12 AM is 00:xx and 12 PM is 12:xx, the two that trip people up most. */
const EDGE_HOUR_SHARE = 0.35;
const EDGE_HOUR_FROM_LEVEL = 4;

/** Share of questions that are "which time comes first/last", by level. */
function orderShare(level: number): number {
  if (level >= 8) return 0.5;
  if (level >= 6) return 0.35;
  return 0;
}

const HOUR24_LEVEL_DESCRIPTIONS: readonly string[] = [
  'Convert between 12-hour and 24-hour time',
  'Convert between 12-hour and 24-hour time',
  'Convert between 12-hour and 24-hour time',
  'Convert, often around noon and midnight',
  'Convert, often around noon and midnight',
  'Adds putting mixed 12/24-hour times in order',
  'Adds putting mixed 12/24-hour times in order',
  'Half conversions, half ordering mixed times',
  'Half conversions, half ordering mixed times',
  'Half conversions, half ordering mixed times',
];

/** Plain-English summary of what level `difficulty` asks on The Meridian,
 * for the level-details comparison table (`difficultyDescribe.ts`). */
export function describeHour24Level(difficulty: number): string {
  return HOUR24_LEVEL_DESCRIPTIONS[Math.min(10, Math.max(1, Math.round(difficulty))) - 1];
}

/** Like `pickPrecision`, but never `'second'` — converting notations gains
 * nothing from second-level precision, and it'd just add visual noise. */
function pickConversionPrecision(rng: Rng, profile: DifficultyProfile): TimePrecision {
  const precision = pickPrecision(rng, profile);
  return precision === 'second' ? 'minute' : precision;
}

const SECONDS_PER_HALF_DAY = 12 * 3600;

function sortKey(t: TimeOfDay): number {
  return t.hour * 3600 + t.minute * 60 + t.second;
}

/**
 * The classic conversion question. The classic mistake — forgetting to
 * add/subtract 12 hours, i.e. mixing up the two halves of the day — is
 * folded into the distractor pool directly via a ±12h shift of the target,
 * alongside the usual off-by-a-bit misreadings `distractorTimes` already
 * covers for other clock-reading types.
 */
function generateConversion(rng: Rng, profile: DifficultyProfile): Question {
  const precision = pickConversionPrecision(rng, profile);
  let time = randomTime(rng, precision);
  if (profile.level >= EDGE_HOUR_FROM_LEVEL && rng() < EDGE_HOUR_SHARE) {
    time = { ...time, hour: rng() < 0.5 ? 0 : 12 };
  }
  const to24 = rng() < 0.5;
  const format = to24 ? formatTime24 : formatTime12;
  const given = to24 ? formatTime12(time) : formatTime24(time);
  const correct = format(time);
  const rawCandidates = [
    ...distractorTimes(time, precision),
    shiftTime(time, SECONDS_PER_HALF_DAY),
    shiftTime(time, -SECONDS_PER_HALF_DAY),
  ];
  const candidates = rawCandidates.map((t) => ({ label: format(t), sort: sortKey(t) }));
  const prompt = to24 ? `What is ${given} in 24-hour time?` : `What is ${given} in 12-hour time?`;
  return {
    id: makeQuestionId(rng, HOUR24_TYPE_ID),
    typeId: HOUR24_TYPE_ID,
    prompt,
    display: { kind: 'none' },
    answer: buildChoiceAnswer(rng, { label: correct, sort: sortKey(time) }, candidates, {
      ordered: profile.orderedChoices,
    }),
    timeLimitMs: timeLimitFor(profile, HOUR24_TIME_LIMIT_MULTIPLIER),
    explainCorrect: `${given} is ${correct}.`,
  };
}

/**
 * Windows (in minutes since midnight) the ordering variant draws its four
 * times from: around noon, where 11:50 AM / 12:10 PM / 13:05 interleave, the
 * small hours, where 12:xx AM is 00:xx and comes first, and the evening.
 */
const ORDER_WINDOWS: readonly (readonly [number, number])[] = [
  [9 * 60, 15 * 60],
  [0, 4 * 60],
  [18 * 60, 24 * 60],
];

const PRECISION_STEP_MINUTES: Record<TimePrecision, number> = {
  hour: 60,
  half: 30,
  quarter: 15,
  five: 5,
  minute: 1,
  second: 1,
};

/**
 * "Which time comes earliest/latest in the day?" over four times, two in
 * 12-hour and two in 24-hour notation, all within a few hours of each other
 * — the player has to convert to compare. Never shown in sorted order: that
 * would give the answer away.
 */
function generateOrdering(rng: Rng, profile: DifficultyProfile): Question {
  const precision = pickConversionPrecision(rng, profile);
  const step = Math.max(5, PRECISION_STEP_MINUTES[precision]);
  const [from, to] = pick(rng, ORDER_WINDOWS);
  const minutes = new Set<number>();
  while (minutes.size < OPTION_COUNT) {
    minutes.add(from + randInt(rng, 0, (to - from) / step - 1) * step);
  }
  const formats = shuffle(rng, [formatTime12, formatTime12, formatTime24, formatTime24]);
  const pool = [...minutes].map((m, i) => {
    const time: TimeOfDay = { hour: Math.floor(m / 60), minute: m % 60, second: 0 };
    return { time, label: formats[i](time), sort: m };
  });
  const earliest = rng() < 0.5;
  const sorted = [...pool].sort((a, b) => a.sort - b.sort);
  const correct = earliest ? sorted[0] : sorted[sorted.length - 1];
  const others = pool.filter((c) => c !== correct);
  const restated = correct.label.includes('M')
    ? formatTime24(correct.time)
    : formatTime12(correct.time);
  const which = earliest ? 'earliest' : 'latest';
  return {
    id: makeQuestionId(rng, HOUR24_TYPE_ID),
    typeId: HOUR24_TYPE_ID,
    prompt: `Which time comes ${which} in the day?`,
    display: { kind: 'none' },
    answer: buildChoiceAnswer(rng, correct, others, { ordered: false }),
    timeLimitMs: timeLimitFor(profile, HOUR24_ORDER_TIME_LIMIT_MULTIPLIER),
    explainCorrect: `${correct.label} is ${restated} — the ${which} of these.`,
  };
}

/**
 * Peak 8's emphasis: 12-hour (AM/PM) vs 24-hour notation. Every level asks
 * conversions in both directions; from level 4 a third of them sit in the
 * 12 o'clock hours, and from level 6 some questions instead mix both
 * notations in one list and ask which time comes first or last.
 */
export function generateHour24(rng: Rng, ctx: GeneratorContext): Question {
  const profile = difficultyProfile(ctx.difficulty);
  return rng() < orderShare(profile.level)
    ? generateOrdering(rng, profile)
    : generateConversion(rng, profile);
}

export const hour24Type: QuestionType = {
  typeId: HOUR24_TYPE_ID,
  answerMode: 'choice',
  generate: generateHour24,
};
