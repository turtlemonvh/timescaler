import { Suspense, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import type { AnimalId } from '../animals/roster';
import { peakTheme } from '../theme/peakThemes';
import { hasWebGL } from '../webgl';
import Birds from '../world/Birds';
import Particles, { type ParticleApi } from '../world/Particles';
import SkyDome from '../world/SkyDome';
import CameraRig from './CameraRig';
import { ledgePoint, summitY } from './cliffPath';
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
export default function ClimbScene({
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
      dpr={[1, 1.75]}
      camera={{ fov: 42, near: 0.1, far: 400, position: [0, 2, 8] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="climb-scene"
    >
      <color attach="background" args={[theme.skyBottom]} />
      <fog attach="fog" args={[theme.fog, 18, 70]} />
      <SkyDome top={theme.skyTop} bottom={theme.skyBottom} sun="#fff4c2" />

      <hemisphereLight args={[theme.skyTop, theme.ground, 0.7]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={sunRef}
        castShadow
        intensity={1.9 * theme.daylight}
        color="#fff1d6"
        position={[6, 10, 7]}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0008}
      />

      <CliffWorld theme={theme} height={height} position={position} />
      <Birds y={Math.min(summitY(height), start.y + 4)} z={-5} />
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
          shakeRef={shakeRef}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      <CameraRig
        targetRef={climberPositionRef}
        shakeRef={shakeRef}
        phase={phase}
        reducedMotion={reducedMotion}
        lightRef={sunRef}
      />
    </Canvas>
  );
}
