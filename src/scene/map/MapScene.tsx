import { Suspense, memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import * as THREE from 'three';
import { PEAKS } from '../../engine/peaks';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import type { AnimalId } from '../animals/roster';
import { sceneDelta, sceneNow } from '../clock';
import { peakTheme } from '../theme/peakThemes';
import { hasWebGL } from '../webgl';
import Clouds from '../world/Clouds';
import Pines from '../world/Pines';
import SkyDome from '../world/SkyDome';
import { islandPines } from './islandPines';
import {
  ISLAND_RADIUS,
  PEAK_SPOTS,
  peakSpotFor,
  standPoint as standSpot,
  type PeakSpot,
} from './peakLayout';
import { trailHeadingAt, trailPointAt, trailSamples, trailStop } from './trailPath';
import { travelPlan } from './travel';

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

/** Where the animal stands for a given peak (see `peakLayout.standPoint`), on the island top. */
function standPoint(spot: PeakSpot): THREE.Vector3 {
  const stand = standSpot(spot);
  return new THREE.Vector3(stand.x, ISLAND_TOP, stand.z);
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
  const rock = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.06;
      ring.current.scale.set(s, s, s);
    }
    // The selected mountain glows gently in its own colour, so the selection
    // reads even where the ring at its foot is behind another cone, without
    // tinting it (a saturated flag colour turned peak 10 magenta).
    if (rock.current) {
      rock.current.emissiveIntensity = selected ? 0.16 + Math.sin(clock.elapsedTime * 3) * 0.08 : 0;
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
          ref={rock}
          color={hovered || selected ? theme.rock : theme.rockDark}
          emissive={theme.rock}
          emissiveIntensity={0}
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
    // Drawn last, over everything: depthTest off only beats opaque geometry,
    // so without the render order a transparent mesh sorted behind the badge
    // (a cloud, the selection ring) could still paint over it.
    <sprite position={position} scale={[size, size, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

/** Stepping stones along the shared trail path — the same path the animal walks. */
function Trail() {
  const stones = useMemo(() => {
    const stands = PEAK_SPOTS.map(standSpot);
    // Leave the stand points themselves clear: the animal and its ring sit there.
    return trailSamples(0.9).filter((stone) =>
      stands.every((stand) => Math.hypot(stand.x - stone.x, stand.z - stone.z) > 0.6),
    );
  }, []);
  return (
    <group>
      {stones.map((stone, i) => (
        <mesh
          key={i}
          position={[stone.x, ISLAND_TOP + 0.02, stone.z]}
          rotation={[-Math.PI / 2, 0, i * 1.7]}
        >
          <circleGeometry args={[0.22, 6]} />
          <meshStandardMaterial color="#c9b58a" />
        </mesh>
      ))}
    </group>
  );
}

/** A walk along the trail, from one arc length to another. */
interface Walk {
  from: number;
  to: number;
  started: number;
  ms: number;
}

/** Shortest signed difference between two angles, so turning never goes the long way round. */
function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Facing when standing at a peak: towards the camera, a little to the right. */
const IDLE_FACING = 0.35;

function Wanderer({
  selectedPeakId,
  animalId,
  reducedMotion,
  followRef,
}: {
  selectedPeakId: number;
  animalId: AnimalId;
  reducedMotion: boolean;
  /** Written every frame with where the animal is, for the camera to follow. */
  followRef: RefObject<THREE.Vector3 | null>;
}) {
  const group = useRef<THREE.Group>(null);
  const [pose, setPose] = useState<Pose>('idle');
  const [timeScale, setTimeScale] = useState(1);
  const walkRef = useRef<Walk | null>(null);
  /** Where the animal is, as an arc length along the trail. */
  const alongRef = useRef(trailStop(selectedPeakId));
  const facingRef = useRef(IDLE_FACING);
  const seenRef = useRef(selectedPeakId);
  // Mount-only: a fresh Vector3 every render would make react-three-fiber
  // re-apply `position` and snap the animal onto the new peak before the walk
  // below ever starts. A stable array is applied once and then left alone.
  const [initialPosition] = useState(
    () => standPoint(peakSpotFor(selectedPeakId)).toArray() as [number, number, number],
  );

  useFrame((_, rawDelta) => {
    const node = group.current;
    if (!node) return;
    const delta = sceneDelta(rawDelta);

    // A new selection starts a walk along the trail from wherever we are —
    // mid-walk included, since the position is just a distance along it.
    if (selectedPeakId !== seenRef.current) {
      seenRef.current = selectedPeakId;
      const to = trailStop(selectedPeakId);
      if (reducedMotion) {
        alongRef.current = to;
        walkRef.current = null;
        facingRef.current = IDLE_FACING;
      } else {
        const from = alongRef.current;
        const total = Math.abs(to - from);
        // Mid-gallop, keep the clip's rate: changing it restarts the clip.
        const galloping = walkRef.current !== null && pose === 'run';
        const plan = travelPlan(total, animalId, galloping ? timeScale : undefined);
        walkRef.current = total > 0.05 ? { from, to, started: sceneNow(), ms: plan.ms } : null;
        if (walkRef.current) {
          setPose(plan.pose);
          setTimeScale(plan.timeScale);
        }
      }
    }

    const walk = walkRef.current;
    if (walk) {
      const t = Math.min(1, (sceneNow() - walk.started) / Math.max(1, walk.ms));
      alongRef.current = walk.from + (walk.to - walk.from) * t;
      const heading = trailHeadingAt(alongRef.current);
      facingRef.current = walk.to > walk.from ? heading : heading + Math.PI;
      if (t >= 1) {
        walkRef.current = null;
        facingRef.current = IDLE_FACING;
      }
    } else if (pose !== 'idle') {
      setPose('idle');
    }
    const at = trailPointAt(alongRef.current);
    node.position.set(at.x, ISLAND_TOP, at.z);
    if (followRef.current) followRef.current.copy(node.position);
    else followRef.current = node.position.clone();
    node.rotation.y += angleDelta(node.rotation.y, facingRef.current) * Math.min(1, delta * 8);
  });

  return (
    <group ref={group} position={initialPosition}>
      <Animal id={animalId} pose={pose} timeScale={pose === 'idle' ? 1 : timeScale} scale={0.9} />
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

/** How far ahead of the animal, towards where it's going, the camera aims. */
const CAMERA_LEAD = 2.5;
const desiredCamera = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

function MapCamera({
  selectedPeakId,
  recenterKey,
  viewRef,
  followRef,
  reducedMotion,
}: {
  selectedPeakId: number;
  recenterKey: number;
  viewRef: RefObject<ViewControl>;
  /** The animal's position (from `Wanderer`); the stand point until it has loaded. */
  followRef: RefObject<THREE.Vector3 | null>;
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
    // Follow the animal, not the destination: on a long trip the camera
    // travels with it along the trail instead of leaving it off-screen.
    // It leads a little towards the destination, so the peak being walked to
    // comes into view before the animal gets there.
    const stand = standPoint(spot);
    const focus = followRef.current ?? stand;
    const lead = Math.hypot(stand.x - focus.x, stand.z - focus.z);
    const k = lead > 0 ? Math.min(1, CAMERA_LEAD / lead) : 0;
    // Wide screens keep the island's middle in view; a narrow portrait frame
    // has no room for that and must centre on the animal or lose it.
    const cx = (focus.x + (stand.x - focus.x) * k) * (portrait ? 0.9 : 0.6) + view.panX;
    const cz = focus.z + (stand.z - focus.z) * k + view.panZ;
    // About 52° down (wide) / 57° (portrait): steep enough that a mountain
    // doesn't hide the foot of the one behind it, and the look point rides
    // up with tall peaks so their badge stays in frame.
    // On a long trip the view also pulls back with the distance still to
    // go, so the selected peak stays in frame alongside the animal; it
    // settles back as the animal arrives. Never past MAX_ZOOM, which keeps
    // the camera under the clouds.
    const travel = 1 + clamp((lead - CAMERA_LEAD) / 12, 0, 0.45);
    const zoom = Math.min(MAX_ZOOM, view.zoom * travel);
    const height = (portrait ? 16.5 : 11.5) * zoom;
    const back = (portrait ? 10.5 : 9) * zoom;
    desiredCamera.set(cx, ISLAND_TOP + height, cz + back);
    desiredLook.set(cx, ISLAND_TOP + spot.height * (portrait ? 0.6 : 0.55), cz - 2.5);
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
  const pines = useMemo(() => islandPines(ISLAND_TOP), []);
  const viewRef = useRef<ViewControl>({ panX: 0, panZ: 0, zoom: 1 });
  const followRef = useRef<THREE.Vector3 | null>(null);
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
        // Twice as far out as the island needs, same direction, so the
        // shadow camera also takes in the clouds high overhead.
        position={[28, 44, 20]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={130}
        shadow-bias={-0.0006}
        // Slightly see-through shadows, so a passing cloud's shade reads as
        // shade rather than a hole in the island.
        shadow-intensity={0.85}
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
      {/* Clouds sit above the highest the camera ever goes (portrait, fully
          zoomed out: y ≈ 27.2; the lowest puff bottoms out ~2.3 below a
          cloud's centre), so they never drift through the lens or hide a
          badge; what the player sees is their shadows crawling over the
          island. The sun is up and to the +X/+Z side, so a cloud at y 34
          shadows the ground about (-22, -15) from where it is: the ranges are
          offset by that much to put the shadows on the island. Opaque, so
          they never join the transparent sort. */}
      <Clouds
        count={7}
        seed={99}
        xRange={[-13, 55]}
        yRange={[33, 36]}
        zRange={[-2, 30]}
        speed={0.6}
        size={1.3}
        opacity={1}
        castShadow
      />

      <Suspense fallback={null}>
        <Wanderer
          selectedPeakId={selectedPeakId}
          animalId={animalId}
          reducedMotion={reducedMotion}
          followRef={followRef}
        />
      </Suspense>
      <PanControls viewRef={viewRef} />
      <MapCamera
        selectedPeakId={selectedPeakId}
        recenterKey={recenterKey}
        viewRef={viewRef}
        followRef={followRef}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}

export default memo(MapScene);
