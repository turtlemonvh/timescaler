import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import {
  ELAPSED_BETWEEN_TYPE_ID,
  elapsedBetweenType,
  generateElapsedBetween,
} from './elapsedBetween';
import { timeLimitFor } from './support';
import type { GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 8, peak: getPeak(6) };

const PROMPT_PATTERN =
  /^It's (\d{1,2}):(\d{2})\. It becomes (\d{1,2}):(\d{2})\. How many minutes have passed\?$/;

describe('generateElapsedBetween', () => {
  it('asks a free-typed elapsed-minutes question with no visual aid', () => {
    const q = generateElapsedBetween(mulberry32(1), ctx);
    expect(q.typeId).toBe(ELAPSED_BETWEEN_TYPE_ID);
    expect(q.display.kind).toBe('none');
    expect(q.answer.kind).toBe('number');
  });

  it('declares a positive integer target with a "minutes" unit', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateElapsedBetween(mulberry32(seed), ctx);
      expect(q.answer.kind).toBe('number');
      if (q.answer.kind !== 'number') continue;
      expect(Number.isInteger(q.answer.target)).toBe(true);
      expect(q.answer.target).toBeGreaterThan(0);
      expect(q.answer.unit).toBe('minutes');
    }
  });

  it('computes the elapsed minutes independently of the generator, via the two clock labels', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateElapsedBetween(mulberry32(seed), ctx);
      const match = PROMPT_PATTERN.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const startHalfDayMin = (Number(match[1]) % 12) * 60 + Number(match[2]);
      const endHalfDayMin = (Number(match[3]) % 12) * 60 + Number(match[4]);
      const expected = (((endHalfDayMin - startHalfDayMin) % 720) + 720) % 720;
      expect(q.answer.kind).toBe('number');
      if (q.answer.kind !== 'number') continue;
      expect(q.answer.target).toBe(expected);
    }
  });

  it.each([7, 8, 9, 10])(
    'level %i: re-derives the answer from the prompt and keeps the level grain',
    (difficulty) => {
      let offGrain = false;
      for (let seed = 0; seed < 400; seed++) {
        const q = generateElapsedBetween(mulberry32(seed), { ...ctx, difficulty });
        const match = PROMPT_PATTERN.exec(q.prompt);
        if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
        const startMinute = Number(match[2]);
        const endMinute = Number(match[4]);
        const startHalfDayMin = (Number(match[1]) % 12) * 60 + startMinute;
        const endHalfDayMin = (Number(match[3]) % 12) * 60 + endMinute;
        const expected = (((endHalfDayMin - startHalfDayMin) % 720) + 720) % 720;
        if (q.answer.kind !== 'number') throw new Error('expected a number answer');
        expect(q.answer.target).toBe(expected);
        expect(q.answer.target).toBeGreaterThan(0);
        expect(q.answer.target).toBeLessThanOrEqual(300);
        if (difficulty <= 8) {
          // Levels 7–8: both readings on 5-minute marks.
          expect(startMinute % 5).toBe(0);
          expect(endMinute % 5).toBe(0);
        }
        offGrain ||= startMinute % 5 !== 0 || endMinute % 5 !== 0;
      }
      // Levels 9–10: any minute.
      expect(offGrain).toBe(difficulty >= 9);
    },
  );

  it("uses the difficulty profile timer, scaled by this type's own multiplier", () => {
    for (const difficulty of [1, 5, 10]) {
      const q = generateElapsedBetween(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(timeLimitFor(difficultyProfile(difficulty), 1.3));
    }
  });

  it('restates both times in the explanation', () => {
    const q = generateElapsedBetween(mulberry32(1), ctx);
    const match = PROMPT_PATTERN.exec(q.prompt);
    if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
    expect(q.explainCorrect).toContain(`${match[1]}:${match[2]}`);
    expect(q.explainCorrect).toContain(`${match[3]}:${match[4]}`);
  });

  it('is deterministic for a given seed', () => {
    expect(generateElapsedBetween(mulberry32(42), ctx)).toEqual(
      generateElapsedBetween(mulberry32(42), ctx),
    );
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(elapsedBetweenType.typeId).toBe(ELAPSED_BETWEEN_TYPE_ID);
    expect(elapsedBetweenType.answerMode).toBe('free');
    expect(elapsedBetweenType.generate(mulberry32(3), ctx).typeId).toBe(ELAPSED_BETWEEN_TYPE_ID);
  });
});
