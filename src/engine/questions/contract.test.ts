import { differenceInCalendarDays } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { PEAKS } from '../peaks';
import { mulberry32 } from '../rng';
import { describeTime, to24Hour } from '../timeMath';
import {
  BUILT_IN_QUESTION_TYPES,
  COUNT_BETWEEN_TYPE_ID,
  COUNT_WEEKDAYS_TYPE_ID,
  DAY_OF_WEEK_TYPE_ID,
  DESCRIBE_TIME_TYPE_ID,
  ELAPSED_ADD_TYPE_ID,
  ELAPSED_BETWEEN_TYPE_ID,
  generateQuestion,
  HOUR24_TYPE_ID,
  isCorrectChoice,
  isCorrectNumber,
  isCorrectPickDate,
  isCorrectSetHands,
  NTH_WEEKDAY_TYPE_ID,
  OFFSET_DATE_TYPE_ID,
  READ_ANALOG_TYPE_ID,
  READ_CALENDAR_TYPE_ID,
  SET_HANDS_TYPE_ID,
  type AnswerSpec,
  type DisplaySpec,
  type Question,
} from './index';
import { formatClockFace, OPTION_COUNT, timeLimitFor, WEEKDAY_NAMES, weekdayName } from './support';

const SEED_COUNT = 200;
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Each generator's own `TIME_LIMIT_MULTIPLIER` constant, mirrored here so
 * this test can independently verify `timeLimitMs` rather than trusting the
 * generator's own arithmetic. Extend this alongside
 * `assertDeclaredAnswerMatchesDisplay`'s switch and the `covered` list
 * below whenever a new generator is added.
 */
const TIME_LIMIT_MULTIPLIERS: Record<string, number> = {
  [READ_ANALOG_TYPE_ID]: 1,
  [DESCRIBE_TIME_TYPE_ID]: 1,
  [READ_CALENDAR_TYPE_ID]: 1.15,
  [OFFSET_DATE_TYPE_ID]: 1.4,
  [ELAPSED_ADD_TYPE_ID]: 1.2,
  [ELAPSED_BETWEEN_TYPE_ID]: 1.3,
  [SET_HANDS_TYPE_ID]: 1.3,
  [DAY_OF_WEEK_TYPE_ID]: 1.1,
  [NTH_WEEKDAY_TYPE_ID]: 1.5,
  [COUNT_WEEKDAYS_TYPE_ID]: 1.4,
  [HOUR24_TYPE_ID]: 1.0,
  [COUNT_BETWEEN_TYPE_ID]: 1.5,
};

function isHour24Ordering(q: Question): boolean {
  return q.typeId === HOUR24_TYPE_ID && q.prompt.startsWith('Which time comes ');
}

/** Minutes since midnight for "1:05 PM" or "13:05" — parsed here, not via the generator. */
function minutesOfDay(label: string): number {
  const twelve = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (twelve) {
    return to24Hour(Number(twelve[1]), twelve[3] === 'PM') * 60 + Number(twelve[2]);
  }
  const twentyFour = /^(\d{2}):(\d{2})$/.exec(label);
  if (twentyFour) return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);
  throw new Error(`not a clock time: ${label}`);
}

/** Distinct, reproducible seed per (difficulty, index) pair. */
function seedFor(difficulty: number, index: number): number {
  return difficulty * 104_729 + index * 7919 + 1;
}

function assertDisplayWellFormed(display: DisplaySpec): void {
  switch (display.kind) {
    case 'analogClock': {
      const { hour, minute, second } = display.time;
      for (const value of [hour, minute, second]) expect(Number.isInteger(value)).toBe(true);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);
      expect(second).toBeGreaterThanOrEqual(0);
      expect(second).toBeLessThanOrEqual(59);
      if (!display.showSeconds) expect(second).toBe(0);
      return;
    }
    case 'calendar': {
      expect(Number.isInteger(display.year)).toBe(true);
      expect(display.monthIndex).toBeGreaterThanOrEqual(0);
      expect(display.monthIndex).toBeLessThanOrEqual(11);
      // The highlighted day must exist in the highlighted month.
      const date = new Date(display.year, display.monthIndex, display.highlightDay);
      expect(date.getFullYear()).toBe(display.year);
      expect(date.getMonth()).toBe(display.monthIndex);
      expect(date.getDate()).toBe(display.highlightDay);
      return;
    }
    case 'none':
      return;
  }
}

