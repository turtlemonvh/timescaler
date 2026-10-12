/**
 * Game poses → glTF clip names. The Quaternius pack is consistent in spirit
 * but not in spelling (`Jump_ToIdle` on the fox, `Jump_toIdle` on the deer;
 * `Attack` on the fox, `Attack_Headbutt` on the deer), so each pose lists
 * candidates and `resolveClip` takes the first one a given model actually
 * has, matched case-insensitively. Clips not listed here are stripped from
 * the shipped models by `scripts/prepare-models.ts`.
 */
export type Pose = 'idle' | 'look' | 'walk' | 'run' | 'jump' | 'land' | 'hit' | 'fall' | 'cheer';

export const POSE_CLIPS: Readonly<Record<Pose, readonly string[]>> = {
  idle: ['Idle'],
  look: ['Idle_2'],
  walk: ['Walk'],
  run: ['Gallop'],
  jump: ['Gallop_Jump'],
  land: ['Jump_ToIdle', 'Jump_toIdle'],
  hit: ['Idle_HitReact_Left'],
  fall: ['Death'],
  cheer: ['Attack', 'Attack_Headbutt'],
};

/** Poses that play once and then hand back to `idle`, rather than looping. */
export const ONE_SHOT_POSES: ReadonlySet<Pose> = new Set<Pose>(['jump', 'land', 'hit', 'cheer']);

/** `fall` plays once and holds its last frame (the animal stays down). */
export const HOLD_LAST_FRAME_POSES: ReadonlySet<Pose> = new Set<Pose>(['fall']);

export function resolveClip(pose: Pose, available: readonly string[]): string | undefined {
  const lower = new Map(available.map((name) => [name.toLowerCase(), name]));
  for (const candidate of POSE_CLIPS[pose]) {
    const hit = lower.get(candidate.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}
