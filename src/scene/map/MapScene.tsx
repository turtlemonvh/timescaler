import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { PEAKS } from '../../engine/peaks';
import { mulberry32 } from '../../engine/rng';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import type { AnimalId } from '../animals/roster';
import { PEAK_THEMES, peakTheme } from '../theme/peakThemes';
import { hasWebGL } from '../webgl';
import Clouds from '../world/Clouds';
import Pines, { type PineSpot } from '../world/Pines';
import SkyDome from '../world/SkyDome';
import { ISLAND_RADIUS, PEAK_SPOTS, peakSpotFor, type PeakSpot } from './peakLayout';

export interface MapSceneProps {
  selectedPeakId: number;
  summitedPeakIds: readonly number[];
  animalId: AnimalId;
  onSelectPeak: (peakId: number) => void;
  reducedMotion?: boolean;
}

const ISLAND_TOP = 0.75;
const SKY = { top: '#3f86d8', bottom: '#d6ecff' };

/** Where the animal stands for a given peak: at its foot, on the camera side. */
function standPoint(spot: PeakSpot): THREE.Vector3 {
  return new THREE.Vector3(spot.x, ISLAND_TOP, spot.z + spot.radius + 0.7);
}

function Mountain({
  spot,
  selected,
  summited,
  onSelect,
}: {
  spot: PeakSpot;
  selected: boolean;
  summited: boolean;
  onSelect: () => void;
}) {
  const theme = peakTheme(spot.id);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.06;
      ring.current.scale.set(s, s, s);
    }
  });
  return (
    <group position={[spot.x, ISLAND_TOP, spot.z]}>
      <mesh
        position={[0, spot.height / 2, 0]}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <coneGeometry args={[spot.radius, spot.height, 7]} />
        <meshStandardMaterial
          color={hovered || selected ? theme.rock : theme.rockDark}
          flatShading
        />
      </mesh>
      <mesh position={[0, spot.height * 0.83, 0]}>
        <coneGeometry args={[spot.radius * 0.36, spot.height * 0.36, 7]} />
        <meshStandardMaterial color={theme.snow} flatShading />
      </mesh>
      {summited && (
        <group position={[0, spot.height, 0]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.7, 5]} />
            <meshStandardMaterial color="#6b4a2e" />
          </mesh>
          <mesh position={[0.2, 0.55, 0]}>
            <boxGeometry args={[0.4, 0.25, 0.02]} />
            <meshStandardMaterial color={theme.flag} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
      {selected && (
        <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[spot.radius + 0.15, spot.radius + 0.45, 32]} />
          <meshBasicMaterial color={theme.flag} transparent opacity={0.85} />
        </mesh>
      )}
      <NumberBadge
        number={spot.id}
        selected={selected}
        position={[0, spot.height + (summited ? 1.1 : 0.55), 0]}
      />
    </group>
  );
}

const badgeTextureCache = new Map<string, THREE.CanvasTexture>();

/** A number drawn onto a small canvas texture — a billboard sprite, so no DOM portal is involved. */
function badgeTexture(number: number, selected: boolean): THREE.CanvasTexture {
  const key = `${number}:${selected ? 1 : 0}`;
  const cached = badgeTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#ffd13b' : 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#2a1f14';
    ctx.stroke();
    ctx.fillStyle = '#2a1f14';
    ctx.font = 'bold 64px Atkinson Hyperlegible, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 64, 68);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  badgeTextureCache.set(key, texture);
  return texture;
}