function assertAnswerGrades(spec: AnswerSpec): void {
  switch (spec.kind) {
    case 'choice': {
      const answer = spec;
      expect(answer.options).toHaveLength(OPTION_COUNT);
      for (const option of answer.options) {
        expect(typeof option).toBe('string');
        expect(option.trim().length).toBeGreaterThan(0);
      }
      // No duplicate option text: a duplicate means a "wrong" answer that is
      // word-for-word identical to the right one.
      expect(new Set(answer.options).size).toBe(OPTION_COUNT);
      expect(Number.isInteger(answer.correctIndex)).toBe(true);
      expect(answer.correctIndex).toBeGreaterThanOrEqual(0);
      expect(answer.correctIndex).toBeLessThan(OPTION_COUNT);

      // The declared correct answer validates true...
      expect(isCorrectChoice(answer, answer.correctIndex)).toBe(true);
      // ...and every distractor validates false.
      for (let i = 0; i < answer.options.length; i++) {
        if (i === answer.correctIndex) continue;
        expect(isCorrectChoice(answer, i)).toBe(false);
        expect(answer.options[i]).not.toBe(answer.options[answer.correctIndex]);
      }
      return;
    }
    case 'number': {
      expect(Number.isInteger(spec.target)).toBe(true);
      expect(isCorrectNumber(spec, spec.target)).toBe(true);
      expect(isCorrectNumber(spec, spec.target + 1)).toBe(false);
      expect(isCorrectNumber(spec, spec.target - 1)).toBe(false);
      return;
    }
    case 'setHands': {
      const { hour, minute, second } = spec.target;
      expect(Number.isInteger(hour)).toBe(true);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
      expect(Number.isInteger(minute)).toBe(true);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);
      // No draggable second hand — grading ignores seconds, and the
      // generator never sets a nonzero one (see setHands.ts).
      expect(second).toBe(0);
      expect(spec.precision).not.toBe('second');

      expect(isCorrectSetHands(spec, spec.target)).toBe(true);
      expect(isCorrectSetHands(spec, { ...spec.target, minute: (minute + 1) % 60 })).toBe(false);
      expect(isCorrectSetHands(spec, { ...spec.target, hour: (hour + 1) % 24 })).toBe(false);
      return;
    }
    case 'pickDate': {
      expect(Number.isInteger(spec.year)).toBe(true);
      expect(spec.monthIndex).toBeGreaterThanOrEqual(0);
      expect(spec.monthIndex).toBeLessThanOrEqual(11);
      // The declared day must exist in the declared month.
      const date = new Date(spec.year, spec.monthIndex, spec.day);
      expect(date.getFullYear()).toBe(spec.year);
      expect(date.getMonth()).toBe(spec.monthIndex);
      expect(date.getDate()).toBe(spec.day);

      expect(isCorrectPickDate(spec, spec)).toBe(true);
      expect(isCorrectPickDate(spec, { ...spec, day: spec.day === 1 ? 2 : spec.day - 1 })).toBe(
        false,
      );
      return;
    }
  }
}

/**
 * Re-derives the right answer from the question's own display, independently of
 * whatever the generator believed. This is the assertion that actually catches
 * "the game marked her right answer wrong".
 */
