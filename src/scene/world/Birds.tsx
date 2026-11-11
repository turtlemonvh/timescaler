import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BEAK_COLOR, HAWK, SONGBIRD, type BirdShape, type WingSpec } from './birdGeometry';
import { HAWK_ORBIT, hawkOrbit, hawkPose, songbirdPose } from './birdFlight';

export interface BirdsProps {
  /** Centre height; birds fly a little above and below. With `followRef`, an offset above it. */
  y: number;
  /** Depth of the flight line. With `followRef`, an offset in front of it. */
  z?: number;
  span?: number;
  color?: string;
  /**
   * The flock's band eases after this point (the climber) instead of sitting
   * at a fixed height, so birds keep crossing the view as the climb rises.
   */
  followRef?: RefObject<THREE.Vector3>;
  /** Clamp on the band's centre height (e.g. above the forest, near the summit). */
  minY?: number;
  maxY?: number;
  /** Uniform size; the default reads as a distant bird. */
  scale?: number;
  /**
   * With `followRef`: fly at this height on screen (NDC, 0 = middle, 1 = top
   * edge), but never less than `y` above the followed point, so the flock
   * crosses the strip of sky above the climber whatever the camera framing.
   */
  screenY?: number;
}

interface BirdState {
  offset: number;
  speed: number;
  dy: number;
}

const ray = new THREE.Vector3();

const BIRDS: BirdState[] = [
  { offset: 0, speed: 2.2, dy: 1.2 },
  { offset: 9, speed: 1.7, dy: -0.4 },
  { offset: 15, speed: 2.6, dy: 2.4 },
];

type JointRef = RefObject<THREE.Group | null>;

/** One wing: a shoulder hinge about the flight axis, and a wrist that folds the outer panel. */
function Wing({
  spec,
  side,
  material,
  shoulderRef,
  wristRef,
}: {
  spec: WingSpec;
  side: 0 | 1;
  material: THREE.Material;
  shoulderRef: JointRef;
  wristRef: JointRef;
}) {
  const s = side === 0 ? 1 : -1;
  return (
    <group ref={shoulderRef} position={[spec.shoulder[0], spec.shoulder[1], spec.shoulder[2] * s]}>
      <mesh geometry={spec.inner[side]} material={material} />
      <group ref={wristRef} position={[0, 0, spec.wrist * s]}>
        <mesh geometry={spec.outer[side]} material={material} />
      </group>
    </group>
  );
}

/** Raises both wings by `shoulder` (positive = up) and folds the outer panels by `wrist`. */
function setWings(
  shoulders: readonly [JointRef, JointRef],
  wrists: readonly [JointRef, JointRef],
  shoulder: number,
  wrist: number,
) {
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const sh = shoulders[i].current;
    const wr = wrists[i].current;
    if (sh) sh.rotation.x = -shoulder * s;
    if (wr) wr.rotation.x = -wrist * s;
  }
}

/** Body, head, beak, tail and two hinged wings; the caller poses the joints. */
function BirdModel({
  shape,
  color,
  shoulders,
  wrists,
}: {
  shape: BirdShape;
  color: string;
  shoulders: readonly [JointRef, JointRef];
  wrists: readonly [JointRef, JointRef];
}) {
  const materials = useMemo(() => {
    const base = new THREE.Color(color);
    const make = (c: THREE.Color | string) =>
      new THREE.MeshStandardMaterial({ color: c, flatShading: true, side: THREE.DoubleSide });
    return {
      body: make(base.clone().multiplyScalar(shape.bodyShade)),
      wing: make(base.clone().multiplyScalar(shape.wingShade)),
      beak: make(BEAK_COLOR),
    };
  }, [color, shape]);
  useEffect(
    () => () => {
      materials.body.dispose();
      materials.wing.dispose();
      materials.beak.dispose();
    },
    [materials],
  );
  return (
    <>
      <mesh material={materials.body} scale={shape.body.scale}>
        <sphereGeometry args={[shape.body.radius, 7, 5]} />
      </mesh>
      <mesh material={materials.body} position={shape.head.position}>
        <sphereGeometry args={[shape.head.radius, 6, 5]} />
      </mesh>
      <mesh
        material={materials.beak}
        position={shape.beak.position}
        rotation={[0, 0, -Math.PI / 2 - shape.beak.tilt]}
      >
        <coneGeometry args={[shape.beak.radius, shape.beak.length, 4]} />
      </mesh>
      <mesh geometry={shape.tail} material={materials.wing} />
      {([0, 1] as const).map((side) => (
        <Wing
          key={side}
          spec={shape.wing}
          side={side}
          material={materials.wing}
          shoulderRef={shoulders[side]}
          wristRef={wrists[side]}
        />
      ))}
    </>
  );
}

