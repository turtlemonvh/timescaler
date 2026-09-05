import type { SpritePose } from './manifest';

/**
 * Which frame of `pose` is showing `elapsedMs` after the pose started.
 *
 * Deliberately pure and time-as-an-argument: jsdom has no WebGL and only a
 * canvas 2D stub, so all animation logic in this project has to be testable as
 * a function of state and time rather than by rendering and looking.
 *
 * - Looping poses (idle, move) wrap forever.
 * - Non-looping poses (hurt, celebrate-once) hold their last frame.
 * - Time before the pose started, or a single-frame pose, is frame 0.
 */
export function frameAt(pose: SpritePose, elapsedMs: number): number {
  const count = pose.frames.length;
  if (count <= 1) return 0;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;

  const step = Math.floor((elapsedMs * pose.fps) / 1000);
  if (!pose.loop) return Math.min(step, count - 1);
  return step % count;
}

/** How long one full pass through `pose` takes, in ms. */
export function poseDurationMs(pose: SpritePose): number {
  return (pose.frames.length / pose.fps) * 1000;
}
