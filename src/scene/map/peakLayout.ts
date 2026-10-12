import { PEAKS, type Peak } from '../../engine/peaks';

/** Where a peak stands on the overworld island, in scene units. */
export interface PeakSpot {
  id: number;
  x: number;
  z: number;
  /** Base radius of the mountain cone. */
  radius: number;
  /** Height of the cone. Grows with id, not with `peak.height` — see
   * `peaks.ts`: height is a pacing number, not a visual curve. */
  height: number;
}

/**
 * Peaks wind along an S-shaped trail from the front-left of the island to
 * the back-right, each a little taller than the last, so the whole run
 * reads as a journey even before any of them is climbed.
 */
export function peakSpot(peak: Peak): PeakSpot {
  const t = (peak.id - 1) / (PEAKS.length - 1);
  const angle = t * Math.PI * 2.2 - 1.3;
  return {
    id: peak.id,
    x: 5.5 * Math.sin(angle) * (0.7 + 0.3 * t),
    z: 9 - t * 22,
    radius: 0.9 + t * 0.8,
    height: 1.8 + t * 3.4,
  };
}

export const PEAK_SPOTS: readonly PeakSpot[] = PEAKS.map(peakSpot);

export function peakSpotFor(peakId: number): PeakSpot {
  const spot = PEAK_SPOTS.find((entry) => entry.id === peakId);
  if (!spot) throw new Error(`peakSpotFor: no spot for peak id ${peakId}`);
  return spot;
}

/** Island radius that comfortably contains every peak with some beach to spare. */
export const ISLAND_RADIUS = 16;
