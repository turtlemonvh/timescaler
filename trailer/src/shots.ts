/** Shared by the recorder and the Remotion compositions. */
export const FPS = 30;

interface Shot {
  width: number;
  height: number;
  /** Device pixel ratio, so frames come out sharper than the layout size. */
  scale: number;
  seconds: number;
}

const square = { width: 540, height: 540, scale: 2 };
const wide = { width: 1280, height: 720, scale: 1.5 };

export const SHOTS = {
  'fox-climb': { ...square, seconds: 4 },
  'deer-slip': { ...square, seconds: 3.5 },
  'wolf-summit': { ...square, seconds: 6 },
  'map-sweep': { ...square, seconds: 6 },
  game: { ...wide, seconds: 17 },
  // Taller than 16:9 so all six cards fit; the trailer letterboxes it.
  pick: { width: 960, height: 900, scale: 1.5, seconds: 5 },
  'map-wide': { ...wide, seconds: 5.5 },
  summit: { ...wide, seconds: 6 },
} satisfies Record<string, Shot>;

export type ShotId = keyof typeof SHOTS;
