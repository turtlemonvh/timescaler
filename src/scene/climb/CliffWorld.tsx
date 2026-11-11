import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../../engine/rng';
import type { PeakTheme } from '../theme/peakThemes';
import Clouds from '../world/Clouds';
import Pines from '../world/Pines';
import { basePines, wallPines } from './forest';
import { FLAG, flagFlutter, flagSwing, summitFlagFoot } from './flag';
import {
  BACKDROP_Z,
  FOREST_FLOOR,
  ROPE_RADIUS,
  WALL_COLUMNS,
  clamp01,
  wallGrid,
  ledgePoints,
  ledgeSlab,
  ropePoints,
  summitPlateau,
  summitY,
  type Box3Like,
  type LedgeSlab,
  type Vec3,
  type WallGrid,
} from './cliffPath';

export interface CliffWorldProps {
  theme: PeakTheme;
  height: number;
  /** Highlighted ledge (the one the climber stands on). */
  position: number;
}

/** The highlighted ledge's mat. */
const MAT_THICKNESS = 0.012;

/**
 * The cliff: a grid whose rows each span the outline at their height
 * (`wallOutline`), so the face tapers to a peak behind the summit between
 * buttressed edges, instead of being a flat-topped ribbon with ruler-straight
 * sides. About as many vertices as the old ribbon; still one draw. The
 * vertices come from `wallGrid`, so the tests see the same rock.
 */
function buildWall(height: number, theme: PeakTheme, grid: WallGrid): THREE.BufferGeometry {
  const { rows, positions, noise, shade } = grid;
  const colors = new Float32Array(positions.length);
  const rock = new THREE.Color(theme.rock);
  const dark = new THREE.Color(theme.rockDark);
  const snow = new THREE.Color(theme.snow);
  const scratch = new THREE.Color();
  const snowLine = summitY(height) - 2.5;

  for (let i = 0; i < noise.length; i++) {
    const n = noise[i];
    const y = positions[i * 3 + 1];
    scratch.copy(rock).lerp(dark, clamp01(0.5 - n * 0.9 + (shade[i] - 0.5) * 0.2) * 0.75);
    const snowT = clamp01((y - snowLine) / 3) * (n > -0.25 ? 1 : 0.35);
    scratch.lerp(snow, snowT);
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }

  const index: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < WALL_COLUMNS; col++) {
      const a = row * (WALL_COLUMNS + 1) + col;
      const c = a + WALL_COLUMNS + 1;
      // Counter-clockwise seen from +Z: the face looks at the camera.
      index.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(index);
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
function Rope({ route, color, peakId }: { route: Vec3[]; color: string; peakId: number }) {
  const geometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < route.length - 1; i++) {
      const points = ropePoints(i, peakId, route).map((p) => new THREE.Vector3(p.x, p.y, p.z));
      const curve = new THREE.CatmullRomCurve3(points);
      pieces.push(new THREE.TubeGeometry(curve, 16, ROPE_RADIUS, 5, false));
    }
    return mergeGeometries(pieces) ?? new THREE.BufferGeometry();
  }, [route, peakId]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

/**
 * The summit flag. Its foot comes from `summitFlagFoot`, which stands it far
 * enough in front of the peak's rock that the cloth's whole swing stays clear
 * of it; the cloth only ever swings forward, away from the wall.
 */
function Flag({ foot, color }: { foot: Vec3; color: string }) {
  const cloth = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (cloth.current) {
      cloth.current.rotation.y = flagSwing(clock.elapsedTime);
      cloth.current.scale.x = flagFlutter(clock.elapsedTime);
    }
  });
  return (
    <group position={[foot.x, foot.y, foot.z]}>
      <mesh position={[0, FLAG.poleHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[FLAG.poleRadius - 0.01, FLAG.poleRadius, FLAG.poleHeight, 6]} />
        <meshStandardMaterial color="#6b4a2e" />
      </mesh>
      <mesh ref={cloth} position={[0.02, FLAG.clothY, 0]}>
        <mesh position={[FLAG.clothWidth / 2, 0, 0]}>
          <boxGeometry args={[FLAG.clothWidth, FLAG.clothHeight, FLAG.clothDepth]} />
          <meshStandardMaterial color={color} side={THREE.DoubleSide} />
        </mesh>
      </mesh>
      <mesh position={[0, FLAG.finialY, 0]}>
        <sphereGeometry args={[FLAG.finialRadius, 6, 5]} />
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
  const grid = useMemo(() => wallGrid(height, theme.peak.id), [height, theme.peak.id]);
  const wall = useMemo(() => buildWall(height, theme, grid), [height, theme, grid]);
  const flagFoot = useMemo(
    () => summitFlagFoot(height, theme.peak.id, grid),
    [height, theme.peak.id, grid],
  );
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

      <Rope route={route} color={theme.flag} peakId={theme.peak.id} />
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
      <Flag foot={flagFoot} color={theme.flag} />

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
        zRange={[BACKDROP_Z - 9, BACKDROP_Z]}
        speed={0.45}
      />
    </group>
  );
}
