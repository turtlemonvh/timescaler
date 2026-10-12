import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../../engine/rng';

export type WeatherKind = 'none' | 'snow' | 'leaves';

export interface WeatherProps {
  kind: WeatherKind;
  /** The flakes live in a band around this point (the climber), so they are always in view. */
  followRef: RefObject<THREE.Vector3>;
  colors: readonly string[];
  count?: number;
}

interface Flake {
  x: number;
  y: number;
  z: number;
  speed: number;
  phase: number;
  spin: number;
  size: number;
}

const BAND = 9;
const SNOW = new THREE.SphereGeometry(0.5, 5, 4);
const LEAF = new THREE.BoxGeometry(1, 0.08, 0.6);

/**
 * Ambient falling snow or leaves in a band that follows the climber. One
 * instanced mesh; flakes wrap around when they leave the band.
 */
export default function Weather({ kind, followRef, colors, count = 90 }: WeatherProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flakes = useMemo<Flake[]>(() => {
    // Seeded, so render stays pure and the same peak always snows the same way.
    const rng = mulberry32(count * 31 + (kind === 'snow' ? 1 : 2));
    return Array.from({ length: count }, () => ({
      x: (rng() - 0.5) * 20,
      y: (rng() - 0.5) * BAND * 2,
      z: (rng() - 0.5) * 7 + 1,
      speed: 0.5 + rng() * 0.9,
      phase: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 4,
      size: kind === 'snow' ? 0.06 + rng() * 0.07 : 0.12 + rng() * 0.1,
    }));
  }, [count, kind]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    const color = new THREE.Color();
    flakes.forEach((_, i) => {
      color.set(colors[i % colors.length]);
      instanced.setColorAt(i, color);
    });
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  }, [flakes, colors]);

  useFrame(({ clock }, delta) => {
    const instanced = mesh.current;
    const follow = followRef.current;
    if (!instanced || !follow || kind === 'none') return;
    const t = clock.elapsedTime;
    const drift = kind === 'snow' ? 0.9 : 0.6;
    flakes.forEach((flake, i) => {
      flake.y -= flake.speed * drift * delta;
      if (flake.y < -BAND) flake.y += BAND * 2;
      const sway = Math.sin(t * 0.9 + flake.phase) * (kind === 'snow' ? 0.5 : 1.1);
      dummy.position.set(flake.x + sway, follow.y + flake.y, flake.z);
      dummy.rotation.set(t * flake.spin, flake.phase + t * flake.spin * 0.6, 0);
      dummy.scale.setScalar(flake.size);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  });

  if (kind === 'none') return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[kind === 'snow' ? SNOW : LEAF, undefined, count]}
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  );
}
