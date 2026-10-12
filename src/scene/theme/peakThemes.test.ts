import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { PEAK_THEMES, peakTheme } from './peakThemes';

const HEX = /^#[0-9a-f]{6}$/i;

describe('peakThemes', () => {
  it('has one theme per engine peak, in order', () => {
    expect(PEAK_THEMES.map((t) => t.peak.id)).toEqual(PEAKS.map((p) => p.id));
  });

  it('uses valid hex colours everywhere and a daylight in 0..1', () => {
    for (const theme of PEAK_THEMES) {
      const { peak, daylight, weather, ...colours } = theme;
      void peak;
      expect(['none', 'snow', 'leaves']).toContain(weather);
      for (const [key, value] of Object.entries(colours)) expect(value, key).toMatch(HEX);
      expect(daylight).toBeGreaterThan(0);
      expect(daylight).toBeLessThanOrEqual(1);
    }
  });

  it('looks up by id and throws on an unknown one', () => {
    expect(peakTheme(3).peak.name).toBe(PEAKS[2].name);
    expect(() => peakTheme(99)).toThrow();
  });
});
