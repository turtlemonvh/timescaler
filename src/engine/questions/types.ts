import type { AnswerMode } from '../difficulty';
import type { Peak } from '../peaks';
import type { Rng } from '../rng';
import type { TimeOfDay, TimePrecision } from '../timeMath';

/**
 * An analog clock face set to `time`. `showSeconds` drives the second hand;
 * `showNumerals` drives whether 1-12 are printed around the face — on for
 * most difficulty levels, off at the top per `clockNumerals` in
 * `difficulty.ts`, turning "read the clock" into a harder positional task.
 */
export interface AnalogClockDisplay {
  kind: 'analogClock';
  time: TimeOfDay;
  showSeconds: boolean;
  showNumerals: boolean;
}

/** A month grid (weeks start Sunday), optionally with one day cell highlighted. */
export interface CalendarDisplay {
  kind: 'calendar';
  year: number;
  /** 0 = January, matching `Date.prototype.getMonth()`. */
  monthIndex: number;
  /** 1-based day of month; always a day that exists in this month. Omitted
   * when the whole month is the point (e.g. counting a weekday's columns). */
  highlightDay?: number;
}

/**
 * No visual aid — `prompt` carries everything the player needs.
 * Modelled as a union member rather than making `Question.display` optional so
 * every renderer can exhaustively `switch` on `display.kind` with no null check.
 */
export interface NoDisplay {
  kind: 'none';
}

export type DisplaySpec = AnalogClockDisplay | CalendarDisplay | NoDisplay;

/**
 * Multiple choice. `options` are display-ready strings and `correctIndex` is the
 * only grading data required, so the spec grades itself — nothing outside the
 * `AnswerSpec` needs to be consulted to mark an answer.
 *
 * Convention every answer kind follows: each union member carries its own
 * grading data inline — a target `TimeOfDay`, a target date, a target number
 * — and gets its own `isCorrect*` helper next to `isCorrectChoice` below.
 * `Question` itself never changes shape to accommodate a new kind. None of
 * these grade with a tolerance window: a snapped clock-hand position, a
 * whole-number count, and a specific calendar day are all exact, discrete
 * values, not continuous measurements, so exact equality is the correct
 * rule — not an approximation that would need a magic-number margin.
 */
export interface ChoiceAnswer {
  kind: 'choice';
  options: string[];
  correctIndex: number;
}

/**
 * Player sets the analog clock's hands to match `target` with the
 * widget's step buttons. `precision` is how far one press of a minute arrow
 * moves (see `AnalogClock`'s own `precision` prop) — the generator that
 * builds this answer already drew `target`'s minute at that same precision,
 * so the target is always reachable. Only hour and minute are graded: the
 * widget has no control for a second hand.
 */
export interface SetHandsAnswer {
  kind: 'setHands';
  target: TimeOfDay;
  precision: TimePrecision;
}

/**
 * A free-typed numeric answer (an elapsed-time count, a day count, etc.).
 * `unit` is presentational only, shown by `NumberEntry` next to the field —
 * grading never looks at it.
 */
export interface NumberAnswer {
  kind: 'number';
  target: number;
  unit?: string;
}

/**
 * Player picks a specific calendar date via `DatePicker`. Field names match
 * that widget's own `PickedDate` shape one-for-one (`year`, `monthIndex`,
 * `day`) so `Climb.tsx` can hand a `DatePicker` selection straight to the
 * grader with no reshaping — this type doesn't import the UI widget's type
 * itself, since engine code stays independent of `src/ui`.
 */
export interface PickDateAnswer {
  kind: 'pickDate';
  year: number;
  monthIndex: number;
  day: number;
}

export type AnswerSpec = ChoiceAnswer | SetHandsAnswer | NumberAnswer | PickDateAnswer;

export interface Question {
  /** Unique-per-generation id, prefixed with `typeId`. Usable as a React key. */
  id: string;
  typeId: string;
  prompt: string;
  display: DisplaySpec;
  answer: AnswerSpec;
  timeLimitMs: number;
  /** Shown during the ~1.5s reveal after an answer. */
  explainCorrect: string;
}

/** Everything a generator is allowed to know about the current climb. */
export interface GeneratorContext {
  difficulty: number;
  peak: Peak;
}

export type QuestionGenerator = (rng: Rng, ctx: GeneratorContext) => Question;

export interface QuestionType {
  typeId: string;
  /** Which answer widget this type uses — drives `selectGenerator`'s
   * weighting against `DifficultyProfile.answerModeWeights` and tells
   * `Climb.tsx` how to render/grade the answer. Fixed per type, not drawn
   * per question. */
  answerMode: AnswerMode;
  generate: QuestionGenerator;
}

/** Grades a multiple-choice answer. See the `ChoiceAnswer` doc comment. */
export function isCorrectChoice(answer: ChoiceAnswer, selectedIndex: number): boolean {
  return (
    selectedIndex >= 0 &&
    selectedIndex < answer.options.length &&
    selectedIndex === answer.correctIndex
  );
}

/** Grades a set-the-clock-hands answer. See the `SetHandsAnswer` doc comment. */
export function isCorrectSetHands(answer: SetHandsAnswer, submitted: TimeOfDay): boolean {
  return submitted.hour === answer.target.hour && submitted.minute === answer.target.minute;
}

/** Grades a free-typed numeric answer. See the `NumberAnswer` doc comment. */
export function isCorrectNumber(answer: NumberAnswer, submitted: number): boolean {
  return submitted === answer.target;
}

/** Grades a picked-date answer. See the `PickDateAnswer` doc comment. */
export function isCorrectPickDate(
  answer: PickDateAnswer,
  submitted: { year: number; monthIndex: number; day: number },
): boolean {
  return (
    submitted.year === answer.year &&
    submitted.monthIndex === answer.monthIndex &&
    submitted.day === answer.day
  );
}
