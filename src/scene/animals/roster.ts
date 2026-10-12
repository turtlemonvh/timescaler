/**
 * The playable animals. Six, so the six legacy pixel-character ids a save
 * file may still carry (`sunny` … `clover`) map 1:1 onto animals and an old
 * profile keeps a stable climber instead of crashing or silently changing.
 */
export type AnimalId = 'fox' | 'deer' | 'stag' | 'wolf' | 'alpaca' | 'husky';

export interface Animal {
  id: AnimalId;
  name: string;
  /** One line a 7-year-old can read on the pick screen. */
  tagline: string;
  /** Target height in scene units; the model is normalized to this on load. */
  height: number;
  /** Accent colour used for the pick-screen card and the HUD chip. */
  accent: string;
}

export const ANIMALS: readonly Animal[] = [
  { id: 'fox', name: 'Fox', tagline: 'Quick and clever', height: 1.0, accent: '#e07a3f' },
  { id: 'deer', name: 'Deer', tagline: 'Light on her feet', height: 1.35, accent: '#b98557' },
  {
    id: 'stag',
    name: 'Stag',
    tagline: 'Big antlers, bigger heart',
    height: 1.6,
    accent: '#8a5a3b',
  },
  { id: 'wolf', name: 'Wolf', tagline: 'Never gives up', height: 1.1, accent: '#7d8597' },
  { id: 'alpaca', name: 'Alpaca', tagline: 'Born for mountains', height: 1.4, accent: '#d8c3a5' },
  { id: 'husky', name: 'Husky', tagline: 'Loves the snow', height: 1.05, accent: '#5d8aa8' },
];

/** Pixel-era `characterId`s that may still be in a save file. */
export const LEGACY_CHARACTER_ANIMALS: Readonly<Record<string, AnimalId>> = {
  sunny: 'fox',
  juniper: 'deer',
  boulder: 'stag',
  ember: 'wolf',
  frost: 'husky',
  clover: 'alpaca',
};

export const DEFAULT_ANIMAL: AnimalId = 'fox';

export function isAnimalId(value: string): value is AnimalId {
  return ANIMALS.some((animal) => animal.id === value);
}

/**
 * Resolves whatever `Profile.characterId` holds — a current animal id, a
 * legacy pixel-character id, or garbage from a hand-edited import — to an
 * animal. Never throws: an unknown id falls back to the default animal, which
 * is the right failure mode for a save file (keep playing) rather than the
 * old `getCharacterPreset` behaviour of crashing the whole app.
 */
export function resolveAnimal(characterId: string): Animal {
  const id = isAnimalId(characterId)
    ? characterId
    : (LEGACY_CHARACTER_ANIMALS[characterId] ?? DEFAULT_ANIMAL);
  return ANIMALS.find((animal) => animal.id === id) ?? ANIMALS[0];
}

/** Deployed path of an animal's GLB, honouring Vite's base path (GitHub Pages serves under a prefix). */
export function modelUrl(id: AnimalId): string {
  return `${import.meta.env.BASE_URL}models/${id}.glb`;
}
