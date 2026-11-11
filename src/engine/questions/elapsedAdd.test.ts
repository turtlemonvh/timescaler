import { describe, expect, it } from 'vitest';
import { difficultyProfile } from '../difficulty';
import { getPeak } from '../peaks';
import { mulberry32 } from '../rng';
import { ELAPSED_ADD_TYPE_ID, elapsedAddType, generateElapsedAdd } from './elapsedAdd';
import { timeLimitFor } from './support';
import { expectChoiceAnswer } from './testSupport';
import type { GeneratorContext } from './types';

const ctx: GeneratorContext = { difficulty: 5, peak: getPeak(6) };

/** Parses a bare 12-hour, no-AM/PM clock label like "3:05" into minutes-since-midnight-mod-720. */
function parseClockToHalfDayMinutes(text: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw new Error(`not a clock label: ${text}`);
  return (Number(match[1]) % 12) * 60 + Number(match[2]);
}

describe('generateElapsedAdd', () => {
  it('asks an elapsed-time-arithmetic question with no visual aid', () => {
    const q = generateElapsedAdd(mulberry32(1), ctx);
    expect(q.typeId).toBe(ELAPSED_ADD_TYPE_ID);
    expect(q.display.kind).toBe('none');
    expect(q.prompt.startsWith("It's ")).toBe(true);
    expect(q.prompt.endsWith('?')).toBe(true);
  });

  it('offers four distinct clock-face-formatted options with no AM/PM', () => {
    for (let seed = 0; seed < 200; seed++) {
      const q = generateElapsedAdd(mulberry32(seed), ctx);
      const { options } = expectChoiceAnswer(q);
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      for (const option of options) {
        expect(option).toMatch(/^\d{1,2}:\d{2}$/);
        expect(option).not.toMatch(/AM|PM/);
      }
    }
  });

  it('computes the correct result independently of the generator, forward and backward', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateElapsedAdd(mulberry32(seed), ctx);
      const forwardMatch = /^It's (\d{1,2}):(\d{2})\. What time will it be in (.+)\?$/.exec(
        q.prompt,
      );
      const backwardMatch = /^It's (\d{1,2}):(\d{2})\. What time was it (.+) ago\?$/.exec(q.prompt);
      const match = forwardMatch ?? backwardMatch;
      if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
      const startHalfDayMin = (Number(match[1]) % 12) * 60 + Number(match[2]);
      const durationText = match[3];
      const hourPart = /(\d+) hours?/.exec(durationText);
      const minutePart = /(\d+) minutes?/.exec(durationText);
      const durationMinutes =
        (hourPart ? Number(hourPart[1]) * 60 : 0) + (minutePart ? Number(minutePart[1]) : 0);
      const sign = forwardMatch ? 1 : -1;
      const expectedHalfDayMin = (((startHalfDayMin + sign * durationMinutes) % 720) + 720) % 720;
      const answer = expectChoiceAnswer(q);
      const declaredHalfDayMin = parseClockToHalfDayMinutes(answer.options[answer.correctIndex]);
      expect(declaredHalfDayMin).toBe(expectedHalfDayMin);
    }
  });

  it('produces both forward and backward questions', () => {
    const directions = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const q = generateElapsedAdd(mulberry32(seed), ctx);
      directions.add(q.prompt.includes('will it be') ? 'forward' : 'backward');
    }
    expect(directions.size).toBe(2);
  });

  it('never says "1 minutes" or "1 hours"', () => {
    for (let seed = 0; seed < 300; seed++) {
      const q = generateElapsedAdd(mulberry32(seed), { ...ctx, difficulty: 6 });
      expect(q.prompt).not.toMatch(/\b1 (minutes|hours)\b/);
    }
  });

  it("uses the difficulty profile timer, scaled by this type's own multiplier", () => {
    for (const difficulty of [1, 5, 10]) {
      const q = generateElapsedAdd(mulberry32(1), { ...ctx, difficulty });
      expect(q.timeLimitMs).toBe(timeLimitFor(difficultyProfile(difficulty), 1.2));
    }
  });

  it('restates the question in the explanation', () => {
    const q = generateElapsedAdd(mulberry32(1), ctx);
    const answer = expectChoiceAnswer(q);
    expect(q.explainCorrect).toContain(answer.options[answer.correctIndex]);
  });

  it('is deterministic for a given seed', () => {
    expect(generateElapsedAdd(mulberry32(42), ctx)).toEqual(
      generateElapsedAdd(mulberry32(42), ctx),
    );
  });

  it('exports a QuestionType wired to the generator', () => {
    expect(elapsedAddType.typeId).toBe(ELAPSED_ADD_TYPE_ID);
    expect(elapsedAddType.answerMode).toBe('choice');
    expect(elapsedAddType.generate(mulberry32(3), ctx).typeId).toBe(ELAPSED_ADD_TYPE_ID);
  });
});