function Bird({
  bird,
  seed,
  y,
  z,
  span,
  spread,
  color,
  scale,
}: {
  bird: BirdState;
  seed: number;
  spread: number;
  y: number;
  z: number;
  span: number;
  color: string;
  scale: number;
}) {
  const group = useRef<THREE.Group>(null);
  const leftShoulder = useRef<THREE.Group>(null);
  const rightShoulder = useRef<THREE.Group>(null);
  const leftWrist = useRef<THREE.Group>(null);
  const rightWrist = useRef<THREE.Group>(null);
  const shoulders = [leftShoulder, rightShoulder] as const;
  const wrists = [leftWrist, rightWrist] as const;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * bird.speed + bird.offset;
    const period = span * 2 + 8;
    const x = (((t % period) + period) % period) - span - 4;
    const pose = songbirdPose(clock.elapsedTime, seed);
    if (group.current) {
      group.current.position.set(x, y + (bird.dy + Math.sin(t * 0.7) * 0.4) * spread + pose.bob, z);
      group.current.rotation.set(pose.bank, 0, 0);
    }
    setWings(shoulders, wrists, pose.shoulder, pose.wrist);
  });
  return (
    <group ref={group} scale={scale}>
      <BirdModel shape={SONGBIRD} color={color} shoulders={shoulders} wrists={wrists} />
    </group>
  );
}

/**
 * A few songbirds crossing the sky on a loop — wildlife that lives there (fun
 * bar F17). Each flaps a few quick beats and glides, out of step with the rest.
 */
export default function Birds({
  y,
  z = -3,
  span = 14,
  color = '#2b2118',
  followRef,
  minY = -Infinity,
  maxY = Infinity,
  scale = 1,
  screenY,
}: BirdsProps) {
  const band = useRef<THREE.Group>(null);
  const initialized = useRef(false);
  useFrame(({ camera }, delta) => {
    const group = band.current;
    const follow = followRef?.current;
    if (!group || !follow) return;
    const targetZ = follow.z + z;
    let rawY = follow.y + y;
    if (screenY !== undefined) {
      // Where the ray through (centre, screenY) meets the flight plane.
      ray.set(0, screenY, 0.5).unproject(camera).sub(camera.position);
      if (ray.z < -1e-3) rawY = camera.position.y + ray.y * ((targetZ - camera.position.z) / ray.z);
    }
    // Never lower than `y` above the followed point (clear of the climber's head).
    const targetY = Math.min(maxY, Math.max(minY, follow.y + y, rawY));
    // Snap on the first frame and after a jump cut (the camera's first
    // placement, a teleport to the summit); ease otherwise.
    if (
      !initialized.current ||
      Math.abs(targetY - group.position.y) > 3 ||
      Math.abs(targetZ - group.position.z) > 3
    ) {
      group.position.set(0, targetY, targetZ);
      initialized.current = true;
      return;
    }
    // Eased, so the flock drifts with the view rather than being nailed to it.
    const k = 1 - Math.exp(-delta * 6);
    group.position.y += (targetY - group.position.y) * k;
    // Depth eases slower, so a hop's leap towards the camera barely moves the flock.
    group.position.z += (targetZ - group.position.z) * (1 - Math.exp(-delta * 1.5));
  });
  const following = followRef !== undefined;
  // A following flock flies in a tighter band, so all three stay in the
  // strip of sky the camera keeps above the climber's head.
  const spread = following ? 0.3 : 1;
  return (
    <group ref={band}>
      {BIRDS.map((bird, i) => (
        <Bird
          key={i}
          bird={bird}
          seed={i}
          y={following ? 0 : y}
          z={following ? 0 : z}
          span={span}
          spread={spread}
          color={color}
          scale={scale}
        />
      ))}
    </group>
  );
}

/**
 * One hawk soaring on a thermal near the summit: it circles behind the flag
 * and above it, banked into the turn, mostly gliding with two slow beats
 * every few seconds. Mount it for the summit only.
 */
export function SummitHawk({
  summit,
  color = '#2b2118',
  scale = 0.8,
}: {
  /** The summit's standing point; the circle is placed relative to it. */
  summit: { x: number; y: number; z: number };
  color?: string;
  scale?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const leftShoulder = useRef<THREE.Group>(null);
  const rightShoulder = useRef<THREE.Group>(null);
  const leftWrist = useRef<THREE.Group>(null);
  const rightWrist = useRef<THREE.Group>(null);
  const shoulders = [leftShoulder, rightShoulder] as const;
  const wrists = [leftWrist, rightWrist] as const;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const orbit = hawkOrbit(t);
    if (group.current) {
      group.current.position.set(summit.x + orbit.x, summit.y + orbit.y, summit.z + orbit.z);
      group.current.rotation.set(HAWK_ORBIT.bank, orbit.yaw, 0, 'YXZ');
    }
    const pose = hawkPose(t);
    setWings(shoulders, wrists, pose.shoulder, pose.wrist);
  });
  return (
    <group ref={group} scale={scale}>
      <BirdModel shape={HAWK} color={color} shoulders={shoulders} wrists={wrists} />
    </group>
  );
}
