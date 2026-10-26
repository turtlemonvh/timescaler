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
/** Flakes fill this depth range relative to the climber: in front of the wall, never near the lens. */
const DEPTH_NEAR = 2.8;
const DEPTH_FAR = -0.3;
const SNOW = new THREE.SphereGeometry(0.5, 5, 4);
/** A pointed, slightly curved leaf blade, 1 unit long — reads as a leaf, not a card. */
const LEAF = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.quadraticCurveTo(-0.05, 0.36, 0.5, 0);
  shape.quadraticCurveTo(-0.05, -0.3, -0.5, 0);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  // Cup the blade a little so it catches the light differently as it turns.
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setZ(i, y * y * 0.9);
  }
  geometry.computeVertexNormals();
  return geometry;
})();

/**
 * Ambient falling snow or leaves in a band that follows the climber. One
 * instanced mesh; flakes wrap around when they leave the band.
 */
export default function Weather({ kind, followRef, colors, count = 90 }: WeatherProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // The band's depth, eased: a hop's leap towards the camera shouldn't drag
  // every flake forward and back with it.
  const depthRef = useRef<number | null>(null);
  const flakes = useMemo<Flake[]>(() => {
    // Seeded, so render stays pure and the same peak always snows the same way.
    const rng = mulberry32(count * 31 + (kind === 'snow' ? 1 : 2));
    return Array.from({ length: count }, () => ({
      x: (rng() - 0.5) * 20,
      y: (rng() - 0.5) * BAND * 2,
      z: DEPTH_FAR + rng() * (DEPTH_NEAR - DEPTH_FAR),
      speed: 0.5 + rng() * 0.9,
      phase: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 4,
      size: kind === 'snow' ? 0.05 + rng() * 0.05 : 0.2 + rng() * 0.1,
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
    const depth =
      depthRef.current === null
        ? follow.z
        : depthRef.current + (follow.z - depthRef.current) * (1 - Math.exp(-delta * 1.5));
    depthRef.current = depth;
    const drift = kind === 'snow' ? 0.9 : 0.6;
    flakes.forEach((flake, i) => {
      flake.y -= flake.speed * drift * delta;
      if (flake.y < -BAND) flake.y += BAND * 2;
      const sway = Math.sin(t * 0.9 + flake.phase) * (kind === 'snow' ? 0.5 : 1.1);
      dummy.position.set(flake.x + sway, follow.y + flake.y, depth + flake.z);
      if (kind === 'leaves') {
        // Flutter: rock side to side and see-saw as it falls, with a slow turn.
        dummy.rotation.set(
          Math.sin(t * 1.7 + flake.phase) * 1.1,
          flake.phase + t * flake.spin * 0.5,
          Math.sin(t * 4 + flake.phase) * 0.8,
        );
      } else {
        dummy.rotation.set(t * flake.spin, flake.phase + t * flake.spin * 0.6, 0);
      }
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
      <meshStandardMaterial roughness={1} flatShading side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
