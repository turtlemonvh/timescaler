import { randInt, type Rng } from './rng';

export type TimePrecision = 'hour' | 'half' | 'quarter' | 'five' | 'minute' | 'second';

export interface TimeOfDay {
  hour: number;
  minute: number;
  second: number;
}

/** Minute granularity of each precision. `second` steps the minute hand by 1. */
export const PRECISION_STEP_MINUTES: Record<TimePrecision, number> = {
  hour: 60,
  half: 30,
  quarter: 15,
  five: 5,
  minute: 1,
  second: 1,
};

export function randomTime(rng: Rng, precision: TimePrecision): TimeOfDay {
  const hour = randInt(rng, 0, 23);
  const step = PRECISION_STEP_MINUTES[precision];
  const steps = 60 / step;
  const minute = randInt(rng, 0, steps - 1) * step;
  const second = precision === 'second' ? randInt(rng, 0, 59) : 0;
  return { hour, minute, second };
}

/** Converts a 12-hour clock hour (1-12) plus AM/PM to a 24-hour hour (0-23). */
export function to24Hour(hour12: number, isPM: boolean): number {
  const hour = hour12 % 12;
  return isPM ? hour + 12 : hour;
}

const HALF_DAY_MINUTES = 12 * 60;

/**
 * Moves a time by `delta` hours or minutes the way the set-the-clock buttons
 * do, always keeping its AM/PM half: a 12-hour face cannot show the half, so
 * the draft must never leave the one it started in. Hours wrap 12 <-> 1 and
 * leave the minutes alone; minutes carry into the hour like a real clock
 * (11:55 AM + 5 min -> 12:00 AM, 12:00 PM - 1 min -> 11:59 PM). Seconds
 * become 0.
 */
export function stepTime(time: TimeOfDay, unit: 'hour' | 'minute', delta: number): TimeOfDay {
  const halfStart = time.hour >= 12 ? 12 : 0;
  const moved = (time.hour % 12) * 60 + time.minute + (unit === 'hour' ? delta * 60 : delta);
  const position = ((moved % HALF_DAY_MINUTES) + HALF_DAY_MINUTES) % HALF_DAY_MINUTES;
  return { hour: halfStart + Math.floor(position / 60), minute: position % 60, second: 0 };
}

export function formatTime12(t: TimeOfDay, opts: { seconds?: boolean } = {}): string {
  const period = t.hour < 12 ? 'AM' : 'PM';
  const hour12 = t.hour % 12 === 0 ? 12 : t.hour % 12;
  const mm = String(t.minute).padStart(2, '0');
  const base = opts.seconds
    ? `${hour12}:${mm}:${String(t.second).padStart(2, '0')}`
    : `${hour12}:${mm}`;
  return `${base} ${period}`;
}

/** "HH:MM", zero-padded 24-hour time — no AM/PM, unlike `formatTime12`. */
export function formatTime24(t: TimeOfDay, opts: { seconds?: boolean } = {}): string {
  const hh = String(t.hour).padStart(2, '0');
  const mm = String(t.minute).padStart(2, '0');
  return opts.seconds ? `${hh}:${mm}:${String(t.second).padStart(2, '0')}` : `${hh}:${mm}`;
}

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'twenty-one',
  'twenty-two',
  'twenty-three',
  'twenty-four',
  'twenty-five',
  'twenty-six',
  'twenty-seven',
  'twenty-eight',
  'twenty-nine',
];

function hourWord(hour24: number): string {
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return NUMBER_WORDS[h12];
}

export function describeTime(t: TimeOfDay): string {
  const { hour, minute } = t;
  const nextHour = (hour + 1) % 24;
  if (minute === 0) return `${hourWord(hour)} o'clock`;
  if (minute === 15) return `quarter past ${hourWord(hour)}`;
  if (minute === 30) return `half past ${hourWord(hour)}`;
  if (minute === 45) return `quarter to ${hourWord(nextHour)}`;
  if (minute < 30) return `${NUMBER_WORDS[minute]} past ${hourWord(hour)}`;
  return `${NUMBER_WORDS[60 - minute]} to ${hourWord(nextHour)}`;
}
