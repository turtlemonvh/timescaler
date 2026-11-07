import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import { generateSetHands, SET_HANDS_TYPE_ID, setHandsType } from './setHands';
import { timeLimitFor } from './support';
import { isCorrectSetHands, type GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 5, peak: getPeak(4) };

describe('generateSetHands', () => {
  it('asks a hands-setting question with no visual aid', () => {
    const q = generateSetHands(mulberry32(1), ctx);
    expect(q.typeId).toBe(SET_HANDS_TYPE_ID);
    expect(q.display.kind).toBe('none');
    expect(q.answer.kind).toBe('setHands');
    expect(q.prompt.startsWith('Set the clock to ')).toBe(true);
  });

  it("never targets second precision — there's no second-hand control", () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const difficulty of [1, 5, 9, 10]) {
        const q = generateSetHands(mulberry32(seed), { ...ctx, difficulty });
        expect(q.answer.kind).toBe('setHands');
        if (q.answer.kind !== 'setHands') continue;
        expect(q.answer.precision).not.toBe('second');
        expect(q.answer.target.second).toBe(0);
      }
    }
  });

  it('declares a target the grader itself accepts, and rejects near misses', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateSetHands(mulberry32(seed), ctx);
      expect(q.answer.kind).toBe('setHands');
      if (q.answer.kind !== 'setHands') continue;
      expect(isCorrectSetHands(q.answer, q.answer.target)).toBe(true);
      expect(
        isCorrectSetHands(q.answer, {
          ...q.answer.target,
          minute: (q.answer.target.minute + 1) % 60,
        }),
      ).toBe(false);
    }
  });

  it('produces both AM and PM targets across enough draws', () => {
    const halves = new Set<'AM' | 'PM'>();
    for (let seed = 0; seed < 200; seed++) {
      const q = generateSetHands(mulberry32(seed), ctx);
      if (q.answer.kind !== 'setHands') continue;
      halves.add(q.answer.target.hour >= 12 ? 'PM' : 'AM');
    }
    expect(halves.size).toBe(2);
  });

  it('the prompt states a time consistent with the target, with no AM/PM', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateSetHands(mulberry32(seed), ctx);
      if (q.answer.kind !== 'setHands') continue;
      const match = /^Set the clock to (\d{1,2}):(\d{2})\.$/.exec(q.prompt);
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const hour12 = q.answer.target.hour % 12 === 0 ? 12 : q.answer.target.hour % 12;
      expect(Number(match[1])).toBe(hour12);
      expect(Number(match[2])).toBe(q.answer.target.minute);
      expect(q.prompt).not.toMatch(/AM|PM/);
    }
  });

  it("uses the difficulty profile timer, scaled by this type's own multiplier", () => {
    for (const difficulty of [1, 5, 10]) {
      const q = generateSetHands(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(timeLimitFor(difficultyProfile(difficulty), 1.3));
    }
  });

  it('is deterministic for a given seed', () => {
    expect(generateSetHands(mulberry32(42), ctx)).toEqual(generateSetHands(mulberry32(42), ctx));
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(setHandsType.typeId).toBe(SET_HANDS_TYPE_ID);
    expect(setHandsType.answerMode).toBe('interactive');
    expect(setHandsType.generate(mulberry32(3), ctx).typeId).toBe(SET_HANDS_TYPE_ID);
  });
});
