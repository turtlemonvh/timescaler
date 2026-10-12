import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    float t = pow(max(h, 0.0), exponent);
    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
  }
`;

export interface SkyDomeProps {
  top: string;
  bottom: string;
  /** Sun disc colour; omit for no sun. */
  sun?: string;
  sunPosition?: [number, number, number];
}

/** A gradient dome that follows the camera, so the horizon is always behind everything. */
export default function SkyDome({ top, bottom, sun, sunPosition = [60, 45, -120] }: SkyDomeProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          topColor: { value: new THREE.Color(top) },
          bottomColor: { value: new THREE.Color(bottom) },
          offset: { value: 20 },
          exponent: { value: 0.7 },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [top, bottom],
  );

  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.position.copy(camera.position);
  });

  return (
    <group>
      <mesh ref={mesh} material={material} renderOrder={-10}>
        <sphereGeometry args={[300, 24, 12]} />
      </mesh>
      {sun && (
        <mesh position={sunPosition}>
          <sphereGeometry args={[7, 12, 8]} />
          <meshBasicMaterial color={sun} fog={false} />
        </mesh>
      )}
    </group>
  );
}
