import '@testing-library/jest-dom/vitest';
import { createElement } from 'react';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// `vite.config.ts` sets `test.globals: false`, so RTL's automatic
// cleanup-between-tests never attaches on its own.
afterEach(() => {
  cleanup();
});

// jsdom has no WebGL, so the three.js scenes are replaced wholesale with DOM
// stubs that expose their props as data attributes. Screen tests then assert
// *what the scene was asked to do* (phase, position, last move); the scenes
// themselves are verified visually from the dev server and their pure
// helpers (cliff path, move description, themes, layout) have real tests.
const ClimbSceneStub = (props: {
  peakId: number;
  animalId: string;
  position: number;
  height: number;
  move: { kind: string; steps: number; fast: boolean } | null;
  phase: string;
  boosted?: boolean;
}) =>
  createElement('div', {
    'data-testid': 'climb-scene',
    'data-peak': props.peakId,
    'data-animal': props.animalId,
    'data-position': props.position,
    'data-height': props.height,
    'data-phase': props.phase,
    'data-move': props.move?.kind ?? 'none',
    'data-move-steps': props.move?.steps ?? 0,
    'data-move-fast': props.move?.fast ? 'true' : 'false',
    'data-boosted': props.boosted ? 'true' : 'false',
  });

const MapSceneStub = (props: {
  selectedPeakId: number;
  summitedPeakIds: readonly number[];
  animalId: string;
  onSelectPeak: (peakId: number) => void;
}) =>
  createElement(
    'div',
    {
      'data-testid': 'map-scene',
      'data-selected': props.selectedPeakId,
      'data-summited': props.summitedPeakIds.join(','),
      'data-animal': props.animalId,
    },
    // A stand-in for clicking a mountain in 3D.
    createElement(
      'button',
      {
        type: 'button',
        'data-testid': 'map-scene-select-next',
        onClick: () => props.onSelectPeak(props.selectedPeakId + 1),
      },
      'next peak',
    ),
  );

const AnimalShowcaseStub = (props: { animalId: string; pose?: string }) =>
  createElement('div', {
    'data-testid': 'animal-showcase',
    'data-animal': props.animalId,
    'data-pose': props.pose ?? 'idle',
  });

vi.mock('./scene/lazy', () => ({
  ClimbScene: ClimbSceneStub,
  MapScene: MapSceneStub,
  AnimalShowcase: AnimalShowcaseStub,
}));
vi.mock('./scene/lazyPreload', () => ({ preloadAnimal: () => undefined }));

vi.mock('./scene/animals/Animal', () => ({ default: () => null }));
vi.mock('./scene/animals/preload', () => ({ preloadAnimal: () => undefined }));

// jsdom has no matchMedia; the reduced-motion hook treats a missing API as "no preference".
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
