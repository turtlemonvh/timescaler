import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import type { AnimalId } from '../animals/roster';
import { hasWebGL } from '../webgl';

export interface AnimalShowcaseProps {
  animalId: AnimalId;
  pose?: Pose;
  /** Turntable speed, radians per second. */
  spin?: number;
  accent?: string;
  reducedMotion?: boolean;
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
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <cylinderGeometry args={[1.25, 1.4, 0.24, 24]} />
        <meshStandardMaterial color={accent} flatShading />
      </mesh>
      <Animal id={animalId} pose={pose} />
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
      camera={{ fov: 32, position: [0, 1.4, 4.6] }}
      style={{ position: 'absolute', inset: 0 }}
      data-testid="animal-showcase"
    >
      <hemisphereLight args={['#dbeafe', '#6fa05a', 0.8]} />
      <directionalLight castShadow intensity={1.8} color="#fff1d6" position={[3, 5, 4]} />
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
  useFrame(({ camera }) => camera.lookAt(0, 0.65, 0));
  return null;
}
