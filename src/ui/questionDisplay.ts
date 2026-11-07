import type { AnswerSpec, DisplaySpec } from '../engine/questions';
import type { TimeOfDay } from '../engine/timeMath';

export const MONTH_NAMES = [
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

export function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * A one-line, human-readable gloss of a display spec. Text only, even
 * though real widgets (AnalogClock, CalendarMonth) exist and render this
 * same data elsewhere (`PreviewPlayer.tsx`, `Climb.tsx`) — used by
 * `DebugQuestionsPage`, whose whole purpose is a compact, scannable dump
 * of raw generator output, not a rendered preview.
 */
export function describeDisplay(display: DisplaySpec): string {
  switch (display.kind) {
    case 'analogClock': {
      const { hour, minute, second } = display.time;
      const seconds = display.showSeconds ? ', second hand shown' : '';
      return `analog clock at ${pad(hour)}:${pad(minute)}:${pad(second)} (24h internal)${seconds}`;
    }
    case 'calendar': {
      const month = `calendar for ${MONTH_NAMES[display.monthIndex]} ${display.year}`;
      return display.highlightDay === undefined
        ? month
        : `${month}, day ${display.highlightDay} highlighted`;
    }
    case 'none':
      return 'no visual — the prompt carries everything';
  }
}

/**
 * A one-line, human-readable gloss of an answer spec's *grading data* — not
 * a rendering of the actual answer widget (`ChoiceGrid`/`AnalogClock`/
 * `NumberEntry`/`DatePicker` handle that in production and in
 * `PreviewPlayer`). Exists for `DebugQuestionsPage`, whose whole purpose is
 * inspecting raw generator output regardless of answer kind — unlike
 * `Climb.tsx`/`PreviewPlayer`, which fail loudly on a kind they don't yet
 * render, this is dev-only tooling that should keep working for every
 * generator PR as M5 adds new kinds, not break until each one's real UI
 * lands.
 */
/**
 * Starting hand position for a `setHands` answer's interactive widget.
 * Matches `target`'s AM/PM half (noon if PM, midnight if AM) —
 * `AnalogClock`'s 12-hour face can't show which half the hour hand is in,
 * so every button step keeps whichever half the draft starts in (see
 * `stepTime`). Starting in the wrong half would make the target
 * structurally unreachable with the buttons, not just a harder question.
 * Shared between `Climb.tsx` and `PreviewPlayer.tsx`, the two places that
 * render this answer kind interactively, so the reachability fix can't
 * drift out of sync between them.
 */
export function defaultSetHandsDraft(target: TimeOfDay): TimeOfDay {
  const isPM = target.hour >= 12;
  return { hour: isPM ? 12 : 0, minute: 0, second: 0 };
}

export function describeAnswer(answer: AnswerSpec): string {
  switch (answer.kind) {
    case 'choice':
      return `choice: ${answer.options.join(' | ')} (correct: ${answer.options[answer.correctIndex]})`;
    case 'setHands': {
      const { hour, minute } = answer.target;
      return `setHands: target ${pad(hour)}:${pad(minute)} (${answer.precision} precision)`;
    }
    case 'number':
      return `number: target ${answer.target}${answer.unit ? ` ${answer.unit}` : ''}`;
    case 'pickDate':
      return `pickDate: target ${MONTH_NAMES[answer.monthIndex]} ${answer.day}, ${answer.year}`;
  }
}
