import type { ClimbStatus } from '../../engine/climb';

/**
 * Every timing and mapping decision the climb stage makes, as pure functions
 * of climb state and elapsed time.
 *
 * The split this file exists to enforce is **movement is where, animation is
 * what**: these functions only ever produce a *destination*
 * (`--climb-progress`) and a *duration* (`--climb-move-ms`) for the outer,
 * moving element. The pose itself — squash-and-stretch, hurt, celebrate — is a
 * keyframe animation on a separate inner element, and never composes onto the
 * element carrying the translate. Doing both on one element reproduces the
 * Chromium compositing smear root-caused in PR #84.
 *
 * Keeping it all pure is also the only way any of it is checkable here: jsdom
 * has no WebGL and only a canvas 2D stub, so "does the character end up in the
 * right place at the right time" has to be answerable without rendering.
 */

/** What just happened to the climber, in animation terms. */
export type MoveKind = 'none' | 'hop' | 'bigHop' | 'drop' | 'fall' | 'summit';

/**
 * The last thing that happened to the climber, plus a sequence number.
 *
 * The number is what re-triggers the animation: two misses in a row produce
 * the same `kind`, and without a changing identity React would see no prop
 * change and the second drop would never play.
 */
export interface ClimbStageMove {
  kind: MoveKind;
  seq: number;
}

/** Nothing has happened yet — a fresh climb, or the gap between questions. */
export const NO_MOVE: ClimbStageMove = { kind: 'none', seq: 0 };

/** Where a move is in its life: still travelling, or arrived and idling. */
export type StagePhase = 'moving' | 'settled';

/** Sprite pose names — the four every normalized animal must provide (#93). */
export type StagePose = 'idle' | 'move' | 'hurt' | 'celebrate';

/** One hop between holds. The issue's ~400ms. */
export const HOP_MS = 400;
/** A fast (boost-earning) correct answer gets a bigger, slightly slower hop. */
export const BIG_HOP_MS = 520;
/**
 * A miss drops back one hold. The issue's ~500ms — deliberately slower than a
 * hop so the loss reads as heavier than the gain even though the game rules
 * make the two the same size (`docs/fun-bar.md` F8).
 */
export const DROP_MS = 500;
/** A fall comes off the wall entirely, so it needs longer than a drop. */
export const FALL_MS = 800;
/** The last hop onto the summit, held a beat longer for the celebrate pose. */
export const SUMMIT_MS = 600;
/**
 * With `prefers-reduced-motion: reduce` the position change is instant; the
 * inner element crossfades over this instead, so the jump is still noticed
 * (`docs/fun-bar.md` F15).
 */
export const REDUCED_CROSSFADE_MS = 140;

/** Progress bands, so the top and bottom of the wall read differently. */
export type WallBand = 'base' | 'middle' | 'summit';

const BAND_BOUNDARIES: readonly [number, number] = [1 / 3, 2 / 3];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * `position / height`, clamped to 0..1 and safe at `height === 0` — the raw
 * mapping behind the `--climb-progress` custom property.
 */
export function progressFraction(position: number, height: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(height) || height <= 0) return 0;
  return clamp01(position / height);
}

/**
 * Where the climber is *drawn*, which is not always `position / height`: a
 * fall leaves `position` untouched in `climb.ts` (the state machine only flips
 * `status` to `fell`), but the character has visibly come off the wall, so the
 * stage draws them back at the base.
 */
export function stageFraction(state: {
  position: number;
  height: number;
  status: ClimbStatus;
}): number {
  if (state.status === 'fell') return 0;
  return progressFraction(state.position, state.height);
}

/** Which of the wall's three bands a progress fraction falls in. */
export function wallBand(fraction: number): WallBand {
  const clamped = clamp01(fraction);
  if (clamped < BAND_BOUNDARIES[0]) return 'base';
  if (clamped < BAND_BOUNDARIES[1]) return 'middle';
  return 'summit';
}

/**
 * The move a `climb.ts` transition should be animated as.
 *
 * Reads only the before/after states plus whether the answer was fast, so it
 * stays honest about game balance: it cannot invent a move the state machine
 * did not make.
 */
export function moveKindFor(
  before: { position: number; status: ClimbStatus },
  after: { position: number; status: ClimbStatus },
  options: { fast?: boolean } = {},
): MoveKind {
  if (after.status === 'fell') return 'fall';
  if (after.status === 'summited') return 'summit';
  if (after.position > before.position) {
    // Two positions at once means the boost fired; so does a fast answer.
    return after.position - before.position > 1 || options.fast === true ? 'bigHop' : 'hop';
  }
  if (after.position < before.position) return 'drop';
  return 'none';
}

/** How long `kind` takes to travel, honouring `prefers-reduced-motion`. */
export function moveDurationMs(kind: MoveKind, reducedMotion: boolean): number {
  if (kind === 'none') return 0;
  if (reducedMotion) return REDUCED_CROSSFADE_MS;
  switch (kind) {
    case 'hop':
      return HOP_MS;
    case 'bigHop':
      return BIG_HOP_MS;
    case 'drop':
      return DROP_MS;
    case 'fall':
      return FALL_MS;
    case 'summit':
      return SUMMIT_MS;
  }
}

/**
 * Whether a move started `elapsedMs` ago is still travelling.
 *
 * `ClimbStage` recomputes this from the real clock when its settle timer
 * fires, rather than assuming the timer was punctual — which is what makes it
 * worth having as a function of time at all.
 */
export function phaseAt(kind: MoveKind, elapsedMs: number, reducedMotion: boolean): StagePhase {
  if (kind === 'none' || !Number.isFinite(elapsedMs)) return 'settled';
  return elapsedMs < moveDurationMs(kind, reducedMotion) ? 'moving' : 'settled';
}

/**
 * The sprite pose to show. While a move is travelling the pose describes the
 * move; once settled it describes the climb's own status, so a summit holds
 * `celebrate` and a fall holds `hurt` rather than snapping back to `idle`.
 */
export function stagePose(kind: MoveKind, phase: StagePhase, status: ClimbStatus): StagePose {
  if (phase === 'moving') {
    switch (kind) {
      case 'hop':
      case 'bigHop':
        return 'move';
      case 'drop':
      case 'fall':
        return 'hurt';
      case 'summit':
        return 'celebrate';
      case 'none':
        break;
    }
  }
  if (status === 'summited') return 'celebrate';
  if (status === 'fell') return 'hurt';
  return 'idle';
}

/**
 * The custom properties the stage hands to CSS. Strings, because that is what
 * `style` takes — and producing both from one function means the destination
 * and the duration can never drift apart.
 */
export interface StageVars {
  '--climb-progress': string;
  '--climb-move-ms': string;
}

export function stageVars(fraction: number, kind: MoveKind, reducedMotion: boolean): StageVars {
  return {
    '--climb-progress': String(clamp01(fraction)),
    '--climb-move-ms': `${moveDurationMs(kind, reducedMotion)}ms`,
  };
}
