import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface CameraRigProps {
  targetRef: RefObject<THREE.Vector3>;
  shakeRef: RefObject<number>;
  phase: 'climb' | 'summit' | 'fell';
  reducedMotion: boolean;
  /** Directional light that casts the climber's shadow; kept near the target so the shadow map stays sharp. */
  lightRef: RefObject<THREE.DirectionalLight | null>;
}

// Scratch vectors shared by every rig; each useFrame callback fills them
// before use, so sharing is safe.
const desired = new THREE.Vector3();
const look = new THREE.Vector3();

/**
 * Follows the climber with critically-damped easing; swings across the
 * front of the summit; shakes on a hard landing. In portrait the look-at
 * point is lowered so the climber sits in the top third of the viewport,
 * above the docked question card.
 */
export default function CameraRig({
  targetRef,
  shakeRef,
  phase,
  reducedMotion,
  lightRef,
}: CameraRigProps) {
  const { camera, size } = useThree();
  const lookCurrentRef = useRef(new THREE.Vector3(0, 1, 0));
  const orbitRef = useRef(0);
  const initializedRef = useRef(false);

  useFrame((_, delta) => {
    const t = targetRef.current;
    if (!t) return;
    const portrait = size.height > size.width * 1.05;
    const distance = portrait ? 9.5 : 7.2;
    const lift = portrait ? 1.0 : 1.4;
    const lookDrop = portrait ? -1.6 : -0.1;

    if (phase === 'summit') {
      // Swing across the front of the summit rather than orbiting into the wall.
      orbitRef.current += delta;
      const angle = Math.sin(orbitRef.current * 0.45) * 0.85;
      const radius = portrait ? 6.5 : 5.2;
      const sideShift = !portrait && size.width >= 900 ? 1.6 : 0;
      desired.set(
        t.x + Math.sin(angle) * radius + sideShift,
        t.y + 2.2,
        t.z + Math.cos(angle) * radius + 0.5,
      );
      look.set(t.x + sideShift, t.y + 0.7 + (portrait ? -1.3 : 0), t.z);
    } else {
      // Landscape docks the question card down the right-hand side, so the
      // framing centre sits to the right of the climber and the climber lands
      // in the open left half of the viewport.
      const follow = portrait ? 1 : 0.5;
      // Matches the CSS breakpoint that docks the card on the right.
      const sideShift = !portrait && size.width >= 900 ? 2.1 : 0;
      desired.set(t.x * follow + sideShift, t.y + lift, t.z + distance);
      look.set(t.x * follow + sideShift, t.y + 0.6 + lookDrop, t.z);
    }

    const shake = shakeRef.current ?? 0;
    if (shake > 0) {
      desired.x += (Math.random() - 0.5) * 0.5 * shake;
      desired.y += (Math.random() - 0.5) * 0.4 * shake;
      shakeRef.current = Math.max(0, shake - delta * 2.5);
    }

    if (!initializedRef.current || reducedMotion) {
      camera.position.copy(desired);
      lookCurrentRef.current.copy(look);
      initializedRef.current = true;
    } else {
      const k = 1 - Math.exp(-delta * (phase === 'fell' ? 2.2 : 3.4));
      camera.position.lerp(desired, k);
      lookCurrentRef.current.lerp(look, k);
    }
    camera.lookAt(lookCurrentRef.current);

    const sun = lightRef.current;
    if (sun) {
      sun.position.set(t.x + 6, t.y + 9, t.z + 7);
      sun.target.position.set(t.x, t.y, t.z);
      sun.target.updateMatrixWorld();
    }
  });

  return null;
}
