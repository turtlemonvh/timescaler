import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { MOUNTAIN_THEMES, mountainThemeFor, pixelPeakHeight } from './mountainThemes';

describe('MOUNTAIN_THEMES', () => {
  it('has exactly one entry per peak, in PEAKS order', () => {
    expect(MOUNTAIN_THEMES.map((t) => t.peak.id)).toEqual(PEAKS.map((p) => p.id));
  });

  it('every theme has a rock and snow color, and they differ', () => {
    for (const theme of MOUNTAIN_THEMES) {
      expect(theme.rock).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.snow).toMatch(/^#[0-9a-f]{6}$/);
      expect(theme.rock).not.toBe(theme.snow);
    }
  });

  it('no two peaks share the exact same rock color', () => {
    const rocks = MOUNTAIN_THEMES.map((t) => t.rock);
    expect(new Set(rocks).size).toBe(rocks.length);
  });
});

describe('pixelPeakHeight', () => {
  it('is monotonically non-decreasing with peak id, across all 10 peaks', () => {
    const heights = PEAKS.map(pixelPeakHeight);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }
  });

  it('looks a theme up by peak id, and falls back rather than throwing on an unknown one', () => {
    for (const theme of MOUNTAIN_THEMES) {
      expect(mountainThemeFor(theme.peak.id)).toBe(theme);
    }
    // A debug page or a test fixture peak must not blank the climb screen.
    expect(mountainThemeFor(999)).toBe(MOUNTAIN_THEMES[0]);
  });

  it('stays within the intended 14-22 pixel range for every peak', () => {
    for (const peak of PEAKS) {
      const height = pixelPeakHeight(peak);
      expect(height).toBeGreaterThanOrEqual(14);
      expect(height).toBeLessThanOrEqual(22);
    }
  });

  it('is driven by peak id, not peak.height (a pacing-tuning number that no longer rises with peak order)', () => {
    // Peak 9 has a low pacing `height` (tuned against the pacing simulation
    // for its own, slower question type) but a high `id` — its mountain
    // must still be taller than an earlier peak's, not shorter.
    const peak9 = PEAKS.find((p) => p.id === 9);
    const peak3 = PEAKS.find((p) => p.id === 3);
    if (!peak9 || !peak3) throw new Error('expected peaks 3 and 9 to exist');
    expect(peak9.height).toBeLessThan(peak3.height);
    expect(pixelPeakHeight(peak9)).toBeGreaterThan(pixelPeakHeight(peak3));
  });
});