function NumberBadge({
  number,
  selected,
  position,
}: {
  number: number;
  selected: boolean;
  position: [number, number, number];
}) {
  const texture = useMemo(() => badgeTexture(number, selected), [number, selected]);
  const size = selected ? 1.1 : 0.8;
  return (
    <sprite position={position} scale={[size, size, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

function Trail() {
  const stones = useMemo(() => {
    const out: THREE.Vector3[] = [];
    for (let i = 1; i < PEAK_SPOTS.length; i++) {
      const a = standPoint(PEAK_SPOTS[i - 1]);
      const b = standPoint(PEAK_SPOTS[i]);
      const n = 5;
      for (let k = 1; k < n; k++) out.push(a.clone().lerp(b, k / n));
    }
    return out;
  }, []);
  return (
    <group>
      {stones.map((stone, i) => (
        <mesh
          key={i}
          position={[stone.x, ISLAND_TOP + 0.02, stone.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.22, 6]} />
          <meshStandardMaterial color="#c9b58a" />
        </mesh>
      ))}
    </group>
  );
}

function islandPines(): PineSpot[] {
  const rng = mulberry32(2026);
  const spots: PineSpot[] = [];
  let guard = 0;
  while (spots.length < 140 && guard++ < 2000) {
    const angle = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * (ISLAND_RADIUS - 1.2);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const nearPeak = PEAK_SPOTS.some(
      (spot) => Math.hypot(spot.x - x, spot.z - z) < spot.radius + 1.6,
    );
    if (nearPeak) continue;
    spots.push({
      x,
      y: ISLAND_TOP - 0.05,
      z,
      scale: 0.55 + rng() * 0.6,
      rotation: rng() * Math.PI,
    });
  }
  return spots;
}

function Wanderer({
  selectedPeakId,
  animalId,
  reducedMotion,
}: {
  selectedPeakId: number;
  animalId: AnimalId;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const [pose, setPose] = useState<Pose>('idle');
  const from = useRef(standPoint(peakSpotFor(selectedPeakId)));
  const to = useRef(standPoint(peakSpotFor(selectedPeakId)));
  const started = useRef(0);
  const duration = useRef(0);
  const facing = useRef(0);

  useEffect(() => {
    const target = standPoint(peakSpotFor(selectedPeakId));
    if (group.current && reducedMotion) {
      group.current.position.copy(target);
      from.current = target;
      to.current = target;
      return;
    }
    from.current = group.current ? group.current.position.clone() : target.clone();
    to.current = target;
    const distance = from.current.distanceTo(target);
    duration.current = Math.min(1600, 350 + distance * 90);
    started.current = performance.now();
    if (distance > 0.1) {
      setPose(distance > 6 ? 'run' : 'walk');
      facing.current = Math.atan2(target.x - from.current.x, target.z - from.current.z);
    }
  }, [selectedPeakId, reducedMotion]);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const t = duration.current > 0 ? (performance.now() - started.current) / duration.current : 1;
    if (t < 1) {
      const e = t * t * (3 - 2 * t);
      node.position.lerpVectors(from.current, to.current, e);
      node.position.y = ISLAND_TOP + Math.abs(Math.sin(t * Math.PI * 6)) * 0.04;
    } else {
      node.position.copy(to.current);
      if (pose === 'walk' || pose === 'run') setPose('idle');
      facing.current = 0.35;
    }
    node.rotation.y += (facing.current - node.rotation.y) * Math.min(1, delta * 8);
  });

  return (
    <group ref={group} position={standPoint(peakSpotFor(selectedPeakId))}>
      <Animal id={animalId} pose={pose} scale={0.9} />
    </group>
  );
}

function MapCamera({
  selectedPeakId,
  reducedMotion,
}: {
  selectedPeakId: number;
  reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const desired = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);
  useFrame((_, delta) => {
    const spot = peakSpotFor(selectedPeakId);
    const portrait = size.height > size.width;
    const stand = standPoint(spot);
    desired.set(stand.x * 0.6, ISLAND_TOP + (portrait ? 11 : 8.5), stand.z + (portrait ? 13 : 11));
    const lookAt = new THREE.Vector3(stand.x * 0.6, ISLAND_TOP + spot.height * 0.35, stand.z - 2.5);
    if (first.current || reducedMotion) {
      camera.position.copy(desired);
      look.current.copy(lookAt);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-delta * 2.6);
      camera.position.lerp(desired, k);
      look.current.lerp(lookAt, k);
    }
    target.current.copy(look.current);
    camera.lookAt(look.current);
  });
  return null;
}

/**
 * The overworld: ten peaks on an island, the player's animal standing at the
 * selected one and trotting over when the selection changes. Clicking a
 * mountain selects it; the DOM list beside the scene does the rest.
 */
export default function MapScene({
  selectedPeakId,
  summitedPeakIds,
  animalId,
  onSelectPeak,
  reducedMotion = false,
}: MapSceneProps) {
  const pines = useMemo(() => islandPines(), []);
  if (!hasWebGL()) {
    return (
      <div
        className="scene-fallback"
        data-testid="map-scene-fallback"
        style={{ background: `linear-gradient(${SKY.top}, ${SKY.bottom})` }}
      />
    );
  }
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.1, far: 400, position: [0, 9, 14] }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="map-scene"
    >
      <color attach="background" args={[SKY.bottom]} />
      <fog attach="fog" args={[SKY.bottom, 30, 90]} />
      <SkyDome top={SKY.top} bottom={SKY.bottom} sun="#fff4c2" sunPosition={[-80, 60, -140]} />
      <hemisphereLight args={[SKY.top, '#6fa05a', 0.75]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        intensity={1.7}
        color="#fff1d6"
        position={[14, 22, 10]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-bias={-0.0006}
      />

      {/* Sea, beach, island */}
      <mesh position={[0, -0.6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 32]} />
        <meshStandardMaterial color="#3d7fc1" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS + 1.6, ISLAND_RADIUS + 2.4, 0.9, 28]} />
        <meshStandardMaterial color="#e8d7a8" flatShading />
      </mesh>
      <mesh position={[0, ISLAND_TOP / 2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[ISLAND_RADIUS, ISLAND_RADIUS + 1.2, ISLAND_TOP, 28]} />
        <meshStandardMaterial color="#6fa05a" flatShading />
      </mesh>

      <Pines spots={pines} leaf="#4f8a4a" leafDark="#2f5e31" />
      <Trail />
      {PEAKS.map((peak) => (
        <Mountain
          key={peak.id}
          spot={peakSpotFor(peak.id)}
          selected={peak.id === selectedPeakId}
          summited={summitedPeakIds.includes(peak.id)}
          onSelect={() => onSelectPeak(peak.id)}
        />
      ))}
      <Clouds
        count={10}
        seed={99}
        xRange={[-30, 30]}
        yRange={[7, 12]}
        zRange={[-22, 6]}
        speed={0.4}
      />

      <Suspense fallback={null}>
        <Wanderer
          selectedPeakId={selectedPeakId}
          animalId={animalId}
          reducedMotion={reducedMotion}
        />
      </Suspense>
      <MapCamera selectedPeakId={selectedPeakId} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

export { PEAK_THEMES };
