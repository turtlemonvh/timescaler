import { describe, expect, it } from 'vitest';
import { PEAKS } from '../engine/peaks';
import { mulberry32 } from '../engine/rng';
import { stepTime, type TimeOfDay, type TimePrecision } from '../engine/timeMath';
import { generateSetHands, isCorrectSetHands, type Question } from '../engine/questions';
import { defaultSetHandsDraft } from './questionDisplay';

/**
 * Contract test for the set-the-clock button pad (see `contract.test.ts` for
 * the pattern): for many seeded setHands questions at every precision, start
 * where `Climb` starts the player, press only the buttons that precision
 * offers, and check that reaching the time the prompt asks for grades
 * correct. The target position is parsed from the prompt itself, not taken
 * from the generator's `answer.target`.
 */

const SEED_COUNT = 300;
const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Minutes per minute-arrow press, mirrored here rather than imported from `timeMath`. */
const MINUTE_STEP: Record<Exclude<TimePrecision, 'second'>, number | null> = {
  hour: null, // no minute row
  half: 30,
  quarter: 15,
  five: 5,
  minute: 1,
};

/** The 12-hour face position "H:MM" the prompt asks for, in minutes past 12. */
function promptPosition(q: Question): number {
  const match = q.prompt.match(/^Set the clock to (\d{1,2}):(\d{2})\.$/);
  if (!match) throw new Error(`unexpected prompt: ${q.prompt}`);
  return (Number(match[1]) % 12) * 60 + Number(match[2]);
}

function facePosition(t: TimeOfDay): number {
  return (t.hour % 12) * 60 + t.minute;
}

/** Hours forward to the prompt's hour, then minutes forward to its minute. */
function pressHoursThenMinutes(start: TimeOfDay, goal: number, minuteStep: number | null) {
  let time = start;
  let presses = 0;
  while (Math.floor(facePosition(time) / 60) !== Math.floor(goal / 60)) {
    time = stepTime(time, 'hour', 1);
    if (++presses > 12) throw new Error('hour never matched');
  }
  if (minuteStep === null) return time;
  presses = 0;
  while (facePosition(time) !== goal) {
    time = stepTime(time, 'minute', minuteStep);
    if (++presses > 60) throw new Error('minute never matched');
  }
  return time;
}

/** Minute presses only, backwards, letting the minutes carry the hour round. */
function pressMinutesBack(start: TimeOfDay, goal: number, minuteStep: number) {
  let time = start;
  let presses = 0;
  while (facePosition(time) !== goal) {
    time = stepTime(time, 'minute', -minuteStep);
    if (++presses > 720) throw new Error('minute presses never reached the goal');
  }
  return time;
}

describe('setHands is answerable with the button pad alone', () => {
  const peak = PEAKS.find((p) => p.id === 4) ?? PEAKS[0];
  const seen = new Set<TimePrecision>();

  it('every generated question is reachable and grades correct', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < SEED_COUNT; i++) {
        const q = generateSetHands(mulberry32(difficulty * 7919 + i * 104_729 + 3), {
          difficulty,
          peak,
        });
        if (q.answer.kind !== 'setHands') throw new Error('not a setHands answer');
        const answer = q.answer;
        expect(answer.precision).not.toBe('second');
        const precision = answer.precision as Exclude<TimePrecision, 'second'>;
        seen.add(precision);
        const minuteStep = MINUTE_STEP[precision];
        const goal = promptPosition(q);
        const start = defaultSetHandsDraft(answer.target);

        const viaHours = pressHoursThenMinutes(start, goal, minuteStep);
        expect(facePosition(viaHours)).toBe(goal);
        expect(isCorrectSetHands(answer, viaHours)).toBe(true);

        if (minuteStep !== null) {
          const viaMinutes = pressMinutesBack(start, goal, minuteStep);
          expect(isCorrectSetHands(answer, viaMinutes)).toBe(true);
        }

        // One press off in any direction is graded wrong.
        expect(isCorrectSetHands(answer, stepTime(viaHours, 'hour', 1))).toBe(false);
        if (minuteStep !== null) {
          expect(isCorrectSetHands(answer, stepTime(viaHours, 'minute', minuteStep))).toBe(false);
          expect(isCorrectSetHands(answer, stepTime(viaHours, 'minute', -minuteStep))).toBe(false);
        }
      }
    }
    // Every precision the pad supports actually came up.
    expect([...seen].sort()).toEqual(['five', 'half', 'hour', 'minute', 'quarter']);
  });
});
