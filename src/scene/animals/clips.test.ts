import { describe, expect, it } from 'vitest';
import { HOLD_LAST_FRAME_POSES, ONE_SHOT_POSES, POSE_CLIPS, resolveClip, type Pose } from './clips';

const FOX = [
  'Attack',
  'Death',
  'Eating',
  'Gallop',
  'Gallop_Jump',
  'Idle',
  'Idle_2',
  'Idle_2_HeadLow',
  'Idle_HitReact_Left',
  'Idle_HitReact_Right',
  'Jump_ToIdle',
  'Walk',
];
const DEER = [
  'Attack_Headbutt',
  'Attack_Kick',
  'Death',
  'Eating',
  'Gallop',
  'Gallop_Jump',
  'Idle',
  'Idle_2',
  'Idle_Headlow',
  'Idle_HitReact_Left',
  'Idle_HitReact_Right',
  'Jump_toIdle',
  'Walk',
];

describe('clips', () => {
  it('resolves every pose on both clip-naming variants in the pack', () => {
    for (const pose of Object.keys(POSE_CLIPS) as Pose[]) {
      expect(resolveClip(pose, FOX), `fox ${pose}`).toBeDefined();
      expect(resolveClip(pose, DEER), `deer ${pose}`).toBeDefined();
    }
  });

  it('is case-insensitive and returns the model’s own spelling', () => {
    expect(resolveClip('land', FOX)).toBe('Jump_ToIdle');
    expect(resolveClip('land', DEER)).toBe('Jump_toIdle');
  });

  it('returns undefined when a model lacks the clip', () => {
    expect(resolveClip('jump', ['Idle'])).toBeUndefined();
  });

  it('keeps one-shot and hold poses disjoint', () => {
    for (const pose of HOLD_LAST_FRAME_POSES) expect(ONE_SHOT_POSES.has(pose)).toBe(false);
  });
});
