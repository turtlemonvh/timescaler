import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export interface PineSpot {
  x: number;
  y: number;
  z: number;
  scale: number;
  /** Radians, so a forest is not a grid of identical trees. */
  rotation?: number;
  /** Lean towards +Z (out from a wall), in radians, pivoting on the trunk's base. */
  tilt?: number;
}

export interface PinesProps {
  spots: readonly PineSpot[];
  leaf: string;
  leafDark: string;
  trunk?: string;
}

const TRUNK = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 5);
const LOWER = new THREE.ConeGeometry(0.55, 1.0, 6);
const UPPER = new THREE.ConeGeometry(0.38, 0.9, 6);

/**
 * Instanced low-poly pines: one draw call per part, so a forest of a few
 * hundred trees costs the same as three trees.
 */
export default function Pines({ spots, leaf, leafDark, trunk = '#6b4a2e' }: PinesProps) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const lowerRef = useRef<THREE.InstancedMesh>(null);
  const upperRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useLayoutEffect(() => {
    const place = (mesh: THREE.InstancedMesh | null, yOffset: number) => {
      if (!mesh) return;
      spots.forEach((spot, i) => {
        // Lean about the trunk's base, so a tilted tree stays rooted.
        const tilt = spot.tilt ?? 0;
        const up = yOffset * spot.scale;
        dummy.position.set(spot.x, spot.y + up * Math.cos(tilt), spot.z + up * Math.sin(tilt));
        dummy.rotation.set(tilt, spot.rotation ?? 0, 0);
        dummy.scale.setScalar(spot.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    place(trunkRef.current, 0.25);
    place(lowerRef.current, 0.85);
    place(upperRef.current, 1.5);
  }, [spots, dummy]);

  if (spots.length === 0) return null;
  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[TRUNK, undefined, spots.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={trunk} flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={lowerRef}
        args={[LOWER, undefined, spots.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={leafDark} flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={upperRef}
        args={[UPPER, undefined, spots.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={leaf} flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}
