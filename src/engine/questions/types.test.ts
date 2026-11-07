import { describe, expect, it } from 'vitest';
import {
  isCorrectChoice,
  isCorrectNumber,
  isCorrectPickDate,
  isCorrectSetHands,
  type ChoiceAnswer,
  type NumberAnswer,
  type PickDateAnswer,
  type SetHandsAnswer,
} from './types';

const answer: ChoiceAnswer = {
  kind: 'choice',
  options: ['3:00', '4:00', '5:00', '6:00'],
  correctIndex: 2,
};

describe('isCorrectChoice', () => {
  it('accepts the declared correct index', () => {
    expect(isCorrectChoice(answer, 2)).toBe(true);
  });

  it('rejects every other option index', () => {
    expect(isCorrectChoice(answer, 0)).toBe(false);
    expect(isCorrectChoice(answer, 1)).toBe(false);
    expect(isCorrectChoice(answer, 3)).toBe(false);
  });

  it('rejects indexes outside the option list, via an explicit bounds check', () => {
    // These don't numerically equal `correctIndex` (2) either, so this alone
    // wouldn't distinguish a real bounds check from one that just happens to
    // pass by falling through to the equality comparison — the case below does.
    expect(isCorrectChoice(answer, -1)).toBe(false);
    expect(isCorrectChoice(answer, 4)).toBe(false);
    // Out-of-range but numerically equal to correctIndex if bounds weren't
    // checked: an answer set with only 3 options, "correct" at index 2 lying
    // just past the end. A missing bounds check would report this as correct.
    const tooShort: ChoiceAnswer = { kind: 'choice', options: ['x', 'y'], correctIndex: 2 };
    expect(isCorrectChoice(tooShort, 2)).toBe(false);
  });
});

describe('isCorrectSetHands', () => {
  const setHands: SetHandsAnswer = {
    kind: 'setHands',
    target: { hour: 15, minute: 45, second: 0 },
    precision: 'quarter',
  };

  it('accepts the exact hour and minute', () => {
    expect(isCorrectSetHands(setHands, { hour: 15, minute: 45, second: 0 })).toBe(true);
  });

  it('ignores seconds — the widget has no second-hand control', () => {
    expect(isCorrectSetHands(setHands, { hour: 15, minute: 45, second: 37 })).toBe(true);
  });

  it('rejects a wrong hour, even with the right minute', () => {
    expect(isCorrectSetHands(setHands, { hour: 3, minute: 45, second: 0 })).toBe(false);
  });

  it('rejects a wrong minute, even with the right hour', () => {
    expect(isCorrectSetHands(setHands, { hour: 15, minute: 44, second: 0 })).toBe(false);
  });
});

describe('isCorrectNumber', () => {
  const number: NumberAnswer = { kind: 'number', target: 42, unit: 'minutes' };

  it('accepts the exact target value', () => {
    expect(isCorrectNumber(number, 42)).toBe(true);
  });

  it('rejects any other value, with no tolerance window', () => {
    expect(isCorrectNumber(number, 41)).toBe(false);
    expect(isCorrectNumber(number, 43)).toBe(false);
    expect(isCorrectNumber(number, 0)).toBe(false);
  });
});

describe('isCorrectPickDate', () => {
  const pickDate: PickDateAnswer = { kind: 'pickDate', year: 2026, monthIndex: 5, day: 21 };

  it('accepts the exact year, month, and day', () => {
    expect(isCorrectPickDate(pickDate, { year: 2026, monthIndex: 5, day: 21 })).toBe(true);
  });

  it('rejects a mismatched day', () => {
    expect(isCorrectPickDate(pickDate, { year: 2026, monthIndex: 5, day: 22 })).toBe(false);
  });

  it('rejects a mismatched month, even with a matching day and year', () => {
    expect(isCorrectPickDate(pickDate, { year: 2026, monthIndex: 6, day: 21 })).toBe(false);
  });

  it('rejects a mismatched year, even with a matching day and month', () => {
    expect(isCorrectPickDate(pickDate, { year: 2027, monthIndex: 5, day: 21 })).toBe(false);
  });
});
