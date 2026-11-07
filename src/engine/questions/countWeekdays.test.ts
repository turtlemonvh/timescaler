import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import { COUNT_WEEKDAYS_TYPE_ID, countWeekdaysType, generateCountWeekdays } from './countWeekdays';
import { timeLimitFor, WEEKDAY_NAMES } from './support';
import type { GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 8, peak: getPeak(5) };

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

const PROMPT_PATTERN = /^How many (\w+)s are in ([A-Z][a-z]+) (\d{4})\?$/;

/** How many times `weekdayIndex` occurs in `year`/`monthIndex`, computed independently. */
function countOccurrences(year: number, monthIndex: number, weekdayIndex: number): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, monthIndex, day).getDay() === weekdayIndex) count++;
  }
  return count;
}

describe('generateCountWeekdays', () => {
  it('asks a free-typed counting question over an unhighlighted month calendar', () => {
    const q = generateCountWeekdays(mulberry32(1), ctx);
    expect(q.typeId).toBe(COUNT_WEEKDAYS_TYPE_ID);
    expect(q.display.kind).toBe('calendar');
    if (q.display.kind !== 'calendar') return;
    expect(q.display.highlightDay).toBeUndefined();
    expect(q.answer.kind).toBe('number');
    expect(q.prompt.startsWith('How many ')).toBe(true);
  });

  it('declares a count between 4 and 5 (every weekday occurs 4 or 5 times a month)', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateCountWeekdays(mulberry32(seed), ctx);
      expect(q.answer.kind).toBe('number');
      if (q.answer.kind !== 'number') continue;
      expect(q.answer.target).toBeGreaterThanOrEqual(4);
      expect(q.answer.target).toBeLessThanOrEqual(5);
    }
  });

  it('computes the count independently of the generator, by scanning the month', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateCountWeekdays(mulberry32(seed), ctx);
      const match = PROMPT_PATTERN.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const [, weekdayText, monthText, yearText] = match;
      const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayText);
      const monthIndex = MONTH_NAMES.indexOf(monthText);
      const year = Number(yearText);
      // The calendar shown must be the month the prompt names.
      expect(q.display).toEqual({ kind: 'calendar', year, monthIndex });
      const expected = countOccurrences(year, monthIndex, weekdayIndex);
      expect(q.answer.kind).toBe('number');
      if (q.answer.kind !== 'number') continue;
      expect(q.answer.target).toBe(expected);
    }
  });

  it("uses the difficulty profile timer, scaled by this type's own multiplier", () => {
    for (const difficulty of [1, 5, 10]) {
      const q = generateCountWeekdays(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(timeLimitFor(difficultyProfile(difficulty), 1.4));
    }
  });

  it('restates the count in the explanation', () => {
    const q = generateCountWeekdays(mulberry32(1), ctx);
    expect(q.answer.kind).toBe('number');
    if (q.answer.kind !== 'number') return;
    expect(q.explainCorrect).toContain(String(q.answer.target));
  });

  it('is deterministic for a given seed', () => {
    expect(generateCountWeekdays(mulberry32(42), ctx)).toEqual(
      generateCountWeekdays(mulberry32(42), ctx),
    );
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(countWeekdaysType.typeId).toBe(COUNT_WEEKDAYS_TYPE_ID);
    expect(countWeekdaysType.answerMode).toBe('free');
    expect(countWeekdaysType.generate(mulberry32(3), ctx).typeId).toBe(COUNT_WEEKDAYS_TYPE_ID);
  });
});
