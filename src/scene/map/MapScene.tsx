import { Suspense, memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { PEAKS } from '../../engine/peaks';
import { mulberry32 } from '../../engine/rng';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import type { AnimalId } from '../animals/roster';
import { sceneDelta, sceneNow } from '../clock';
import { peakTheme } from '../theme/peakThemes';
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
  /** Bump to glide the camera back to the selected peak. */
  recenterKey?: number;
  reducedMotion?: boolean;
}

/** Player-driven camera offset: drag to pan, wheel or pinch to zoom. */
interface ViewControl {
  panX: number;
  panZ: number;
  zoom: number;
}

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

/** Stand points from `fromId` to `toId`, following the trail peak by peak. */
function trailBetween(fromId: number, toId: number): THREE.Vector3[] {
  const step = toId > fromId ? 1 : -1;
  const points: THREE.Vector3[] = [];
  for (let id = fromId + step; step > 0 ? id <= toId : id >= toId; id += step) {
    points.push(standPoint(peakSpotFor(id)));
  }
  return points;
}

interface Walk {
  points: THREE.Vector3[];
  index: number;
  started: number;
  /** Milliseconds per segment, by distance. */
  durations: number[];
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
  const walkRef = useRef<Walk | null>(null);
  const atRef = useRef(selectedPeakId);
  const facingRef = useRef(0.35);
  const seenRef = useRef(selectedPeakId);

  useFrame((_, rawDelta) => {
    const node = group.current;
    if (!node) return;
    const delta = sceneDelta(rawDelta);

    // A new selection starts a walk along the trail from wherever we are.
    if (selectedPeakId !== seenRef.current) {
      seenRef.current = selectedPeakId;
      const target = standPoint(peakSpotFor(selectedPeakId));
      if (reducedMotion) {
        node.position.copy(target);
        atRef.current = selectedPeakId;
        walkRef.current = null;
      } else {
        const points = [node.position.clone(), ...trailBetween(atRef.current, selectedPeakId)];
        const total = points.reduce(
          (sum, point, i) => (i === 0 ? 0 : sum + point.distanceTo(points[i - 1])),
          0,
        );
        // Long trips run and are capped, so crossing the island never drags on.
        const speed = total > 9 ? 9 : 5.5;
        const scale = Math.min(1, 2400 / ((total / speed) * 1000));
        walkRef.current = {
          points,
          index: 0,
          started: sceneNow(),
          durations: points.map((point, i) =>
            i === 0 ? 0 : (point.distanceTo(points[i - 1]) / speed) * 1000 * scale,
          ),
        };
        atRef.current = selectedPeakId;
        if (total > 0.1) setPose(total > 9 ? 'run' : 'walk');
      }
    }

    const walk = walkRef.current;
    if (walk) {
      const next = walk.points[walk.index + 1];
      if (!next) {
        walkRef.current = null;
        if (pose !== 'idle') setPose('idle');
        facingRef.current = 0.35;
      } else {
        const from = walk.points[walk.index];
        const ms = Math.max(1, walk.durations[walk.index + 1]);
        const t = Math.min(1, (sceneNow() - walk.started) / ms);
        node.position.lerpVectors(from, next, t);
        node.position.y = ISLAND_TOP + Math.abs(Math.sin(t * Math.PI * 5)) * 0.05;
        facingRef.current = Math.atan2(next.x - from.x, next.z - from.z);
        if (t >= 1) {
          walk.index += 1;
          walk.started = sceneNow();
        }
      }
    }
    node.rotation.y += (facingRef.current - node.rotation.y) * Math.min(1, delta * 8);
  });

  return (
    <group ref={group} position={standPoint(peakSpotFor(selectedPeakId))}>
      <Animal id={animalId} pose={pose} scale={0.9} />
    </group>
  );
}

const PAN_LIMIT = ISLAND_RADIUS + 2;

/**
 * Drag anywhere on the canvas to pan the island, wheel or pinch to zoom.
 * Clicks still select peaks: react-three-fiber only fires `onClick` when the
 * pointer moved less than a couple of pixels between down and up.
 */
