import type { ClimbState } from '../../engine/climb';

/**
 * What the scene should play for one answer, derived from the before/after
 * `ClimbState` pair rather than from "correct"/"wrong". The scene cannot
 * show a hop the rules did not grant, and a boosted double step is visibly
 * two ledges because `steps` says so.
 */
export type MoveKind = 'hop' | 'slip' | 'fall' | 'summit' | 'none';

export interface ClimbMove {
  /** Monotonic, so two identical moves in a row still re-trigger the animation. */
  id: number;
  kind: MoveKind;
  from: number;
  to: number;
  /** Ledges travelled (0 for `none`/`fall`). */
  steps: number;
  /** A fast answer: bigger hop, sparkle, brighter sound. */
  fast: boolean;
}

export function describeMove(
  before: ClimbState,
  after: ClimbState,
  fast: boolean,
  id: number,
): ClimbMove {
  const base = { id, from: before.position, to: after.position, fast };
  if (after.status === 'fell') return { ...base, kind: 'fall', to: 0, steps: 0 };
  if (after.status === 'summited') {
    return { ...base, kind: 'summit', steps: after.position - before.position };
  }
  if (after.position > before.position) {
    return { ...base, kind: 'hop', steps: after.position - before.position };
  }
  if (after.position < before.position) {
    return { ...base, kind: 'slip', steps: before.position - after.position };
  }
  // A miss at the base: nothing to slide down to. Still a miss, so the
  // climber reacts, but it stays put.
  if (after.fallRisk > before.fallRisk) return { ...base, kind: 'slip', steps: 0 };
  return { ...base, kind: 'none', steps: 0 };
}

export const HOP_MS = 480;
export const EXTRA_STEP_MS = 320;
export const SLIP_MS = 620;
export const FALL_MS = 1500;
export const SUMMIT_HOP_MS = 700;

/** How long the scene needs to play a move before the next question is fair game. */
export function moveDurationMs(move: ClimbMove): number {
  switch (move.kind) {
    case 'hop':
      return HOP_MS + EXTRA_STEP_MS * Math.max(0, move.steps - 1);
    case 'summit':
      return SUMMIT_HOP_MS + EXTRA_STEP_MS * Math.max(0, move.steps - 1);
    case 'slip':
      return SLIP_MS;
    case 'fall':
      return FALL_MS;
    case 'none':
      return 0;
  }
}

/** 0..1 progress up the wall for the HUD and the camera's long-range framing. */
export function stageFraction(state: Pick<ClimbState, 'position' | 'height' | 'status'>): number {
  if (state.status === 'fell') return 0;
  if (state.height <= 0) return 0;
  return Math.max(0, Math.min(1, state.position / state.height));
}
