import { PEAKS, type Peak } from '../../engine/peaks';

/** Everything the 3D scenes need to colour one peak. Hex strings, so the same
 * values work for three.js materials, CSS gradients and SVG. */
export interface PeakTheme {
  peak: Peak;
  rock: string;
  rockDark: string;
  snow: string;
  skyTop: string;
  skyBottom: string;
  fog: string;
  tree: string;
  treeDark: string;
  ground: string;
  flag: string;
  /** Daylight 0 (dusk) … 1 (noon) — scales the key light. */
  daylight: number;
  /** Ambient falling particles during the climb. */
  weather: 'none' | 'snow' | 'leaves';
}

type Palette = Omit<PeakTheme, 'peak'>;

const PALETTES: Readonly<Record<number, Palette>> = {
  1: {
    rock: '#8d8275',
    rockDark: '#5e564c',
    snow: '#f6f6f2',
    skyTop: '#4f8fd6',
    skyBottom: '#cfe6ff',
    fog: '#cfe6ff',
    tree: '#4f8a4a',
    treeDark: '#2f5e31',
    ground: '#6fa05a',
    flag: '#e2552f',
    daylight: 1,
    weather: 'none',
  },
  2: {
    rock: '#b0785a',
    rockDark: '#7a4e37',
    snow: '#fdeec9',
    skyTop: '#f08a4b',
    skyBottom: '#ffd9a0',
    fog: '#ffd9a0',
    tree: '#6d8f3e',
    treeDark: '#45622a',
    ground: '#9a9a4a',
    flag: '#ffd13b',
    daylight: 0.8,
    weather: 'none',
  },
  3: {
    rock: '#5f7576',
    rockDark: '#3c4d4e',
    snow: '#eaf8f8',
    skyTop: '#3d7ab8',
    skyBottom: '#b7dceb',
    fog: '#b7dceb',
    tree: '#3f7f66',
    treeDark: '#275542',
    ground: '#5c9466',
    flag: '#ff6b6b',
    daylight: 0.9,
    weather: 'leaves',
  },
  4: {
    rock: '#c2a06b',
    rockDark: '#8a6f45',
    snow: '#fff5dc',
    skyTop: '#6ea0e0',
    skyBottom: '#f2e3c3',
    fog: '#f2e3c3',
    tree: '#7fa14c',
    treeDark: '#526b2f',
    ground: '#b9a86a',
    flag: '#3b82f6',
    daylight: 1,
    weather: 'none',
  },
  5: {
    rock: '#8e8e80',
    rockDark: '#5e5e53',
    snow: '#f0f2ea',
    skyTop: '#5577aa',
    skyBottom: '#d4dde6',
    fog: '#d4dde6',
    tree: '#4e7f4e',
    treeDark: '#2e4f2e',
    ground: '#6f9a63',
    flag: '#f59e0b',
    daylight: 0.85,
    weather: 'none',
  },
  6: {
    rock: '#a35b47',
    rockDark: '#6e3a2b',
    snow: '#f9e2d6',
    skyTop: '#d9634b',
    skyBottom: '#ffc9a3',
    fog: '#ffc9a3',
    tree: '#5f8a45',
    treeDark: '#3c5c2b',
    ground: '#9c7f52',
    flag: '#22d3ee',
    daylight: 0.7,
    weather: 'leaves',
  },
  7: {
    rock: '#6c8191',
    rockDark: '#45555f',
    snow: '#e4f2f8',
    skyTop: '#2f5f99',
    skyBottom: '#a9c9e3',
    fog: '#a9c9e3',
    tree: '#3b6f5c',
    treeDark: '#254a3c',
    ground: '#4f8a6e',
    flag: '#f472b6',
    daylight: 0.8,
    weather: 'snow',
  },
  8: {
    rock: '#7f6a46',
    rockDark: '#53442b',
    snow: '#fff1c6',
    skyTop: '#f6a23a',
    skyBottom: '#ffe3a6',
    fog: '#ffe3a6',
    tree: '#7c8f3a',
    treeDark: '#4f5d25',
    ground: '#a89550',
    flag: '#10b981',
    daylight: 0.75,
    weather: 'leaves',
  },
  9: {
    rock: '#625d7c',
    rockDark: '#403c54',
    snow: '#dcdff6',
    skyTop: '#2a2f6b',
    skyBottom: '#8e95d6',
    fog: '#8e95d6',
    tree: '#375a60',
    treeDark: '#223c40',
    ground: '#4d6d73',
    flag: '#facc15',
    daylight: 0.55,
    weather: 'snow',
  },
  10: {
    rock: '#6d5a88',
    rockDark: '#4a3a5f',
    snow: '#ede4fb',
    skyTop: '#3b1f5e',
    skyBottom: '#c89ee0',
    fog: '#c89ee0',
    tree: '#3c5f5a',
    treeDark: '#243f3b',
    ground: '#55786f',
    flag: '#fb7185',
    daylight: 0.6,
    weather: 'snow',
  },
};

export const PEAK_THEMES: readonly PeakTheme[] = PEAKS.map((peak) => {
  const palette = PALETTES[peak.id];
  if (!palette) throw new Error(`peakThemes: no palette for peak id ${peak.id}`);
  return { peak, ...palette };
});

export function peakTheme(peakId: number): PeakTheme {
  const theme = PEAK_THEMES.find((entry) => entry.peak.id === peakId);
  if (!theme) throw new Error(`peakTheme: no theme for peak id ${peakId}`);
  return theme;
}
