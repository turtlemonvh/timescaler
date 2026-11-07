/**
 * Capture scenarios. Each one plays identically on any build, so the same
 * scenario filmed on `main` and on a branch lines up frame for frame.
 *
 * `/debug/trailer?shot=` scenarios replay the trailer's scripted takes (real
 * screens, real HUD). `/debug/scene` scenarios drive the debug stage's own
 * controls by label and button text, with the control bar hidden. Times are
 * virtual milliseconds from the first recorded frame.
 */

export type Action =
  | { at?: number; do: 'select'; label: string; value: string | number }
  | { at?: number; do: 'click'; text: string };

export interface Scenario {
  about: string;
  url: string;
  viewport: { width: number; height: number };
  seconds: number;
  /** Times (ms) to also save as full-quality PNG stills. */
  stills?: number[];
  /** Actions applied before warm-up (`/debug/scene` only). */
  setup?: Action[];
  /** Timed actions during recording. */
  steps?: Action[];
  css?: string;
}

const HIDE_CONTROLS = '.debug-scene__controls{opacity:0!important;pointer-events:none}';
const square = { width: 720, height: 720 };
const wide = { width: 1280, height: 720 };
const phone = { width: 390, height: 844 };

const clicks = (count: number, gap = 900, start = 400, text = 'Correct'): Action[] =>
  Array.from({ length: count }, (_, i) => ({ at: start + i * gap, do: 'click', text }));

function scene(
  about: string,
  view: 'climb' | 'map' | 'pick',
  options: Partial<Scenario> & { setup?: Action[] },
): Scenario {
  return {
    about,
    url: '/debug/scene',
    css: HIDE_CONTROLS,
    viewport: square,
    seconds: 6,
    stills: [0, 1500, 3000, 5000],
    ...options,
    setup: [{ do: 'select', label: 'View', value: view }, ...(options.setup ?? [])],
  };
}

function climb(
  peak: number,
  animal: string,
  options: Partial<Scenario> & { about?: string } = {},
): Scenario {
  return scene(options.about ?? `climb peak ${peak} as ${animal}`, 'climb', {
    steps: clicks(5),
    ...options,
    setup: [
      { do: 'select', label: 'Peak', value: peak },
      { do: 'select', label: 'Animal', value: animal },
      ...(options.setup ?? []),
    ],
  });
}

const take = (
  shot: string,
  about: string,
  viewport: Scenario['viewport'],
  seconds: number,
  stills: number[],
): Scenario => ({
  about,
  url: `/debug/trailer?shot=${shot}`,
  viewport,
  seconds,
  stills,
});

const nearSummit: Action[] = [
  { at: 200, do: 'click', text: 'Near summit' },
  { at: 900, do: 'click', text: 'Correct' },
];
const slowSlip: Partial<Scenario> = {
  setup: [{ do: 'select', label: 'Speed', value: 0.25 }],
  steps: [...clicks(1), { at: 3000, do: 'click', text: 'Miss' }],
  seconds: 9,
  stills: [3600, 4400, 5200, 6000],
};

