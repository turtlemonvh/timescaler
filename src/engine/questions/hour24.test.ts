import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import { to24Hour } from '../timeMath';
import {
  describeHour24Level,
  generateHour24,
  HOUR24_ORDER_TIME_LIMIT_MULTIPLIER,
  HOUR24_TIME_LIMIT_MULTIPLIER,
  HOUR24_TYPE_ID,
  hour24Type,
} from './hour24';
import { timeLimitFor } from './support';
import { expectChoiceAnswer } from './testSupport';
import type { GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 8, peak: getPeak(8) };
/** Below level 6 every question is a conversion — no ordering variant. */
const conversionCtx: GeneratorContext = { ...ctx, difficulty: 5 };

const TO_24_PATTERN = /^What is (\d{1,2}):(\d{2}) (AM|PM) in 24-hour time\?$/;
const TO_12_PATTERN = /^What is (\d{2}):(\d{2}) in 12-hour time\?$/;

describe('generateHour24', () => {
  it('asks a notation-conversion question with no visual aid', () => {
    const q = generateHour24(mulberry32(1), ctx);
    expect(q.typeId).toBe(HOUR24_TYPE_ID);
    expect(q.display.kind).toBe('none');
    expect(q.prompt.startsWith('What is ')).toBe(true);
  });

  it('offers four distinct options, all in the same notation as the answer', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateHour24(mulberry32(seed), conversionCtx);
      const { options } = expectChoiceAnswer(q);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      const to24 = TO_24_PATTERN.test(q.prompt);
      for (const option of options) {
        if (to24) {
          expect(option).toMatch(/^\d{2}:\d{2}$/);
        } else {
          expect(option).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
        }
      }
    }
  });

  it('produces both conversion directions across enough draws', () => {
    const directions = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const q = generateHour24(mulberry32(seed), conversionCtx);
      directions.add(q.prompt.includes('24-hour') ? 'to24' : 'to12');
    }
    expect(directions.size).toBe(2);
  });

  it('computes the correct conversion independently of the generator, both directions', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateHour24(mulberry32(seed), conversionCtx);
      const answer = expectChoiceAnswer(q);
      const declared = answer.options[answer.correctIndex];
      const to24Match = TO_24_PATTERN.exec(q.prompt);
      const to12Match = TO_12_PATTERN.exec(q.prompt);
      if (to24Match) {
        const [, hourText, minuteText, period] = to24Match;
        const hour24 = to24Hour(Number(hourText), period === 'PM');
        expect(declared).toBe(`${String(hour24).padStart(2, '0')}:${minuteText}`);
        continue;
      }
      if (to12Match) {
        const [, hourText, minuteText] = to12Match;
        const hour24 = Number(hourText);
        const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
        const period = hour24 < 12 ? 'AM' : 'PM';
        expect(declared).toBe(`${hour12}:${minuteText} ${period}`);
        continue;
      }
      throw new Error(`unexpected prompt: ${q.prompt}`);
    }
  });

  it('uses the plain difficulty-profile timer for a conversion', () => {
    for (const difficulty of [1, 5]) {
      const q = generateHour24(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(
        timeLimitFor(difficultyProfile(difficulty), HOUR24_TIME_LIMIT_MULTIPLIER),
      );
    }
    expect(HOUR24_TIME_LIMIT_MULTIPLIER).toBe(1);
  });

  it("puts a good share of level 4+ conversions in the 12 o'clock hours", () => {
    let edge = 0;
    for (let seed = 0; seed < 300; seed++) {
      const q = generateHour24(mulberry32(seed), conversionCtx);
      if (/^What is (12:\d{2} (AM|PM)|00:\d{2}|12:\d{2}) in/.test(q.prompt)) edge++;
    }
    // ~35% forced plus the ~1/12 that land there anyway.
    expect(edge / 300).toBeGreaterThan(0.25);
  });

  describe('ordering variant (level 6+)', () => {
    const ORDER_PATTERN = /^Which time comes (earliest|latest) in the day\?$/;

    function minutesOfDay(label: string): number {
      const twelve = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
      if (twelve) return to24Hour(Number(twelve[1]), twelve[3] === 'PM') * 60 + Number(twelve[2]);
      const [hh, mm] = label.split(':').map(Number);
      return hh * 60 + mm;
    }

    it('never appears below level 6', () => {
      for (const difficulty of [1, 3, 5]) {
        for (let seed = 0; seed < 200; seed++) {
          const q = generateHour24(mulberry32(seed), { ...ctx, difficulty });
          expect(q.prompt).not.toMatch(ORDER_PATTERN);
        }
      }
    });

    it('appears at levels 6 and 8, more often at 8', () => {
      const count = (difficulty: number) =>
        Array.from({ length: 400 }, (_, seed) =>
          ORDER_PATTERN.test(generateHour24(mulberry32(seed), { ...ctx, difficulty }).prompt),
        ).filter(Boolean).length;
      const at6 = count(6);
      const at8 = count(8);
      expect(at6).toBeGreaterThan(0);
      expect(at8).toBeGreaterThan(at6);
    });

    it('mixes two 12-hour and two 24-hour times, and marks the true earliest/latest', () => {
      let checked = 0;
      for (let seed = 0; seed < 300; seed++) {
        const q = generateHour24(mulberry32(seed), ctx);
        const match = ORDER_PATTERN.exec(q.prompt);
        if (!match) continue;
        checked++;
        const { options, correctIndex } = expectChoiceAnswer(q);
        expect(options.filter((o) => / (AM|PM)$/.test(o))).toHaveLength(2);
        expect(options.filter((o) => /^\d{2}:\d{2}$/.test(o))).toHaveLength(2);
        const values = options.map(minutesOfDay);
        expect(new Set(values).size).toBe(4);
        const target = match[1] === 'earliest' ? Math.min(...values) : Math.max(...values);
        expect(values[correctIndex]).toBe(target);
        expect(q.timeLimitMs).toBe(
          timeLimitFor(difficultyProfile(8), HOUR24_ORDER_TIME_LIMIT_MULTIPLIER),
        );
        expect(q.explainCorrect).toContain(options[correctIndex]);
      }
      expect(checked).toBeGreaterThan(50);
    });
  });

  it('describes every level', () => {
    for (let level = 1; level <= 10; level++) {
      expect(describeHour24Level(level)).toMatch(/\w/);
    }
  });

  it('restates the question in the explanation', () => {
    const q = generateHour24(mulberry32(1), ctx);
    const answer = expectChoiceAnswer(q);
    expect(q.explainCorrect).toContain(answer.options[answer.correctIndex]);
  });

  it('is deterministic for a given seed', () => {
    expect(generateHour24(mulberry32(42), ctx)).toEqual(generateHour24(mulberry32(42), ctx));
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(hour24Type.typeId).toBe(HOUR24_TYPE_ID);
    expect(hour24Type.answerMode).toBe('choice');
    expect(hour24Type.generate(mulberry32(3), ctx).typeId).toBe(HOUR24_TYPE_ID);
  });
});
