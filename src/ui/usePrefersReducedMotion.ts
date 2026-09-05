import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function reducedMotionQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  if (query === null || typeof query.addEventListener !== 'function') return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function snapshot(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

/**
 * Reads `prefers-reduced-motion`, and keeps up if it changes mid-session.
 *
 * A missing or listener-less `matchMedia` means "animate", which is what every
 * CSS animation in `index.css` already does — the media query there is
 * `no-preference`, so an environment that reports nothing gets motion.
 *
 * Lives here rather than inside one component because both `SpriteAnimator`
 * (which swaps to a static frame plus a label) and `ClimbStage` (which makes
 * position changes instant) need the same answer, and they must not disagree.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
