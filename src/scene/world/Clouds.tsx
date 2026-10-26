import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../../engine/rng';

export interface CloudsProps {
  count: number;
  seed: number;
  xRange: [number, number];
  yRange: [number, number];
  zRange: [number, number];
  /** Units per second; clouds wrap around when they leave `xRange`. */
  speed?: number;
  color?: string;
  opacity?: number;
  drift?: boolean;
  /** Multiplies every cloud's size — distant backdrop clouds need to be bigger. */
  size?: number;
  /** Cast shadows, so clouds high over a scene drift their shadows across it. */
  castShadow?: boolean;
}

interface Puff {
  dx: number;
  dy: number;
  dz: number;
  r: number;
}

interface Cloud {
  x: number;
  y: number;
  z: number;
  scale: number;
  speed: number;
  puffs: Puff[];
}

/**
 * Chunky low-poly clouds (a few squashed spheres each) that drift sideways
 * forever — the "something is always moving" line of the fun bar (F14).
 */
export default function Clouds({
  count,
  seed,
  xRange,
  yRange,
  zRange,
  speed = 0.35,
  color = '#ffffff',
  opacity = 0.95,
  drift = true,
  size = 1,
  castShadow = false,
}: CloudsProps) {
  const clouds = useMemo<Cloud[]>(() => {
    const rng = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const puffCount = 3 + Math.floor(rng() * 3);
      return {
        x: xRange[0] + rng() * (xRange[1] - xRange[0]),
        y: yRange[0] + rng() * (yRange[1] - yRange[0]),
        z: zRange[0] + rng() * (zRange[1] - zRange[0]),
        scale: (0.8 + rng() * 1.4) * size,
        speed: speed * (0.6 + rng() * 0.8),
        puffs: Array.from({ length: puffCount }, (_, i) => ({
          dx: (i - (puffCount - 1) / 2) * 0.9 + (rng() - 0.5) * 0.3,
          dy: (rng() - 0.3) * 0.35,
          dz: (rng() - 0.5) * 0.5,
          r: 0.55 + rng() * 0.45,
        })),
      };
    });
  }, [count, seed, xRange, yRange, zRange, speed, size]);

  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    if (!drift) return;
    clouds.forEach((cloud, i) => {
      const group = groups.current[i];
      if (!group) return;
      group.position.x += cloud.speed * delta;
      if (group.position.x > xRange[1] + 3) group.position.x = xRange[0] - 3;
    });
  });

  return (
    <group>
      {clouds.map((cloud, i) => (
        <group
          key={i}
          ref={(node) => {
            groups.current[i] = node;
          }}
          position={[cloud.x, cloud.y, cloud.z]}
          scale={cloud.scale}
        >
          {cloud.puffs.map((puff, j) => (
            <mesh
              key={j}
              position={[puff.dx, puff.dy, puff.dz]}
              scale={[1, 0.7, 0.8]}
              castShadow={castShadow}
            >
              <sphereGeometry args={[puff.r, 7, 5]} />
              <meshStandardMaterial
                color={color}
                flatShading
                transparent={opacity < 1}
                opacity={opacity}
                roughness={1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
