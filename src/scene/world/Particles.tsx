import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface BurstOptions {
  x: number;
  y: number;
  z: number;
  count: number;
  colors: readonly string[];
  /** Initial speed, units per second. */
  speed: number;
  /** Downward acceleration. Negative floats up. */
  gravity: number;
  /** Seconds. */
  life: number;
  size: number;
  /** Bias the burst upward (0 = isotropic, 1 = mostly up). */
  up?: number;
  /** Spin, radians per second. */
  spin?: number;
}

export interface ParticleApi {
  burst(options: BurstOptions): void;
}

export interface ParticlesProps {
  max?: number;
  shape?: 'box' | 'sphere';
}

interface Slot {
  alive: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  spin: number;
  age: number;
  life: number;
  size: number;
  gravity: number;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(0.5, 5, 4);

/**
 * One instanced mesh that every effect in a scene shares: dust on a landing,
 * sparkles on a fast answer, confetti at the summit. Callers `burst()` through
 * the ref; the update loop runs in `useFrame` and recycles dead slots.
 */
const Particles = forwardRef<ParticleApi, ParticlesProps>(function Particles(
  { max = 360, shape = 'box' },
  ref,
) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const slots = useMemo<Slot[]>(
    () =>
      Array.from({ length: max }, () => ({
        alive: false,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        spin: 0,
        age: 0,
        life: 1,
        size: 0.1,
        gravity: 0,
      })),
    [max],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useImperativeHandle(
    ref,
    () => ({
      burst(options) {
        const instanced = mesh.current;
        if (!instanced) return;
        let spawned = 0;
        for (const slot of slots) {
          if (spawned >= options.count) break;
          if (slot.alive) continue;
          const up = options.up ?? 0.5;
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(1 - 2 * Math.random());
          slot.velocity
            .set(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi) * (1 - up) + up,
              Math.sin(phi) * Math.sin(theta),
            )
            .normalize()
            .multiplyScalar(options.speed * (0.5 + Math.random() * 0.8));
          slot.position.set(options.x, options.y, options.z);
          slot.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
          slot.spin = (options.spin ?? 0) * (Math.random() - 0.5) * 2;
          slot.age = 0;
          slot.life = options.life * (0.7 + Math.random() * 0.6);
          slot.size = options.size * (0.6 + Math.random() * 0.8);
          slot.gravity = options.gravity;
          slot.alive = true;
          const index = slots.indexOf(slot);
          color.set(options.colors[Math.floor(Math.random() * options.colors.length)]);
          instanced.setColorAt(index, color);
          spawned += 1;
        }
        if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
      },
    }),
    [slots, color],
  );

  useFrame((_, delta) => {
    const instanced = mesh.current;
    if (!instanced) return;
    const dt = Math.min(delta, 0.05);
    slots.forEach((slot, i) => {
      if (!slot.alive) {
        dummy.scale.setScalar(0);
        dummy.position.set(0, -1000, 0);
      } else {
        slot.age += dt;
        if (slot.age >= slot.life) {
          slot.alive = false;
          dummy.scale.setScalar(0);
        } else {
          slot.velocity.y -= slot.gravity * dt;
          slot.velocity.multiplyScalar(1 - 1.2 * dt);
          slot.position.addScaledVector(slot.velocity, dt);
          slot.rotation.x += slot.spin * dt;
          slot.rotation.z += slot.spin * 0.7 * dt;
          const fade = 1 - slot.age / slot.life;
          dummy.position.copy(slot.position);
          dummy.rotation.copy(slot.rotation);
          dummy.scale.setScalar(slot.size * (0.4 + 0.6 * fade));
        }
      }
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[shape === 'box' ? BOX : SPHERE, undefined, max]}
      frustumCulled={false}
    >
      <meshStandardMaterial roughness={0.8} flatShading />
    </instancedMesh>
  );
});

export default Particles;