function assertDeclaredAnswerMatchesDisplay(q: Question): void {
  // A typeId whose answer isn't choice-kind (elapsedBetween's, countWeekdays'
  // and countBetween's `number`, setHands' own `setHands`, nthWeekday's
  // `pickDate`) handles its own re-derivation here, since
  // `declared`/`answer.options` below don't apply to those kinds.
  if (q.typeId === SET_HANDS_TYPE_ID) {
    expect(q.answer.kind).toBe('setHands');
    if (q.answer.kind !== 'setHands') return;
    expect(q.display.kind).toBe('none');
    // Re-derive the target straight from the prompt's own clock-face label
    // — only the 12-hour half-day position is recoverable (no AM/PM on a
    // bare clock face), same limitation `readAnalog`'s cross-check works
    // around by disallowing AM/PM in its options entirely.
    const match = q.prompt.match(/^Set the clock to (\d{1,2}):(\d{2})\.$/);
    expect(match).not.toBeNull();
    if (!match) return;
    const [, hourText, minuteText] = match;
    const targetHour12 = q.answer.target.hour % 12 === 0 ? 12 : q.answer.target.hour % 12;
    expect(Number(hourText)).toBe(targetHour12);
    expect(Number(minuteText)).toBe(q.answer.target.minute);
    return;
  }
  if (q.typeId === NTH_WEEKDAY_TYPE_ID) {
    expect(q.answer.kind).toBe('pickDate');
    if (q.answer.kind !== 'pickDate') return;
    expect(q.display.kind).toBe('none');
    // Re-derive by brute-force scanning the stated month for the stated
    // weekday, independent of the generator's own `nthWeekdayOfMonth` —
    // this is the check that actually catches "the picker's target isn't
    // really the Nth Tuesday it claims to be".
    const match = q.prompt.match(
      /^What is the (1st|2nd|3rd|4th|last) ([A-Z][a-z]+) of ([A-Z][a-z]+) (\d{4})\?$/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const [, ordinalText, weekdayText, monthText, yearText] = match;
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayText);
    expect(weekdayIndex).toBeGreaterThanOrEqual(0);
    const monthIndex = MONTH_NAMES.indexOf(monthText);
    expect(monthIndex).toBeGreaterThanOrEqual(0);
    const year = Number(yearText);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const matches: Date[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const candidate = new Date(year, monthIndex, day);
      if (candidate.getDay() === weekdayIndex) matches.push(candidate);
    }
    const expected =
      ordinalText === 'last' ? matches[matches.length - 1] : matches[Number(ordinalText[0]) - 1];
    expect(expected).toBeDefined();
    if (!expected) return;
    expect(q.answer.year).toBe(expected.getFullYear());
    expect(q.answer.monthIndex).toBe(expected.getMonth());
    expect(q.answer.day).toBe(expected.getDate());
    return;
  }
  if (q.typeId === COUNT_BETWEEN_TYPE_ID) {
    expect(q.answer.kind).toBe('number');
    if (q.answer.kind !== 'number') return;
    expect(q.display.kind).toBe('none');
    // Re-derive via date-fns' own `differenceInCalendarDays` — a
    // well-tested library primitive, not the generator's own arithmetic —
    // applied to the two long-form dates parsed straight from the prompt.
    const match = q.prompt.match(
      /^How many days are there from ([A-Z][a-z]+) (\d{1,2}), (\d{4}) to ([A-Z][a-z]+) (\d{1,2}), (\d{4})\?$/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = match;
    const start = new Date(Number(startYear), MONTH_NAMES.indexOf(startMonth), Number(startDay));
    const end = new Date(Number(endYear), MONTH_NAMES.indexOf(endMonth), Number(endDay));
    expect(q.answer.target).toBe(differenceInCalendarDays(end, start));
    return;
  }
  if (q.typeId === COUNT_WEEKDAYS_TYPE_ID) {
    expect(q.answer.kind).toBe('number');
    if (q.answer.kind !== 'number') return;
    expect(q.display.kind).toBe('none');
    // Re-derive by brute-force scanning the stated month for the stated
    // weekday, independent of the generator's own `weekdayOccurrencesInMonth`.
    const match = q.prompt.match(/^How many (\w+)s are in ([A-Z][a-z]+) (\d{4})\?$/);
    expect(match).not.toBeNull();
    if (!match) return;
    const [, weekdayText, monthText, yearText] = match;
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayText);
    expect(weekdayIndex).toBeGreaterThanOrEqual(0);
    const monthIndex = MONTH_NAMES.indexOf(monthText);
    expect(monthIndex).toBeGreaterThanOrEqual(0);
    const year = Number(yearText);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (new Date(year, monthIndex, day).getDay() === weekdayIndex) count++;
    }
    expect(q.answer.target).toBe(count);
    return;
  }
  if (q.typeId === ELAPSED_BETWEEN_TYPE_ID) {
    expect(q.answer.kind).toBe('number');
    if (q.answer.kind !== 'number') return;
    expect(q.display.kind).toBe('none');
    // Re-derive the elapsed minutes straight from the prompt's two 12-hour,
    // no-AM/PM clock-face labels via mod-720 (half-day) arithmetic — since
    // the generator guarantees the true elapsed span is under 720 minutes,
    // this recovers the unique correct value with no AM/PM to disambiguate.
    const match = q.prompt.match(
      /^It's (\d{1,2}):(\d{2})\. It becomes (\d{1,2}):(\d{2})\. How many minutes have passed\?$/,
    );
    expect(match).not.toBeNull();
    if (!match) return;
    const [, startHour, startMin, endHour, endMin] = match;
    const startOfHalfDay = (Number(startHour) % 12) * 60 + Number(startMin);
    const endOfHalfDay = (Number(endHour) % 12) * 60 + Number(endMin);
    const elapsed = (((endOfHalfDay - startOfHalfDay) % 720) + 720) % 720;
    expect(q.answer.target).toBe(elapsed);
    return;
  }
  if (q.answer.kind !== 'choice') return;
  const answer = q.answer;
  const declared = answer.options[answer.correctIndex];
  switch (q.typeId) {
    case READ_ANALOG_TYPE_ID: {
      expect(q.display.kind).toBe('analogClock');
      if (q.display.kind !== 'analogClock') return;
      expect(declared).toBe(formatClockFace(q.display.time, q.display.showSeconds));
      // A clock face cannot show AM/PM, so no option may claim it.
      for (const option of answer.options) expect(option).not.toMatch(/AM|PM/);
      return;
    }
    case DESCRIBE_TIME_TYPE_ID: {
      expect(q.display.kind).toBe('analogClock');
      if (q.display.kind !== 'analogClock') return;
      expect(declared).toBe(describeTime(q.display.time));
      return;
    }
    case READ_CALENDAR_TYPE_ID: {
      expect(q.display.kind).toBe('calendar');
      if (q.display.kind !== 'calendar') return;
      const date = new Date(q.display.year, q.display.monthIndex, q.display.highlightDay);
      expect(declared).toBe(weekdayName(date));
      return;
    }
    case OFFSET_DATE_TYPE_ID: {
      // No display to re-derive from; offsetDate.test.ts re-computes the
      // arithmetic straight from the prompt instead.
      expect(q.display.kind).toBe('none');
      expect(declared).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
      return;
    }
    case ELAPSED_ADD_TYPE_ID: {
      // No display to re-derive from, same as offsetDate; elapsedAdd.test.ts
      // re-computes the arithmetic straight from the prompt instead.
      expect(q.display.kind).toBe('none');
      expect(declared).toMatch(/^\d{1,2}:\d{2}$/);
      return;
    }
    case DAY_OF_WEEK_TYPE_ID: {
      // No display to re-derive from; dayOfWeek.test.ts re-computes the
      // mod-7 arithmetic straight from the prompt instead.
      expect(q.display.kind).toBe('none');
      expect(WEEKDAY_NAMES).toContain(declared);
      return;
    }
    case HOUR24_TYPE_ID: {
      expect(q.display.kind).toBe('none');
      // Re-derive the conversion straight from the prompt's given time,
      // independent of the generator — using `to24Hour`, a small standalone
      // utility, not the generator's own formatting logic.
      const orderMatch = /^Which time comes (earliest|latest) in the day\?$/.exec(q.prompt);
      if (orderMatch) {
        // Every option converted to minutes since midnight independently;
        // the declared answer must be the unique min (or max).
        expect(q.answer.kind).toBe('choice');
        if (q.answer.kind !== 'choice') return;
        const values = q.answer.options.map(minutesOfDay);
        expect(new Set(values).size).toBe(values.length);
        const target = orderMatch[1] === 'earliest' ? Math.min(...values) : Math.max(...values);
        expect(minutesOfDay(declared)).toBe(target);
        return;
      }
      const to24Match = q.prompt.match(/^What is (\d{1,2}):(\d{2}) (AM|PM) in 24-hour time\?$/);
      const to12Match = q.prompt.match(/^What is (\d{2}):(\d{2}) in 12-hour time\?$/);
      if (to24Match) {
        const [, hourText, minuteText, period] = to24Match;
        const hour24 = to24Hour(Number(hourText), period === 'PM');
        expect(declared).toBe(`${String(hour24).padStart(2, '0')}:${minuteText}`);
        return;
      }
      if (to12Match) {
        const [, hourText, minuteText] = to12Match;
        const hour24 = Number(hourText);
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const period = hour24 < 12 ? 'AM' : 'PM';
        expect(declared).toBe(`${hour12}:${minuteText} ${period}`);
        return;
      }
      throw new Error(`unexpected hour24 prompt: ${q.prompt}`);
    }
    default:
      throw new Error(
        `contract test has no cross-check for typeId "${q.typeId}" — add one when adding a type`,
      );
  }
}

