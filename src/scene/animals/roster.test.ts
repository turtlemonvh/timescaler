import { describe, expect, it } from 'vitest';
import {
  ANIMALS,
  DEFAULT_ANIMAL,
  LEGACY_CHARACTER_ANIMALS,
  isAnimalId,
  modelUrl,
  resolveAnimal,
} from './roster';

describe('roster', () => {
  it('has six animals with unique ids', () => {
    expect(ANIMALS).toHaveLength(6);
    expect(new Set(ANIMALS.map((a) => a.id)).size).toBe(6);
  });

  it('maps every legacy pixel character onto a distinct animal', () => {
    const legacy = Object.values(LEGACY_CHARACTER_ANIMALS);
    expect(legacy).toHaveLength(6);
    expect(new Set(legacy).size).toBe(6);
    for (const id of legacy) expect(isAnimalId(id)).toBe(true);
  });

  it('resolves current ids, legacy ids and garbage without throwing', () => {
    expect(resolveAnimal('stag').id).toBe('stag');
    expect(resolveAnimal('sunny').id).toBe(LEGACY_CHARACTER_ANIMALS.sunny);
    expect(resolveAnimal('definitely-not-an-animal').id).toBe(DEFAULT_ANIMAL);
    expect(resolveAnimal('').id).toBe(DEFAULT_ANIMAL);
  });

  it('builds model urls under the Vite base path', () => {
    expect(modelUrl('fox')).toBe(`${import.meta.env.BASE_URL}models/fox.glb`);
  });
});
