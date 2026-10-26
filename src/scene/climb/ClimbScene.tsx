import { Suspense, memo, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ANIMALS, type AnimalId } from '../animals/roster';
import { peakTheme } from '../theme/peakThemes';
import { hasWebGL } from '../webgl';
import Birds from '../world/Birds';
import Particles, { type ParticleApi } from '../world/Particles';
import SkyDome from '../world/SkyDome';
import Weather from '../world/Weather';
import CameraRig from './CameraRig';
import { FOREST_FLOOR, ledgePoint, summitY } from './cliffPath';
import CliffWorld from './CliffWorld';
import Climber from './Climber';
import type { ClimbMove } from './motion';

export type ClimbPhase = 'climb' | 'summit' | 'fell';

/** Stands in for the animal while its model downloads: a bobbing pebble on the ledge. */
function LoadingMarker({ position }: { position: { x: number; y: number; z: number } }) {
  return (
    <mesh position={[position.x, position.y + 0.35, position.z + 0.2]}>
      <icosahedronGeometry args={[0.3, 0]} />
      <meshStandardMaterial color="#ffffff" flatShading transparent opacity={0.7} />
    </mesh>
  );
}

export interface ClimbSceneProps {
  peakId: number;
  animalId: AnimalId;
  position: number;
  height: number;
  move: ClimbMove | null;
  phase: ClimbPhase;
  /** Boost meter full — the climber glows. */
  boosted?: boolean;
  reducedMotion?: boolean;
}

/**
 * The whole climb as one three.js scene. Props are the engine's numbers plus
 * the last `ClimbMove`; nothing in here decides gameplay. Falls back to a
 * sky-gradient `div` when WebGL is unavailable so the game stays playable.
 */
function ClimbScene({
  peakId,
  animalId,
  position,
  height,
  move,
  phase,
  boosted = false,
  reducedMotion = false,
}: ClimbSceneProps) {
  const theme = useMemo(() => peakTheme(peakId), [peakId]);
  const particlesRef = useRef<ParticleApi | null>(null);
  const start = ledgePoint(position, peakId);
  const climberPositionRef = useRef(new THREE.Vector3(start.x, start.y, start.z));
  const framingRef = useRef(new THREE.Vector3(start.x, start.y, start.z));
  const heroHeight = ANIMALS.find((animal) => animal.id === animalId)?.height ?? 1.2;
  const shakeRef = useRef(0);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);

  if (!hasWebGL()) {
    return (
      <div
        className="scene-fallback"
        data-testid="climb-scene-fallback"
        style={{ background: `linear-gradient(${theme.skyTop}, ${theme.skyBottom})` }}
      />
    );
  }

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 42, near: 0.1, far: 400, position: [0, 2, 8] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="climb-scene"
    >
      <color attach="background" args={[theme.skyBottom]} />
      <fog attach="fog" args={[theme.fog, 18, 70]} />
      <SkyDome top={theme.skyTop} bottom={theme.skyBottom} sun="#fff4c2" />

      <hemisphereLight args={[theme.skyTop, theme.ground, 0.7 + 0.7 * (1 - theme.daylight)]} />
      <ambientLight intensity={0.4} />
      {/* Directional lights only use position - target as a direction, so these
          stay put while the sun follows the climber. A cool, shadowless fill
          from the camera side lifts the shadowed faces (most on the low-sun
          peaks, which otherwise crush to black), and a warm rim from behind
          the wall catches the animal's back edge so it separates from the rock
          (the wall faces +Z, so the rim never lights its face). */}
      <directionalLight
        intensity={0.25 + 0.6 * (1 - theme.daylight)}
        color="#cfdcff"
        position={[-4, 3, 8]}
      />
      <directionalLight intensity={0.7} color="#ffd9a8" position={[5, 4, -6]} />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={1.9 * (0.55 + 0.45 * theme.daylight)}
        color="#fff1d6"
        position={[6, 10, 7]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={3}
      />

      <CliffWorld theme={theme} height={height} position={position} />
      {/* In front of the wall (which is solid down to its edge) and in the
          strip of sky above the climber's head, clear of the forest. At the
          summit they cross close in front of the flag pole and wall, so the
          swinging camera never has them brush past the lens. */}
      {/* Banded on the hop's landing point, not the animal: a hop's apex stays
          within ~1.8 (head) of the landing, so the flock never meets it. */}
      <Birds
        followRef={framingRef}
        y={phase === 'summit' ? 2 : 2.6}
        z={phase === 'summit' ? 0.9 : 1.4}
        screenY={0.7}
        span={7}
        minY={phase === 'summit' ? summitY(height) + 2 : FOREST_FLOOR + 5}
        maxY={summitY(height) + 3.4}
        scale={phase === 'summit' ? 1.1 : 1.4}
      />
      <Weather
        kind={reducedMotion ? 'none' : theme.weather}
        followRef={climberPositionRef}
        colors={
          theme.weather === 'snow'
            ? ['#ffffff', '#eef6ff']
            : ['#d9822b', '#c0392b', '#e3a722', '#8a5a3b']
        }
      />
      <Particles ref={particlesRef} max={320} />

      <Suspense fallback={<LoadingMarker position={start} />}>
        <Climber
          animalId={animalId}
          peakId={peakId}
          position={position}
          move={move}
          phase={phase}
          boosted={boosted}
          theme={theme}
          particlesRef={particlesRef}
          worldPositionRef={climberPositionRef}
          framingRef={framingRef}
          shakeRef={shakeRef}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      <CameraRig
        targetRef={climberPositionRef}
        framingRef={framingRef}
        heroHeight={heroHeight}
        shakeRef={shakeRef}
        phase={phase}
        reducedMotion={reducedMotion}
        lightRef={sunRef}
      />
    </Canvas>
  );
}

/** Memoized: the climb screen re-renders every 100 ms for the timer; none of that reaches the scene. */
export default memo(ClimbScene);
