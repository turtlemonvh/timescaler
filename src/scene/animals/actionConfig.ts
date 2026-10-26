import * as THREE from 'three';

/**
 * Applies loop/clamp/speed settings to a three.js AnimationAction and starts
 * it (fading in unless it is already the visible clip). Lives
 * outside the component so the React compiler lint does not treat the
 * action (a hook result) as something render code is mutating.
 */
export function configureAction(
  action: THREE.AnimationAction,
  options: {
    once: boolean;
    fitMs?: number;
    timeScale: number;
    /** Freeze the clip at this fraction (a held pose, e.g. mid-leap). */
    hold?: number;
    /** Start the clip at this fraction; `fitMs` then covers the rest of it. */
    startAt?: number;
  },
): void {
  const clipSeconds = action.getClip().duration;
  // Re-triggering the clip that is already showing (a double hop, a leap
  // into a held reach): carry on at full weight. Fading it in from zero
  // would blend the model's bind pose — a stiff standing animal — in for the
  // length of the fade, which is most of a short segment.
  const live = action.isScheduled() && action.getEffectiveWeight() > 0.5;
  const startAt = Math.max(0, Math.min(1, options.hold ?? options.startAt ?? 0));
  action.reset();
  action.setLoop(options.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = options.once;
  const remaining = clipSeconds * (1 - startAt);
  action.timeScale =
    options.fitMs && remaining > 0 ? remaining / (options.fitMs / 1000) : options.timeScale;
  // Just short of the end, so a held last frame does not count as finished.
  action.time = Math.min(clipSeconds * startAt, clipSeconds * 0.999);
  action.paused = options.hold !== undefined;
  if (live) action.setEffectiveWeight(1).play();
  else action.fadeIn(0.12).play();
}

/** Keeps a mixer's playback rate in step with the scene time scale. */
export function syncMixerTimeScale(mixer: THREE.AnimationMixer, scale: number): void {
  if (mixer.timeScale !== scale) mixer.timeScale = scale;
}
