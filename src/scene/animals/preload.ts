import { useGLTF } from '@react-three/drei';
import { modelUrl, type AnimalId } from './roster';

/** Starts fetching an animal's GLB so the first scene that needs it does not wait. */
export function preloadAnimal(id: AnimalId): void {
  useGLTF.preload(modelUrl(id), false, true);
}
