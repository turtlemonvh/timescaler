/**
 * The scene's notion of time. Everything time-based in the scenes (tweens,
 * idle timers, clip playback) reads through here so the dev-only
 * `/debug/scene` page can slow the whole climb down for reviewing an
 * animation frame by frame. Production never changes the scale.
 */
let timeScale = 1;
let scaledOrigin = 0;
let realOrigin = 0;

export function getSceneTimeScale(): number {
  return timeScale;
}

export function setSceneTimeScale(scale: number): void {
  // Re-anchor so the scaled clock stays continuous across a change.
  scaledOrigin = sceneNow();
  realOrigin = performance.now();
  timeScale = Math.max(0.05, scale);
}

/** Milliseconds, like `performance.now()`, but running at the scene time scale. */
export function sceneNow(): number {
  return scaledOrigin + (performance.now() - realOrigin) * timeScale;
}

/** A frame delta (seconds) scaled the same way. */
export function sceneDelta(delta: number): number {
  return delta * timeScale;
}
