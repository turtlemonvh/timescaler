export interface Peak {
  id: number;
  name: string;
  emphasis: string;
  height: number;
}

/**
 * `height` is a pure game-mechanic "steps to summit" pacing number, tuned
 * per peak against `pacingSimulation.test.ts` — it deliberately isn't a
 * smooth ascending 20-30 curve anymore. Once `selectGenerator` went fully
 * exclusive per peak (a peak only ever draws its own matched generator(s),
 * see `registry.ts`), each peak's pacing became driven entirely by its own
 * matched generator's `TIME_LIMIT_MULTIPLIER` — a peak matched to a slow
 * type (e.g. Leap Crag's `countBetween`, 1.5x) needs a *shorter* climb to
 * land in the same 2-5 minute band as a peak matched to a fast one (e.g.
 * Basecamp Bluff's `readAnalog`, 1.0x, which needed a *taller* climb once
 * it stopped being diluted by slower off-theme questions). Don't "clean
 * this back up" into a tidy ascending sequence without re-running the
 * pacing simulation across every peak and difficulty first.
 *
 * This is the full-length climb (levels 8-10). Lower levels climb a fraction
 * of it — use `climbHeight` from `climb.ts`, never `height` directly, for
 * anything drawn or counted during a climb.
 */
export const PEAKS: readonly Peak[] = [
  { id: 1, name: 'Basecamp Bluff', emphasis: 'Reading analog clocks', height: 27 },
  { id: 2, name: 'Sundial Spire', emphasis: 'Time in words, like "quarter past"', height: 27 },
  { id: 3, name: 'Calendar Ridge', emphasis: 'Reading calendars and dates', height: 22 },
  { id: 4, name: 'The Hourglass', emphasis: 'Setting clock hands', height: 23 },
  { id: 5, name: 'Weekday Wall', emphasis: 'Days of the week, nth weekday', height: 24 },
  { id: 6, name: 'Elapsed Escarpment', emphasis: 'Elapsed time arithmetic', height: 26 },
  { id: 7, name: 'Monthfall Pass', emphasis: 'Date math across months', height: 22 },
  { id: 8, name: 'The Meridian', emphasis: 'AM/PM and 24-hour time', height: 28 },
  { id: 9, name: 'Leap Crag', emphasis: 'Leap years and long spans', height: 21 },
  { id: 10, name: 'Summit of Hours', emphasis: 'Everything, mixed', height: 30 },
];

export function getPeak(id: number): Peak {
  const peak = PEAKS.find((p) => p.id === id);
  if (!peak) throw new Error(`getPeak: no peak with id ${id}`);
  return peak;
}
