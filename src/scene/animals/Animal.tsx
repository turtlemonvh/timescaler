import { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { configureAction } from './actionConfig';
import { HOLD_LAST_FRAME_POSES, ONE_SHOT_POSES, resolveClip, type Pose } from './clips';
import { ANIMALS, modelUrl, type AnimalId } from './roster';

export interface AnimalProps {
  id: AnimalId;
  pose: Pose;
  /** Change this to re-trigger a one-shot pose whose name did not change. */
  poseKey?: number;
  /** Stretch or squash the clip to last this many milliseconds. */
  fitMs?: number;
  /** Playback speed when `fitMs` is not given. */
  timeScale?: number;
  onPoseFinished?: (pose: Pose) => void;
  /** Multiplies the roster's normalized height. */
  scale?: number;
}

/**
 * One rigged glTF animal, normalized so its feet sit on y = 0 and it stands
 * `ANIMALS[id].height` units tall, playing the clip that `pose` resolves to.
 * Pose changes crossfade; one-shot poses report back through
 * `onPoseFinished` so the caller can return to `idle`.
 */
export default function Animal({
  id,
  pose,
  poseKey = 0,
  fitMs,
  timeScale = 1,
  onPoseFinished,
  scale = 1,
}: AnimalProps) {
  // No draco (never referenced, avoids any CDN path); meshopt decoder is bundled from three.
  const { scene, animations } = useGLTF(modelUrl(id), false, true);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const groupRef = useRef<THREE.Group>(null);
  const { actions, mixer, names } = useAnimations(animations, groupRef);

  const fit = useMemo(() => {
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const target = ANIMALS.find((animal) => animal.id === id)?.height ?? 1;
    const factor = size.y > 0 ? target / size.y : 1;
    return { factor, yOffset: -box.min.y * factor };
  }, [cloned, id]);

  useEffect(() => {
    cloned.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
      }
    });
  }, [cloned]);

  const finishedRef = useRef(onPoseFinished);
  useEffect(() => {
    finishedRef.current = onPoseFinished;
  }, [onPoseFinished]);

  useEffect(() => {
    const clipName = resolveClip(pose, names);
    const action = clipName ? actions[clipName] : undefined;
    if (!action) return;
    const once = ONE_SHOT_POSES.has(pose) || HOLD_LAST_FRAME_POSES.has(pose);
    configureAction(action, { once, fitMs, timeScale });
    for (const other of Object.values(actions)) {
      if (other && other !== action && other.isRunning()) other.fadeOut(0.15);
    }
    action.fadeIn(0.12).play();
    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action === action) finishedRef.current?.(pose);
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [pose, poseKey, fitMs, timeScale, actions, mixer, names]);

  return (
    <group ref={groupRef}>
      <primitive object={cloned} scale={fit.factor * scale} position-y={fit.yOffset * scale} />
    </group>
  );
}
