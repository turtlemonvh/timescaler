import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../engine/rng';
import type { PeakTheme } from '../theme/peakThemes';
import Clouds from '../world/Clouds';
import Pines from '../world/Pines';
import { basePines, wallPines } from './forest';
import {
  FOREST_FLOOR,
  ledgePoints,
  ledgeSlab,
  summitPlateau,
  summitY,
  wallZ,
  type Box3Like,
  type LedgeSlab,
  type Vec3,
} from './cliffPath';

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
    // A shallow groove follows the route: calmer rock near the ledges, and
    // room for the rope to lie against the wall behind the climber.
    const groove = 0.3 * (1 - routeDamp);
    const z = wallZ(y) + n * 0.5 * (0.25 + 0.75 * routeDamp) - edgeRecede - groove;
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

function boxCenter(box: Box3Like): [number, number, number] {
  return [(box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2];
}

function boxSize(box: Box3Like): [number, number, number] {
  return [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z];
}

function Ledge({
  slab,
  active,
  snowy,
  theme,
}: {
  slab: LedgeSlab;
  active: boolean;
  snowy: boolean;
  theme: PeakTheme;
}) {
  const { center, width, depth, thickness, yaw } = slab;
  // No boulder under the slab: the climber's flight path passes just in
  // front of each slab, and anything hanging below one sat right where the
  // climber's head goes on the hop up to it.
  return (
    <group position={[center.x, center.y, center.z]} rotation={[0, yaw, 0]}>
      <mesh castShadow receiveShadow scale={[width, thickness, depth]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={active ? theme.rock : theme.rockDark}
          flatShading
          roughness={1}
        />
      </mesh>
      {snowy && !active && (
        <mesh position={[0, thickness / 2 + 0.01, 0]} scale={[width * 0.95, 0.06, depth * 0.9]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={theme.snow} flatShading roughness={1} />
        </mesh>
      )}
      {active && (
        <mesh position={[0, thickness / 2 + 0.01, 0]} scale={[width * 0.98, 0.03, depth * 0.94]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={theme.flag} transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

/** Rope segments slung between consecutive ledges, lying against the wall
 * behind the climber so they never cross in front of it. */
function Rope({ route, color }: { route: Vec3[]; color: string }) {
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const dir = Math.sign(b.x - a.x) || 1;
      const reach = Math.abs(b.x - a.x) < 1.2 ? 0.3 : 0.6;
      const start = new THREE.Vector3(a.x + dir * reach, a.y + 0.02, a.z - 0.22);
      const end = new THREE.Vector3(b.x - dir * reach, b.y - 0.08, b.z - 0.22);
      const mid = start.clone().lerp(end, 0.5);
      mid.y -= 0.3;
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      pieces.push(new THREE.TubeGeometry(curve, 8, 0.045, 5, false));
    }
    return mergeGeometries(pieces) ?? new THREE.BufferGeometry();
  }, [route]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
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
  const slabs = useMemo(
    () => route.map((_, i) => ledgeSlab(i, theme.peak.id)),
    [route, theme.peak.id],
  );
  const plateau = useMemo(() => summitPlateau(height, theme.peak.id), [height, theme.peak.id]);
  const forest = useMemo(() => basePines(theme.peak.id), [theme.peak.id]);
  const clingers = useMemo(() => wallPines(height, theme.peak.id), [height, theme.peak.id]);
  const top = summitY(height);

  return (
    <group>
      <mesh geometry={wall} receiveShadow castShadow>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </mesh>

      <Rope route={route} color={theme.flag} />
      {slabs.map((slab, i) => (
        <Ledge
          key={i}
          slab={slab}
          active={i === position}
          snowy={route[i].y > top - 3.5}
          theme={theme}
        />
      ))}

      {/* Summit plateau: as thin and as shallow as a ledge slab, so the climber's
          head clears it from the ledge below and the summit hop clears its front. */}
      <mesh position={boxCenter(plateau)} receiveShadow castShadow>
        <boxGeometry args={boxSize(plateau)} />
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
        xRange={[-28, 28]}
        yRange={[4, top + 9]}
        zRange={[-18, -9]}
        speed={0.45}
      />
    </group>
  );
}
