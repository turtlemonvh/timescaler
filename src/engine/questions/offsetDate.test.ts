import { describe, expect, it } from 'vitest';
import { formatDateLong } from '../dateMath';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import {
  describeOffsetDateLevel,
  generateOffsetDate,
  OFFSET_DATE_TYPE_ID,
  offsetDateType,
  OFFSET_DATE_TIME_LIMIT_MULTIPLIER,
} from './offsetDate';
import { timeLimitFor } from './support';
import { expectChoiceAnswer } from './testSupport';
import type { GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 5, peak: getPeak(7) };

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

/** Parses "November 21, 2026" back into a local-time Date. */
function parseLongDate(text: string): Date {
  const match = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  if (!match) throw new Error(`not a long-form date: ${text}`);
  const monthIndex = MONTH_NAMES.indexOf(match[1]);
  if (monthIndex < 0) throw new Error(`unknown month: ${match[1]}`);
  return new Date(Number(match[3]), monthIndex, Number(match[2]));
}

describe('generateOffsetDate', () => {
  it('asks a date-arithmetic question with no visual aid', () => {
    const q = generateOffsetDate(mulberry32(1), ctx);
    expect(q.typeId).toBe(OFFSET_DATE_TYPE_ID);
    expect(q.display.kind).toBe('none');
    expect(q.prompt.startsWith('What date is ')).toBe(true);
    expect(q.prompt.endsWith('?')).toBe(true);
  });

  it('offers four distinct long-form dates', () => {
    for (let seed = 0; seed < 100; seed++) {
      const q = generateOffsetDate(mulberry32(seed), ctx);
      const { options } = expectChoiceAnswer(q);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      for (const option of options) expect(option).toMatch(/^[A-Z][a-z]+ \d{1,2}, \d{4}$/);
    }
  });

  it('never says "1 days"', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 1 });
      expect(q.prompt).not.toMatch(/\b1 (days|weeks|months)\b/);
    }
  });

  it('keeps difficulty 1-2 questions inside a single month, moving forward', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 2 });
      const match = /^What date is (\d+) (day|days) after (.+)\?$/.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const start = parseLongDate(match[3]);
      const answer = expectChoiceAnswer(q);
      const correct = parseLongDate(answer.options[answer.correctIndex]);
      expect(correct.getMonth()).toBe(start.getMonth());
      expect(correct.getFullYear()).toBe(start.getFullYear());
    }
  });

  it('computes the correct date independently of the generator, across units and directions', () => {
    const unitPattern = '(day|days|week|weeks|month|months)';
    for (const difficulty of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      for (let seed = 0; seed < 200; seed++) {
        const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty });
        const match = new RegExp(
          `^What date is (\\d+) ${unitPattern} (after|before) (.+)\\?$`,
        ).exec(q.prompt);
        if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
        const amount = Number(match[1]);
        const unitWord = match[2];
        const direction = match[3] as 'after' | 'before';
        const start = parseLongDate(match[4]);
        const sign = direction === 'after' ? 1 : -1;
        const unit: 'day' | 'week' | 'month' = unitWord.startsWith('week')
          ? 'week'
          : unitWord.startsWith('month')
            ? 'month'
            : 'day';
        const expected =
          unit === 'day'
            ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + sign * amount)
            : unit === 'week'
              ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + sign * amount * 7)
              : new Date(start.getFullYear(), start.getMonth() + sign * amount, start.getDate());
        const answer = expectChoiceAnswer(q);
        expect(answer.options[answer.correctIndex]).toBe(formatDateLong(expected));
      }
    }
  });

  describe('difficulty ladder (issue #126)', () => {
    const PROMPT = /^What date is (\d+) (day|days|week|weeks|month|months) (after|before) (.+)\?$/;

    interface Parsed {
      unit: 'day' | 'week' | 'month';
      amount: number;
      start: Date;
      correct: Date;
    }

    function parse(difficulty: number, seed: number): Parsed {
      const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty });
      const match = PROMPT.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const answer = expectChoiceAnswer(q);
      return {
        unit: match[2].replace(/s$/, '') as Parsed['unit'],
        amount: Number(match[1]),
        start: parseLongDate(match[4]),
        correct: parseLongDate(answer.options[answer.correctIndex]),
      };
    }

    /** Months between the two dates' calendar months (0 = same month). */
    function monthsApart(a: Date, b: Date): number {
      return Math.abs(b.getFullYear() * 12 + b.getMonth() - (a.getFullYear() * 12 + a.getMonth()));
    }

    it('keeps every day and week jump inside one month through level 5', () => {
      for (const difficulty of [1, 2, 3, 4, 5]) {
        for (let seed = 0; seed < 300; seed++) {
          const { unit, start, correct } = parse(difficulty, seed);
          if (unit === 'month') continue;
          expect(monthsApart(start, correct)).toBe(0);
        }
      }
    });

    it('only asks "after" at levels 1-2', () => {
      for (const difficulty of [1, 2]) {
        for (let seed = 0; seed < 200; seed++) {
          const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty });
          expect(q.prompt).toContain(' after ');
        }
      }
    });

    it('never asks a week jump that crosses a month boundary before level 9', () => {
      for (const difficulty of [1, 2, 3, 4, 5, 6, 7, 8]) {
        for (let seed = 0; seed < 300; seed++) {
          const { unit, start, correct } = parse(difficulty, seed);
          if (unit !== 'week') continue;
          expect(monthsApart(start, correct)).toBe(0);
        }
      }
    });

    it('crosses at most one month boundary for day jumps', () => {
      for (const difficulty of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        for (let seed = 0; seed < 300; seed++) {
          const { unit, start, correct } = parse(difficulty, seed);
          if (unit !== 'day') continue;
          expect(monthsApart(start, correct)).toBeLessThanOrEqual(1);
        }
      }
    });

    it('introduces short day jumps into another month at level 6', () => {
      let crossed = 0;
      for (let seed = 0; seed < 300; seed++) {
        const { unit, amount, start, correct } = parse(6, seed);
        if (unit !== 'day' || monthsApart(start, correct) === 0) continue;
        crossed++;
        expect(amount).toBeLessThanOrEqual(7);
      }
      expect(crossed).toBeGreaterThan(0);
    });

    it('asks week jumps that cross a month boundary at levels 9 and 10', () => {
      for (const difficulty of [9, 10]) {
        let crossed = 0;
        for (let seed = 0; seed < 300; seed++) {
          const { unit, start, correct } = parse(difficulty, seed);
          if (unit === 'week' && monthsApart(start, correct) > 0) crossed++;
        }
        expect(crossed).toBeGreaterThan(0);
      }
    });

    it('describes every level', () => {
      for (let level = 1; level <= 10; level++) {
        expect(describeOffsetDateLevel(level)).toMatch(/\w/);
      }
    });
  });

  it('asks about weeks and months once the span widens', () => {
    const units = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 6 });
      const match = /^What date is \d+ (day|days|week|weeks|month|months) /.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      units.add(match[1].replace(/s$/, ''));
    }
    expect(units).toContain('week');
    expect(units).toContain('month');
  });

  it('asks "before" as well as "after" once the span widens', () => {
    const directions = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 6 });
      directions.add(q.prompt.includes(' after ') ? 'after' : 'before');
    }
    expect(directions.size).toBe(2);
  });

  it("uses the difficulty profile timer, scaled by this type's own multiplier", () => {
    for (const difficulty of [1, 5, 10]) {
      const q = generateOffsetDate(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(
        timeLimitFor(difficultyProfile(difficulty), OFFSET_DATE_TIME_LIMIT_MULTIPLIER),
      );
    }
  });

  describe('choice ordering', () => {
    it('sorts options chronologically at D1 (ordered)', () => {
      for (let seed = 0; seed < 50; seed++) {
        const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 1 });
        const { options } = expectChoiceAnswer(q);
        const keys = options.map((o) => parseLongDate(o).getTime());
        expect(keys).toEqual([...keys].sort((a, b) => a - b));
      }
    });

    it('does not always produce sorted options at D10 (shuffled)', () => {
      const anySeedUnsorted = Array.from({ length: 50 }, (_, seed) => {
        const q = generateOffsetDate(mulberry32(seed), { ...ctx, difficulty: 10 });
        const { options } = expectChoiceAnswer(q);
        const keys = options.map((o) => parseLongDate(o).getTime());
        return JSON.stringify(keys) !== JSON.stringify([...keys].sort((a, b) => a - b));
      }).some(Boolean);
      expect(anySeedUnsorted).toBe(true);
    });
  });

  it('restates the question in the explanation', () => {
    const q = generateOffsetDate(mulberry32(1), ctx);
    const answer = expectChoiceAnswer(q);
    expect(q.explainCorrect).toContain(answer.options[answer.correctIndex]);
  });

  it('is deterministic for a given seed', () => {
    expect(generateOffsetDate(mulberry32(42), ctx)).toEqual(
      generateOffsetDate(mulberry32(42), ctx),
    );
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(offsetDateType.typeId).toBe(OFFSET_DATE_TYPE_ID);
    expect(offsetDateType.generate(mulberry32(3), ctx).typeId).toBe(OFFSET_DATE_TYPE_ID);
  });
});
