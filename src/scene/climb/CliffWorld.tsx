import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../../engine/rng';
import type { PeakTheme } from '../theme/peakThemes';
import Clouds from '../world/Clouds';
import Pines, { type PineSpot } from '../world/Pines';
import { FOREST_FLOOR, ledgePoints, summitY, wallZ, type Vec3 } from './cliffPath';

export interface CliffWorldProps {
  theme: PeakTheme;
  height: number;
  /** Highlighted ledge (the one the climber stands on). */
  position: number;
}

const WALL_WIDTH = 10;
const WALL_BELOW = 5;
const WALL_ABOVE = 7;

function noise(x: number, y: number, seed: number): number {
  return (
    Math.sin(x * 1.3 + y * 0.7 + seed) * 0.45 +
    Math.sin(x * 0.45 - y * 1.15 + seed * 0.3) * 0.35 +
    Math.sin(x * 2.7 + y * 2.1) * 0.2
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildWall(height: number, theme: PeakTheme): THREE.BufferGeometry {
  const top = summitY(height) + WALL_ABOVE;
  const bottom = -WALL_BELOW;
  const segX = 36;
  const segY = Math.ceil((top - bottom) * 2.2);
  const geometry = new THREE.PlaneGeometry(WALL_WIDTH, top - bottom, segX, segY);
  geometry.translate(0, (top + bottom) / 2, 0);
  const route = ledgePoints(height, theme.peak.id);
  const positions = geometry.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const rock = new THREE.Color(theme.rock);
  const dark = new THREE.Color(theme.rockDark);
  const snow = new THREE.Color(theme.snow);
  const rng = mulberry32(theme.peak.id * 31 + 7);
  const scratch = new THREE.Color();
  const snowLine = summitY(height) - 2.5;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    let nearest = Infinity;
    for (const point of route) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < nearest) nearest = d;
    }
    const routeDamp = clamp01((nearest - 0.7) / 1.2);
    const n = noise(x, y, theme.peak.id) + (rng() - 0.5) * 0.35;
    const edgeRecede = Math.abs(x) > 3.3 ? (Math.abs(x) - 3.3) * 0.75 : 0;
    const z = wallZ(y) + n * 0.5 * (0.25 + 0.75 * routeDamp) - edgeRecede;
    positions.setZ(i, z);

    const shade = clamp01(0.5 - n * 0.9) * 0.75;
    scratch.copy(rock).lerp(dark, shade);
    const snowT = clamp01((y - snowLine) / 3) * (n > -0.25 ? 1 : 0.35);
    scratch.lerp(snow, snowT);
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function basePines(theme: PeakTheme): PineSpot[] {
  const rng = mulberry32(theme.peak.id * 101 + 3);
  const spots: PineSpot[] = [];
  for (let i = 0; i < 90; i++) {
    const x = (rng() - 0.5) * 34;
    const z = 0.8 + rng() * 5;
    // Keep the camera's lane (straight in front of the route) clear.
    if (Math.abs(x) < 3.2) continue;
    spots.push({ x, y: FOREST_FLOOR, z, scale: 0.7 + rng() * 0.9, rotation: rng() * Math.PI });
  }
  // A thin fringe right under the first ledge, well below eye level.
  for (let i = 0; i < 14; i++) {
    const x = (rng() - 0.5) * 6;
    const z = 0.6 + rng() * 1.6;
    spots.push({ x, y: FOREST_FLOOR, z, scale: 0.45 + rng() * 0.35, rotation: rng() * Math.PI });
  }
  return spots;
}

function wallPines(height: number, theme: PeakTheme): PineSpot[] {
  const rng = mulberry32(theme.peak.id * 211 + 5);
  const spots: PineSpot[] = [];
  const top = summitY(height);
  for (let i = 0; i < 16; i++) {
    const side = rng() > 0.5 ? 1 : -1;
    const y = 1 + rng() * Math.max(1, top - 3);
    const x = side * (3.1 + rng() * 1.3);
    spots.push({
      x,
      y: y - 0.2,
      z: wallZ(y) + 0.25,
      scale: 0.45 + rng() * 0.45,
      rotation: rng() * Math.PI,
    });
  }
  return spots;
}

function Ledge({ point, active, theme }: { point: Vec3; active: boolean; theme: PeakTheme }) {
  return (
    <group position={[point.x, point.y - 0.11, point.z + 0.2]}>
      <mesh castShadow receiveShadow rotation={[0, (point.x * 0.37) % 0.3, 0]}>
        <boxGeometry args={[1.15, 0.22, 0.95]} />
        <meshStandardMaterial
          color={active ? theme.rock : theme.rockDark}
          flatShading
          roughness={1}
        />
      </mesh>
      {active && (
        <mesh position={[0, 0.12, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.7, 24]} />
          <meshBasicMaterial color={theme.flag} transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}

function Flag({ point, color }: { point: Vec3; color: string }) {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (cloth.current) {
      cloth.current.rotation.y = Math.sin(clock.elapsedTime * 3.2) * 0.35;
      cloth.current.scale.x = 0.9 + Math.sin(clock.elapsedTime * 6) * 0.1;
    }
  });
  return (
    <group position={[point.x + 0.9, point.y, point.z + 0.1]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 2.2, 6]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      <mesh ref={cloth} position={[0.02, 1.85, 0]}>
        <mesh position={[0.45, 0, 0]}>
          <boxGeometry args={[0.9, 0.55, 0.03]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      </mesh>
      <mesh position={[0, 2.25, 0]}>
        <sphereGeometry args={[0.09, 6, 5]} />
        <meshStandardMaterial color="#ffd13b" />
      </mesh>
    </group>
  );
}

function DistantPeaks({ theme }: { theme: PeakTheme }) {
  const peaks = useMemo(() => {
    const rng = mulberry32(theme.peak.id * 17 + 1);
    return Array.from({ length: 9 }, (_, i) => ({
      x: -52 + i * 13 + (rng() - 0.5) * 6,
      z: -26 - rng() * 16,
      r: 7 + rng() * 6,
      h: 14 + rng() * 16,
    }));
  }, [theme.peak.id]);
  return (
    <group>
      {peaks.map((peak, i) => (
        <group key={i} position={[peak.x, -6, peak.z]}>
          <mesh position={[0, peak.h / 2, 0]}>
            <coneGeometry args={[peak.r, peak.h, 7]} />
            <meshStandardMaterial color={theme.rockDark} flatShading />
          </mesh>
          <mesh position={[0, peak.h * 0.84, 0]}>
            <coneGeometry args={[peak.r * 0.33, peak.h * 0.33, 7]} />
            <meshStandardMaterial color={theme.snow} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * The static world of one climb: the cliff with a visible route of ledges,
 * a forest at the base, pines clinging to the sides, a summit flag, distant
 * ranges and drifting clouds. Everything is procedural from the peak id, so
 * each peak looks different and nothing new enters the precache.
 */
export default function CliffWorld({ theme, height, position }: CliffWorldProps) {
  const wall = useMemo(() => buildWall(height, theme), [height, theme]);
  const route = useMemo(() => ledgePoints(height, theme.peak.id), [height, theme.peak.id]);
  const forest = useMemo(() => basePines(theme), [theme]);
  const clingers = useMemo(() => wallPines(height, theme), [height, theme]);
  const top = summitY(height);

  return (
    <group>
      <mesh geometry={wall} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      {route.map((point, i) => (
        <Ledge key={i} point={point} active={i === position} theme={theme} />
      ))}

      {/* Summit plateau */}
      <mesh
        position={[route[height].x, top - 0.35, route[height].z + 0.4]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[4.2, 0.7, 2.4]} />
        <meshStandardMaterial color={theme.snow} flatShading roughness={1} />
      </mesh>
      <Flag point={route[height]} color={theme.flag} />

      {/* Ground + forest at the base */}
      <mesh position={[0, FOREST_FLOOR - 0.05, 6]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[40, 24]} />
        <meshStandardMaterial color={theme.ground} roughness={1} />
      </mesh>
      <Pines spots={forest} leaf={theme.tree} leafDark={theme.treeDark} />
      <Pines spots={clingers} leaf={theme.tree} leafDark={theme.treeDark} />

      <DistantPeaks theme={theme} />
      <Clouds
        count={14}
        seed={theme.peak.id}
        xRange={[-26, 26]}
        yRange={[1, top + 8]}
        zRange={[-9, 3]}
        speed={0.45}
      />
    </group>
  );
}
