import * as THREE from 'three';

/**
 * Applies loop/clamp/speed settings to a three.js AnimationAction. Lives
 * outside the component so the React compiler lint does not treat the
 * action (a hook result) as something render code is mutating.
 */
export function configureAction(
  action: THREE.AnimationAction,
  options: { once: boolean; fitMs?: number; timeScale: number },
): void {
  const clipSeconds = action.getClip().duration;
  action.reset();
  action.setLoop(options.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = options.once;
  action.timeScale =
    options.fitMs && clipSeconds > 0 ? clipSeconds / (options.fitMs / 1000) : options.timeScale;
}