/** Everything a test needs, read back from the prompt text alone (never the generator's state). */
interface ParsedElapsed {
  /** Start, in minutes since 12:00 on a 12-hour, no-AM/PM clock. */
  start: number;
  startMinute: number;
  amount: number;
  hourPart: number;
  minutePart: number;
  forward: boolean;
  /** The correct result, derived from the prompt, in minutes mod 720. */
  expected: number;
}

function parseElapsedPrompt(prompt: string): ParsedElapsed {
  const forwardMatch = /^It's (\d{1,2}):(\d{2})\. What time will it be in (.+)\?$/.exec(prompt);
  const backwardMatch = /^It's (\d{1,2}):(\d{2})\. What time was it (.+) ago\?$/.exec(prompt);
  const match = forwardMatch ?? backwardMatch;
  if (!match) throw new Error(`unexpected prompt: ${prompt}`);
  const durationMatch = /^(?:(\d+) hours?)?(?: and )?(?:(\d+) minutes?)?$/.exec(match[3]);
  if (!durationMatch) throw new Error(`unexpected duration: ${match[3]}`);
  const hourPart = Number(durationMatch[1] ?? 0);
  const minutePart = Number(durationMatch[2] ?? 0);
  const amount = hourPart * 60 + minutePart;
  const start = (Number(match[1]) % 12) * 60 + Number(match[2]);
  const forward = forwardMatch !== null;
  const expected = (((start + (forward ? amount : -amount)) % 720) + 720) % 720;
  return { start, startMinute: Number(match[2]), amount, hourPart, minutePart, forward, expected };
}

/** True when the clock's hour changes between the start and the result. */
function crossesHour(p: ParsedElapsed): boolean {
  const end = p.start + (p.forward ? p.amount : -p.amount);
  return Math.floor(end / 60) !== Math.floor(p.start / 60);
}

/** Whether `option` is the correct time one hour off either way (the forgotten carry). */
function isHourOff(option: number, correct: number): boolean {
  return option === (correct + 60) % 720 || option === (correct + 660) % 720;
}

const SEEDS = 400;

function questionsAt(difficulty: number) {
  return Array.from({ length: SEEDS }, (_, seed) => {
    const q = generateElapsedAdd(mulberry32(seed), { difficulty, peak: getPeak(6) });
    const answer = expectChoiceAnswer(q);
    const parsed = parseElapsedPrompt(q.prompt);
    const options = answer.options.map(parseClockToHalfDayMinutes);
    return { parsed, options, correct: options[answer.correctIndex] };
  });
}

