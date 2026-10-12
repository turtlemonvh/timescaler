import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BirdsProps {
  /** Centre height; birds fly a little above and below. */
  y: number;
  z?: number;
  span?: number;
  color?: string;
}

interface BirdState {
  offset: number;
  speed: number;
  dy: number;
  flap: number;
}

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
  color,
}: {
  bird: BirdState;
  y: number;
  z: number;
  span: number;
  color: string;
}) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * bird.speed + bird.offset;
    const period = span * 2 + 8;
    const x = (((t % period) + period) % period) - span - 4;
    if (group.current) {
      group.current.position.set(x, y + bird.dy + Math.sin(t * 0.7) * 0.4, z);
      group.current.rotation.z = Math.sin(t * 0.5) * 0.15;
    }
    const flap = Math.sin(clock.elapsedTime * bird.flap) * 0.6;
    if (left.current) left.current.rotation.z = flap;
    if (right.current) right.current.rotation.z = -flap;
  });
  return (
    <group ref={group}>
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
export default function Birds({ y, z = -3, span = 14, color = '#2b2118' }: BirdsProps) {
  return (
    <group>
      {BIRDS.map((bird, i) => (
        <Bird key={i} bird={bird} y={y} z={z} span={span} color={color} />
      ))}
    </group>
  );
}