function PanControls({ viewRef }: { viewRef: RefObject<ViewControl> }) {
  const { gl, size } = useThree();
  const dragRef = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    last: { x: 0, y: 0 },
    pinch: 0,
  });
  useEffect(() => {
    const element = gl.domElement;
    const drag = dragRef.current;
    const pinchDistance = () => {
      const [a, b] = [...drag.pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const onDown = (event: PointerEvent) => {
      drag.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      drag.last = { x: event.clientX, y: event.clientY };
      if (drag.pointers.size === 2) drag.pinch = pinchDistance();
      element.setPointerCapture?.(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      if (!drag.pointers.has(event.pointerId)) return;
      drag.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const view = viewRef.current;
      if (!view) return;
      if (drag.pointers.size >= 2) {
        const distance = pinchDistance();
        if (drag.pinch > 0 && distance > 0) {
          view.zoom = clamp(view.zoom * (drag.pinch / distance), MIN_ZOOM, MAX_ZOOM);
        }
        drag.pinch = distance;
        return;
      }
      const dx = event.clientX - drag.last.x;
      const dy = event.clientY - drag.last.y;
      drag.last = { x: event.clientX, y: event.clientY };
      // World units per pixel at the island, roughly, for this zoom and viewport.
      const k = (24 * view.zoom) / Math.max(320, size.width);
      view.panX = clamp(view.panX - dx * k, -PAN_LIMIT, PAN_LIMIT);
      view.panZ = clamp(view.panZ - dy * k * 1.4, -PAN_LIMIT, PAN_LIMIT);
    };
    const onUp = (event: PointerEvent) => {
      drag.pointers.delete(event.pointerId);
      if (drag.pointers.size < 2) drag.pinch = 0;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const view = viewRef.current;
      if (!view) return;
      view.zoom = clamp(view.zoom * (1 + event.deltaY * 0.0012), MIN_ZOOM, MAX_ZOOM);
    };
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('wheel', onWheel);
    };
  }, [gl, size.width, viewRef]);
  return null;
}

const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

function MapCamera({
  selectedPeakId,
  recenterKey,
  viewRef,
  reducedMotion,
}: {
  selectedPeakId: number;
  recenterKey: number;
  viewRef: RefObject<ViewControl>;
  reducedMotion: boolean;
}) {
  const { camera, size } = useThree();
  const lookRef = useRef(new THREE.Vector3());
  const firstRef = useRef(true);
  const seenRef = useRef(`${selectedPeakId}:${recenterKey}`);
  useFrame((_, delta) => {
    const view = viewRef.current;
    if (!view) return;
    const key = `${selectedPeakId}:${recenterKey}`;
    if (key !== seenRef.current) {
      // A new selection or an explicit recenter glides the view back onto the climber.
      seenRef.current = key;
      view.panX = 0;
      view.panZ = 0;
      view.zoom = 1;
    }
    const spot = peakSpotFor(selectedPeakId);
    const portrait = size.height > size.width;
    const stand = standPoint(spot);
    const cx = stand.x * 0.6 + view.panX;
    const cz = stand.z + view.panZ;
    const height = (portrait ? 11 : 8.5) * view.zoom;
    const back = (portrait ? 13 : 11) * view.zoom;
    desiredCamera.set(cx, ISLAND_TOP + height, cz + back);
    desiredLook.set(cx, ISLAND_TOP + spot.height * 0.35, cz - 2.5);
    if (firstRef.current || reducedMotion) {
      camera.position.copy(desiredCamera);
      lookRef.current.copy(desiredLook);
      firstRef.current = false;
    } else {
      const k = 1 - Math.exp(-delta * 3.2);
      camera.position.lerp(desiredCamera, k);
      lookRef.current.lerp(desiredLook, k);
    }
    camera.lookAt(lookRef.current);
  });
  return null;
}

/**
 * The overworld: ten peaks on an island, the player's animal standing at the
 * selected one and trotting over when the selection changes. Clicking a
 * mountain selects it; the DOM list beside the scene does the rest.
 */
function MapScene({
  selectedPeakId,
  summitedPeakIds,
  animalId,
  onSelectPeak,
  recenterKey = 0,
  reducedMotion = false,
}: MapSceneProps) {
  const pines = useMemo(() => islandPines(), []);
  const viewRef = useRef<ViewControl>({ panX: 0, panZ: 0, zoom: 1 });
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
      dpr={[1, 1.5]}
      camera={{ fov: 38, near: 0.1, far: 400, position: [0, 9, 14] }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
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
      <PanControls viewRef={viewRef} />
      <MapCamera
        selectedPeakId={selectedPeakId}
        recenterKey={recenterKey}
        viewRef={viewRef}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}

export default memo(MapScene);
