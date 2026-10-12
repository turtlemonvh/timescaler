import { lazy } from 'react';

/**
 * Code-split entry points for everything that pulls in three.js. The intro,
 * profile and review screens render from the main bundle; the first scene
 * that mounts loads the three.js chunk. Screens import from here, and
 * `src/setupTests.ts` mocks this module for jsdom.
 */
export const ClimbScene = lazy(() => import('./climb/ClimbScene'));
export const MapScene = lazy(() => import('./map/MapScene'));
export const AnimalShowcase = lazy(() => import('./pedestal/AnimalShowcase'));