describe('generateElapsedAdd per-level curriculum (issue #164)', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'level %i: the declared answer matches the prompt, among four distinct options',
    (difficulty) => {
      for (const { parsed, options, correct } of questionsAt(difficulty)) {
        expect(correct).toBe(parsed.expected);
        expect(options).toHaveLength(4);
        expect(new Set(options).size).toBe(4);
      }
    },
  );

  it('level 1: tens only, adding only, inside the hour; options on the same hour in tens', () => {
    for (const { parsed, options, correct } of questionsAt(1)) {
      expect(parsed.forward).toBe(true);
      expect(parsed.startMinute % 10).toBe(0);
      expect(parsed.hourPart).toBe(0);
      expect(parsed.amount % 10).toBe(0);
      expect(parsed.amount).toBeGreaterThanOrEqual(10);
      expect(parsed.amount).toBeLessThanOrEqual(50);
      expect(parsed.startMinute + parsed.amount).toBeLessThanOrEqual(50);
      expect(crossesHour(parsed)).toBe(false);
      for (const option of options) {
        expect(option % 10).toBe(0);
        expect(Math.floor(option / 60)).toBe(Math.floor(correct / 60));
      }
    }
  });

  it.each([2, 3])(
    'level %i: fives only, inside the hour; options on the same hour in fives',
    (difficulty) => {
      const directions = new Set<boolean>();
      for (const { parsed, options, correct } of questionsAt(difficulty)) {
        directions.add(parsed.forward);
        expect(parsed.startMinute % 5).toBe(0);
        expect(parsed.hourPart).toBe(0);
        expect(parsed.amount % 5).toBe(0);
        expect(parsed.amount).toBeGreaterThanOrEqual(5);
        expect(parsed.amount).toBeLessThanOrEqual(55);
        expect(crossesHour(parsed)).toBe(false);
        for (const option of options) {
          expect(option % 5).toBe(0);
          expect(Math.floor(option / 60)).toBe(Math.floor(correct / 60));
        }
      }
      // Level 2 only adds; level 3 adds and subtracts.
      expect([...directions].sort()).toEqual(difficulty === 2 ? [true] : [false, true]);
    },
  );

  it.each([1, 2, 3])('level %i never asks for a whole-hour jump', (difficulty) => {
    for (const { parsed } of questionsAt(difficulty)) expect(parsed.amount % 60).not.toBe(0);
  });

  it('level 4: fives plus 1h/2h, both directions, crossing the hour', () => {
    const seen = { crossed: false, back: false, sixty: false, oneTwenty: false };
    for (const { parsed, options } of questionsAt(4)) {
      expect(parsed.startMinute % 5).toBe(0);
      const isWholeHour = parsed.amount === 60 || parsed.amount === 120;
      expect(isWholeHour || (parsed.amount % 5 === 0 && parsed.amount <= 55)).toBe(true);
      seen.crossed ||= crossesHour(parsed);
      seen.sixty ||= parsed.amount === 60;
      seen.oneTwenty ||= parsed.amount === 120;
      seen.back ||= !parsed.forward;
      for (const option of options) expect(option % 5).toBe(0);
    }
    expect(seen).toEqual({ crossed: true, back: true, sixty: true, oneTwenty: true });
  });

  it('level 5: any start minute, round amounts, never crossing the hour', () => {
    let offGrainStart = false;
    for (const { parsed } of questionsAt(5)) {
      offGrainStart ||= parsed.startMinute % 5 !== 0;
      expect(parsed.hourPart).toBe(0);
      expect(parsed.amount % 5).toBe(0);
      expect(parsed.amount).toBeGreaterThanOrEqual(5);
      expect(parsed.amount).toBeLessThanOrEqual(55);
      expect(crossesHour(parsed)).toBe(false);
    }
    expect(offGrainStart).toBe(true);
  });

  it('level 6: any start minute, round amounts under an hour, crossing the hour', () => {
    let crossed = false;
    for (const { parsed } of questionsAt(6)) {
      crossed ||= crossesHour(parsed);
      expect(parsed.hourPart).toBe(0);
      expect(parsed.amount % 5).toBe(0);
      expect(parsed.amount).toBeLessThanOrEqual(55);
    }
    expect(crossed).toBe(true);
  });

  it('level 7: always over an hour, as "N hour(s) and M minutes"', () => {
    for (const { parsed } of questionsAt(7)) {
      expect(parsed.hourPart).toBeGreaterThanOrEqual(1);
      expect(parsed.hourPart).toBeLessThanOrEqual(2);
      expect(parsed.minutePart).toBeGreaterThanOrEqual(5);
      expect(parsed.minutePart % 5).toBe(0);
    }
  });

  it.each([8, 9, 10])('level %i: any amount up to three hours', (difficulty) => {
    for (const { parsed } of questionsAt(difficulty)) {
      expect(parsed.amount).toBeGreaterThanOrEqual(1);
      expect(parsed.amount).toBeLessThanOrEqual(180);
    }
  });

  it.each([4, 5, 6, 7, 8, 9, 10])('level %i always offers a ±1 hour option', (difficulty) => {
    for (const { options, correct } of questionsAt(difficulty)) {
      expect(options.some((o) => isHourOff(o, correct))).toBe(true);
    }
  });

  it.each([1, 2, 3])('level %i never offers a ±1 hour option', (difficulty) => {
    for (const { options, correct } of questionsAt(difficulty)) {
      expect(options.some((o) => isHourOff(o, correct))).toBe(false);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('level %i is deterministic per seed', (difficulty) => {
    const c = { difficulty, peak: getPeak(6) };
    expect(generateElapsedAdd(mulberry32(7), c)).toEqual(generateElapsedAdd(mulberry32(7), c));
  });
});
