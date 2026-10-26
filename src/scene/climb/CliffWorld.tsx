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
  ROPE_Z,
  clamp01,
  wallSurface,
  ledgePoints,
  ledgeSlab,
  summitPlateau,
  summitY,
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
/** The highlighted ledge's mat. */
const MAT_THICKNESS = 0.012;
const WALL_BELOW = 5;
const WALL_ABOVE = 7;

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
    const jitter = (rng() - 0.5) * 0.35;
    const { z, n } = wallSurface(x, y, theme.peak.id, route, jitter);
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
  summit,
  theme,
}: {
  slab: LedgeSlab;
  active: boolean;
  snowy: boolean;
  /** The summit stands on the plateau: no slab of its own, or the two top faces z-fight. */
  summit: boolean;
  theme: PeakTheme;
}) {
  const { center, width, depth, thickness, yaw } = slab;
  // No boulder under the slab: the climber's flight path passes just in
  // front of each slab, and anything hanging below one sat right where the
  // climber's head goes on the hop up to it.
  return (
    <group position={[center.x, center.y, center.z]} rotation={[0, yaw, 0]}>
      {!summit && (
        <mesh castShadow receiveShadow scale={[width, thickness, depth]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={active ? theme.rock : theme.rockDark}
            flatShading
            roughness={1}
          />
        </mesh>
      )}
      {snowy && !active && !summit && (
        <mesh position={[0, thickness / 2 + 0.01, 0]} scale={[width * 0.95, 0.06, depth * 0.9]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={theme.snow} flatShading roughness={1} />
        </mesh>
      )}
      {active && (
        // A thin decal just above the standing surface (slab or plateau):
        // hooves stand on it, not in it, and it never shares a plane.
        <mesh
          position={[0, thickness / 2 + MAT_THICKNESS / 2 + 0.002, 0]}
          scale={[width * 0.98, MAT_THICKNESS, depth * 0.94]}
          renderOrder={1}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color={theme.flag}
            transparent
            opacity={0.6}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )}
    </group>
  );
}

/** Rope segments slung between consecutive ledges, over the back edge of
 * each slab: behind a standing climber's body, and well behind the flight
 * paths (which leap out from the wall). */
function Rope({ route, color }: { route: Vec3[]; color: string }) {
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      const dir = Math.sign(b.x - a.x) || 1;
      const reach = Math.abs(b.x - a.x) < 1.2 ? 0.3 : 0.6;
      const start = new THREE.Vector3(a.x + dir * reach, a.y + 0.02, a.z + ROPE_Z);
      const end = new THREE.Vector3(b.x - dir * reach, b.y - 0.08, b.z + ROPE_Z);
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
          summit={i === height}
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
      {clingers.map(({ shelf }, i) => (
        // The rock each wall pine's roots grip, so it does not float on the face.
        <mesh
          key={i}
          position={[shelf.x, shelf.y, shelf.z]}
          rotation={[0, i * 1.7, 0]}
          scale={[shelf.size, shelf.size * 0.35, shelf.size * 0.8]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={theme.rock} flatShading roughness={1} />
        </mesh>
      ))}

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
