import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  flap: number;
}

const ray = new THREE.Vector3();

const BIRDS: BirdState[] = [
  { offset: 0, speed: 2.2, dy: 1.2, flap: 11 },
  { offset: 9, speed: 1.7, dy: -0.4, flap: 9 },
  { offset: 15, speed: 2.6, dy: 2.4, flap: 13 },
];

function Bird({
  bird,
  y,
  z,
  span,
  spread,
  color,
  scale,
}: {
  bird: BirdState;
  spread: number;
  y: number;
  z: number;
  span: number;
  color: string;
  scale: number;
}) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * bird.speed + bird.offset;
    const period = span * 2 + 8;
    const x = (((t % period) + period) % period) - span - 4;
    if (group.current) {
      group.current.position.set(x, y + (bird.dy + Math.sin(t * 0.7) * 0.4) * spread, z);
      group.current.rotation.z = Math.sin(t * 0.5) * 0.15;
    }
    const flap = Math.sin(clock.elapsedTime * bird.flap) * 0.6;
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
  });
  return (
    <group ref={group} scale={scale}>
      <mesh ref={left} position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={right} position={[0, 0, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.08, 5, 4]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/** A few birds crossing the sky on a loop — wildlife that lives there (fun bar F17). */
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
    group.position.z += (targetZ - group.position.z) * k;
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