function assertWellFormed(q: Question, typeId: string, difficulty: number): void {
  expect(q.typeId).toBe(typeId);
  expect(q.id.startsWith(`${typeId}-`)).toBe(true);
  expect(q.id.length).toBeGreaterThan(typeId.length + 1);
  expect(q.prompt.trim().length).toBeGreaterThan(0);
  expect(q.explainCorrect.trim().length).toBeGreaterThan(0);

  // The time limit is sane: a whole number of ms, exactly the difficulty
  // table's base timer scaled by this type's own multiplier, and inside a
  // band a child can actually work within.
  expect(Number.isInteger(q.timeLimitMs)).toBe(true);
  // hour24's "which time comes first/last" variant converts four times at
  // once and gets more headroom than a single conversion.
  const multiplier = isHour24Ordering(q) ? 1.4 : (TIME_LIMIT_MULTIPLIERS[typeId] ?? 1);
  expect(q.timeLimitMs).toBe(timeLimitFor(difficultyProfile(difficulty), multiplier));
  expect(q.timeLimitMs).toBeGreaterThanOrEqual(5_000);
  expect(q.timeLimitMs).toBeLessThanOrEqual(45_000);

  assertDisplayWellFormed(q.display);
  assertAnswerGrades(q.answer);
  assertDeclaredAnswerMatchesDisplay(q);
}

