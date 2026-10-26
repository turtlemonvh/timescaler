import { useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { framingFor, keepInFrame, slotDistance } from './framing';
import { snapShadowTarget } from './shadowSnap';

export interface CameraRigProps {
  targetRef: RefObject<THREE.Vector3>;
  /** Where the current move ends (the climber's position at rest); the camera leads towards it. */
  framingRef?: RefObject<THREE.Vector3>;
  /** The climber's height in scene units, for keeping its head in frame. */
  heroHeight: number;
  shakeRef: RefObject<number>;
  phase: 'climb' | 'summit' | 'fell';
  reducedMotion: boolean;
  /** Directional light that casts the climber's shadow; kept near the target so the shadow map stays sharp. */
  lightRef: RefObject<THREE.DirectionalLight | null>;
}

// Scratch vectors shared by every rig; each useFrame callback fills them
// before use, so sharing is safe.
const anchor = new THREE.Vector3();
const lead = new THREE.Vector3();
const desired = new THREE.Vector3();
const look = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const corner = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
/** From the climber to the sun; matches the light's initial `position` in ClimbScene. */
const SUN_OFFSET = { x: 6, y: 9, z: 7 };

/** Fills `right`/`up`/`forward` for a camera at `from` looking at `to`; returns the distance. */
function basis(from: THREE.Vector3, to: THREE.Vector3): number {
  forward.subVectors(to, from);
  const distance = forward.length();
  forward.divideScalar(distance || 1);
  right.crossVectors(forward, WORLD_UP).normalize();
  up.crossVectors(right, forward);
  return distance;
}

/**
 * Follows the climber with critically-damped easing; swings across the
 * front of the summit; shakes on a hard landing. The climber is framed in
 * the part of the viewport the HTML card leaves open (`framing.ts`), the
 * camera leads towards where a hop will land, and a hard guard pans the
 * view whenever any part of the climber's body would leave that area — so
 * a fast double hop or a phone's short top margin can't lose the hero.
 */
export default function CameraRig({
  targetRef,
  framingRef,
  heroHeight,
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
    const goal = framingRef?.current ?? t;
    const inFlight = phase === 'climb' && goal.distanceToSquared(t) > 1e-4;
    const portrait = size.height > size.width * 1.05;
    const aspect = size.width / Math.max(1, size.height);
    const framing = framingFor(size.width, size.height, phase);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));

    // The body centre the camera frames: halfway to the landing spot during a
    // hop, so the camera leads without stranding the take-off at the edge.
    // The route zig-zags ±1.75; tracking nearly all of it keeps it near `home`.
    lead.lerpVectors(t, goal, 0.55);
    anchor.set(phase === 'climb' ? lead.x * 0.9 : lead.x, lead.y + heroHeight * 0.5, lead.z);
    look.copy(anchor);
    if (phase === 'summit') {
      // Swing across the front of the summit rather than orbiting into the wall.
      orbitRef.current += delta;
      const angle = Math.sin(orbitRef.current * 0.45) * 0.85;
      const radius = portrait ? 6.5 : 5.2;
      desired.set(
        anchor.x + Math.sin(angle) * radius,
        anchor.y + 1.5,
        anchor.z + Math.cos(angle) * radius + 0.5,
      );
    } else if (phase === 'fell') {
      // From up and to the left, looking down at the animal on the forest
      // floor: the wall behind it, the big forest pines on the right pushed
      // back into the distance instead of filling the lens.
      desired.set(anchor.x - 1.4, anchor.y + 3.2, anchor.z + (portrait ? 8.8 : 7.0));
    } else {
      const distance = portrait ? 9.5 : slotDistance(7.2, framing.safe, aspect, tanHalf);
      desired.set(anchor.x, anchor.y + distance * (portrait ? 0.21 : 0.125), anchor.z + distance);
    }

    // Slide the whole view sideways/up (no rotation) so the anchor lands on
    // the layout's home point instead of the centre of the screen.
    const distance = basis(desired, look);
    const shiftRight = -framing.homeX * distance * tanHalf * aspect;
    const shiftUp = -framing.homeY * distance * tanHalf;
    desired.addScaledVector(right, shiftRight).addScaledVector(up, shiftUp);
    look.addScaledVector(right, shiftRight).addScaledVector(up, shiftUp);

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
      const rate = inFlight ? 7 : phase === 'fell' ? 2.2 : 3.4;
      const k = 1 - Math.exp(-delta * rate);
      camera.position.lerp(desired, k);
      lookCurrentRef.current.lerp(look, k);
    }
    camera.lookAt(lookCurrentRef.current);
    camera.updateMatrixWorld();

    // Hard guard: project the climber's bounding box and pan until all of
    // it is inside the safe area. The hop arc and the camera's easing both
    // run ahead of or behind the animal; this is what makes "the hero never
    // leaves the frame" hold for every move, aspect and animal.
    const halfWidth = 0.45 + 0.5 * heroHeight;
    box.minX = Infinity;
    box.maxX = -Infinity;
    box.minY = Infinity;
    box.maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner
        .set(
          t.x + (i & 1 ? halfWidth : -halfWidth),
          t.y + (i & 2 ? heroHeight + 0.15 : -0.05),
          t.z + (i & 4 ? 0.35 : -0.35),
        )
        .project(camera);
      box.minX = Math.min(box.minX, corner.x);
      box.maxX = Math.max(box.maxX, corner.x);
      box.minY = Math.min(box.minY, corner.y);
      box.maxY = Math.max(box.maxY, corner.y);
    }
    const { dx, dy } = keepInFrame(box, framing.safe);
    if (dx !== 0 || dy !== 0) {
      basis(camera.position, lookCurrentRef.current);
      const depth = corner.subVectors(t, camera.position).dot(forward);
      const moveRight = dx * depth * tanHalf * aspect;
      const moveUp = dy * depth * tanHalf;
      camera.position.addScaledVector(right, moveRight).addScaledVector(up, moveUp);
      lookCurrentRef.current.addScaledVector(right, moveRight).addScaledVector(up, moveUp);
      camera.lookAt(lookCurrentRef.current);
    }

    const sun = lightRef.current;
    if (sun) {
      // Follow the climber in whole shadow-map texels so edges don't crawl.
      const shadowCam = sun.shadow.camera;
      const texel = (shadowCam.right - shadowCam.left) / sun.shadow.mapSize.width;
      const aim = snapShadowTarget(t, SUN_OFFSET, texel);
      sun.position.set(aim.x + SUN_OFFSET.x, aim.y + SUN_OFFSET.y, aim.z + SUN_OFFSET.z);
      sun.target.position.set(aim.x, aim.y, aim.z);
      sun.target.updateMatrixWorld();
    }
  });

  return null;
}
