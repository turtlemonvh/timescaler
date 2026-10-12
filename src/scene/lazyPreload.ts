import type { AnimalId } from './animals/roster';

/** Starts fetching the three.js chunk and an animal's model without blocking the main bundle. */
export function preloadAnimal(id: AnimalId): void {
  void import('./animals/preload').then((module) => module.preloadAnimal(id));
}