describe('generator contract', () => {
  for (const type of BUILT_IN_QUESTION_TYPES) {
    describe(type.typeId, () => {
      for (const difficulty of DIFFICULTIES) {
        it(`is well formed at difficulty ${difficulty} over ${SEED_COUNT} seeds`, () => {
          for (let index = 0; index < SEED_COUNT; index++) {
            const rng = mulberry32(seedFor(difficulty, index));
            const peak = PEAKS[index % PEAKS.length];
            assertWellFormed(type.generate(rng, { difficulty, peak }), type.typeId, difficulty);
          }
        });
      }
    });
  }

  describe('registry selection', () => {
    for (const difficulty of DIFFICULTIES) {
      it(`produces well-formed questions at difficulty ${difficulty}`, () => {
        const rng = mulberry32(seedFor(difficulty, 999));
        for (let index = 0; index < SEED_COUNT; index++) {
          const peak = PEAKS[index % PEAKS.length];
          const q = generateQuestion(rng, { difficulty, peak });
          assertWellFormed(q, q.typeId, difficulty);
        }
      });
    }
  });

  it('has a cross-check for every registered type', () => {
    const covered = [
      READ_ANALOG_TYPE_ID,
      DESCRIBE_TIME_TYPE_ID,
      READ_CALENDAR_TYPE_ID,
      OFFSET_DATE_TYPE_ID,
      ELAPSED_ADD_TYPE_ID,
      ELAPSED_BETWEEN_TYPE_ID,
      SET_HANDS_TYPE_ID,
      DAY_OF_WEEK_TYPE_ID,
      NTH_WEEKDAY_TYPE_ID,
      COUNT_WEEKDAYS_TYPE_ID,
      HOUR24_TYPE_ID,
      COUNT_BETWEEN_TYPE_ID,
    ];
    for (const type of BUILT_IN_QUESTION_TYPES) {
      expect(covered).toContain(type.typeId);
    }
  });

  it('has a declared time-limit multiplier for every registered type', () => {
    for (const type of BUILT_IN_QUESTION_TYPES) {
      expect(Object.keys(TIME_LIMIT_MULTIPLIERS)).toContain(type.typeId);
    }
  });
});