export const SCENARIOS: Record<string, Scenario> = {
  'trailer-fox-climb': take(
    'fox-climb',
    'trailer take: fox climbs peak 1',
    square,
    4,
    [800, 2000, 3500],
  ),
  'trailer-deer-slip': take(
    'deer-slip',
    'trailer take: deer slips on peak 3',
    square,
    3.5,
    [600, 1000, 1500, 3000],
  ),
  'trailer-wolf-summit': take(
    'wolf-summit',
    'trailer take: wolf summits peak 8',
    square,
    6,
    [500, 1500, 3000, 5500],
  ),
  'trailer-map-sweep': take('map-sweep', 'trailer take: map sweep', square, 6, [900, 2400, 4600]),
  'trailer-map-wide': take(
    'map-wide',
    'trailer take: wide map sweep',
    wide,
    5.5,
    [700, 2200, 4500],
  ),
  'trailer-game': take(
    'game',
    'trailer take: real Climb screen with HUD and card',
    wide,
    17,
    [1000, 4000, 8000, 12000, 16000],
  ),
  'trailer-pick': take(
    'pick',
    'trailer take: character pick',
    { width: 960, height: 900 },
    5,
    [500, 2000, 4000],
  ),
  'trailer-summit': take('summit', 'trailer take: summit screen', wide, 6, [1000, 2500, 4000]),
  'game-square': take(
    'game',
    'trailer game take at 720x720 (card on the right)',
    square,
    10,
    [1000, 4000, 8000],
  ),

  // Every peak theme (weather, birds, light differ per peak) and every animal.
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => [`climb-peak${p}-fox`, climb(p, 'fox')]),
  ),
  ...Object.fromEntries(
    ['deer', 'stag', 'wolf', 'alpaca', 'husky'].map((a) => [`climb-peak1-${a}`, climb(1, a)]),
  ),
  'climb-wide': climb(1, 'fox', {
    about: 'climb peak 1 as fox at 1280x720',
    viewport: wide,
    steps: clicks(8),
    seconds: 9,
  }),
  'climb-phone': climb(2, 'alpaca', {
    about: 'phone-portrait climb, peak 2 as alpaca',
    viewport: phone,
  }),
  'climb-fast-boost': climb(4, 'stag', {
    about: 'boosted fast hops on peak 4 as stag',
    steps: [{ at: 200, do: 'click', text: 'Fill boost' }, ...clicks(5, 700, 400, 'Fast correct')],
  }),
  'climb-slip-fall': climb(6, 'wolf', {
    about: 'two hops, then misses until a fall, peak 6 as wolf',
    steps: [...clicks(2), ...clicks(6, 700, 2400, 'Miss')],
    seconds: 8,
  }),
  'climb-fell': climb(6, 'wolf', {
    about: 'misses until a fall, held into the Fell phase, peak 6 as wolf',
    steps: clicks(6, 1700, 400, 'Miss'),
    seconds: 12,
    stills: [6000, 9000, 11500],
  }),
  'slip-slow-deer': climb(3, 'deer', {
    about: 'a hop then a slip on peak 3 as deer, at 1/4 speed',
    ...slowSlip,
  }),
  'slip-slow-stag': climb(1, 'stag', {
    about: 'a hop then a slip on peak 1 as stag, at 1/4 speed',
    ...slowSlip,
  }),
  'climb-summit': climb(10, 'husky', {
    about: 'summit on peak 10 as husky',
    steps: nearSummit,
    stills: [1500, 3000, 4500, 5800],
  }),
  'climb-summit-wide': climb(8, 'fox', {
    about: 'summit on peak 8 as fox at 1280x720',
    viewport: wide,
    steps: nearSummit,
    seconds: 7,
    stills: [1500, 3000, 4500, 6500],
  }),

  'map-tour': scene('map: select each peak in turn as deer', 'map', {
    viewport: wide,
    setup: [{ do: 'select', label: 'Animal', value: 'deer' }],
    steps: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1].map((p, i) => ({
      at: 400 + i * 1000,
      do: 'select',
      label: 'Peak',
      value: p,
    })),
    seconds: 11,
    stills: [300, 1900, 3900, 5900, 7900, 9900],
  }),
  'map-phone': scene('map on a phone, hopping 1→5→9→2 as wolf', 'map', {
    viewport: phone,
    setup: [{ do: 'select', label: 'Animal', value: 'wolf' }],
    steps: [5, 9, 2].map((p, i) => ({ at: 400 + i * 1500, do: 'select', label: 'Peak', value: p })),
    seconds: 5.5,
    stills: [300, 1200, 2700, 4200],
  }),
  'pick-grid': scene('all six pick-screen turntables', 'pick', {
    viewport: { width: 1200, height: 800 },
    seconds: 4,
    stills: [500, 2500],
  }),
};
