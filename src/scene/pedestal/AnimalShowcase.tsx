import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import { ANIMALS, type AnimalId } from '../animals/roster';
import { hasWebGL } from '../webgl';

export interface AnimalShowcaseProps {
  animalId: AnimalId;
  pose?: Pose;
  /** Turntable speed, radians per second. */
  spin?: number;
  accent?: string;
  reducedMotion?: boolean;
}

/**
 * Pick-screen size: the roster heights span 1.0 (fox) to 1.6 (stag), which
 * left the small animals lost on their pedestals. Pull every animal most of
 * the way towards a common display height so all six fill their cards (the long fox and wolf still need room to swing)
 * while the stag still stands a little taller than the fox.
 */
function displayScale(animalId: AnimalId): number {
  const height = ANIMALS.find((animal) => animal.id === animalId)?.height ?? 1.25;
  return Math.pow(1.3 / height, 0.4);
}

function Turntable({ animalId, pose, spin, accent, reducedMotion }: Required<AnimalShowcaseProps>) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // Swing across the front rather than a full turn, so the face stays visible.
    if (group.current && !reducedMotion) {
      group.current.rotation.y = 0.3 + Math.sin(clock.elapsedTime * spin) * 0.75;
    }
  });
  return (
    <group ref={group} rotation={[0, 0.3, 0]}>
      {/* Narrower than the view at z = 0 (±1.1 in a square card), so the rim reads. */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.86, 0.98, 0.24, 28]} />
        <meshStandardMaterial color={accent} flatShading />
      </mesh>
      <group scale={displayScale(animalId)}>
        <Animal id={animalId} pose={pose} />
      </group>
    </group>
  );
}

/** A small turntable canvas for the character pick screen. */
export default function AnimalShowcase({
  animalId,
  pose = 'idle',
  spin = 0.6,
  accent = '#d8c3a5',
  reducedMotion = false,
}: AnimalShowcaseProps) {
  if (!hasWebGL()) {
    return <div className="scene-fallback" data-testid="animal-showcase-fallback" />;
  }
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 1.5]}
      camera={{ fov: 30, position: [0, 1.35, 4.3] }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="animal-showcase"
    >
      <hemisphereLight args={['#dbeafe', '#c9b9a4', 0.85]} />
      {/* Key from front-right, high; a cool fill from front-left keeps the face
          out of shadow at the left end of the turntable swing. */}
      <directionalLight castShadow intensity={1.7} color="#fff1d6" position={[2.5, 5, 4.5]} />
      <directionalLight intensity={0.6} color="#dfe9ff" position={[-3, 2, 3]} />
      <Suspense fallback={null}>
        <Turntable
          animalId={animalId}
          pose={pose}
          spin={spin}
          accent={accent}
          reducedMotion={reducedMotion}
        />
      </Suspense>
      <CameraLook />
    </Canvas>
  );
}

function CameraLook() {
  useFrame(({ camera }) => camera.lookAt(0, 0.6, 0));
  return null;
}
