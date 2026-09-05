import { PEAKS, type Peak } from '../../engine/peaks';

export interface MountainTheme {
  peak: Peak;
  rock: string;
  snow: string;
}

/**
 * Rock/snow colors per peak, keyed by `peak.id` — one entry per `PEAKS`
 * entry (checked by a test), so a new peak added to the engine can't
 * silently ship with no themed mountain.
 */
const PALETTES: Readonly<Record<number, { rock: string; snow: string }>> = {
  1: { rock: '#6b6459', snow: '#f4f4f4' }, // Basecamp Bluff
  2: { rock: '#8a5a44', snow: '#fceabb' }, // Sundial Spire
  3: { rock: '#4a5859', snow: '#e8f6f6' }, // Calendar Ridge
  4: { rock: '#a58a5c', snow: '#fff3d6' }, // The Hourglass
  5: { rock: '#7a7a6e', snow: '#eef0e6' }, // Weekday Wall
  6: { rock: '#8b4a3a', snow: '#f7ded1' }, // Elapsed Escarpment
  7: { rock: '#556a7a', snow: '#dff0f7' }, // Monthfall Pass
  8: { rock: '#6b5a3a', snow: '#fff0c2' }, // The Meridian
  9: { rock: '#3d3a4b', snow: '#d6d9f2' }, // Leap Crag
  10: { rock: '#4b3b5c', snow: '#e6dcf5' }, // Summit of Hours
};

/**
 * All 10 peaks with their mountain colors, in `PEAKS` order. See
 * `pixelPeakHeight` below for how a peak's silhouette height is derived —
 * deliberately not from `peak.height` itself.
 */
export const MOUNTAIN_THEMES: readonly MountainTheme[] = PEAKS.map((peak) => {
  const palette = PALETTES[peak.id];
  if (!palette) throw new Error(`mountainThemes: no palette for peak id ${peak.id}`);
  return { peak, ...palette };
});

/**
 * The theme for one peak id, for callers that hold a `Peak` rather than an
 * index into `MOUNTAIN_THEMES` (the climb stage tints its whole wall from
 * this). Falls back to the first peak's palette rather than throwing: an
 * unknown id here means a debug page or a test fixture peak, and a
 * mis-coloured wall is a better failure than a blank climb screen.
 */
export function mountainThemeFor(peakId: number): MountainTheme {
  return MOUNTAIN_THEMES.find((theme) => theme.peak.id === peakId) ?? MOUNTAIN_THEMES[0];
}

/**
 * Maps a peak's `id` (1-10, always ascending) to a pixel peak-height
 * (14-22) — deliberately independent of `peak.height`. `height` is now a
 * pacing-tuning number that doesn't rise smoothly with peak order (see
 * `peaks.ts`'s own comment: it's tuned per peak against the pacing
 * simulation, not a visual curve), so deriving the mountain silhouette from
 * it would make later peaks look visually *shorter* than earlier ones.
 * Using `id` instead keeps the "progressively bigger mountains" visual
 * metaphor intact regardless of how `height` gets tuned.
 */
export function pixelPeakHeight(peak: Peak): number {
  const MIN_ID = 1;
  const MAX_ID = 10;
  const MIN_PIXEL_HEIGHT = 14;
  const MAX_PIXEL_HEIGHT = 22;
  const t = (peak.id - MIN_ID) / (MAX_ID - MIN_ID);
  return Math.round(MIN_PIXEL_HEIGHT + t * (MAX_PIXEL_HEIGHT - MIN_PIXEL_HEIGHT));
}
