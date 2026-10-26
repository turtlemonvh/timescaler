import { useMemo, useRef, useState, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Animal from '../animals/Animal';
import type { Pose } from '../animals/clips';
import { sceneDelta, sceneNow } from '../clock';
import type { AnimalId } from '../animals/roster';
import type { PeakTheme } from '../theme/peakThemes';
import type { ParticleApi } from '../world/Particles';
import { fallLanding, ledgePoint, type Vec3 } from './cliffPath';
import {
  AIR_TURN_RATE,
  buildFlight,
  flightBody,
  flightPoint,
  tumbleAngles,
  type FlightSegment,
} from './flight';
import { FALL_MS, HOP_MS, SLIP_LEAP_MS, type ClimbMove } from './motion';

export interface ClimberProps {
  animalId: AnimalId;
  peakId: number;
  /** Engine position; where the climber rests when no move is playing. */
  position: number;
  move: ClimbMove | null;
  phase: 'climb' | 'summit' | 'fell';
  /** Boost meter is full: the next correct answer moves two ledges. */
  boosted: boolean;
  theme: PeakTheme;
  particlesRef: RefObject<ParticleApi | null>;
  /** Written every frame: where the climber currently is, for the camera. */
  worldPositionRef: RefObject<THREE.Vector3>;
  /** Written every frame: where the current hop or fall lands (else the climber's position), so the camera can lead. */
  framingRef?: RefObject<THREE.Vector3>;
  /** Written when a fall lands, so the camera can shake. */
  shakeRef: RefObject<number>;
  reducedMotion: boolean;
}

/** Where in its clip a pose starts or freezes (see `configureAction`). */
interface ClipFrame {
  hold?: number;
  startAt?: number;
}

interface Tween {
  kind: ClimbMove['kind'];
  /** The whole move, computed up front: `segments[segments.length - 1].to` is where it ends. */
  segments: FlightSegment[];
  index: number;
  started: number;
  tumble: boolean;
}

/** Quaternius animals face +Z. Rotating by +PI/2 about Y turns +Z into +X. */
const FORWARD_RIGHT = Math.PI / 2;
/** How fast (1/s) the climber turns while standing. */
const GROUND_TURN_RATE = 10;
/** The settle after a hop: the land clip from touchdown, not its own little hop. */
const LAND_MS = 320;

function faceToward(dx: number, idle: boolean): number {
  const side = dx >= 0 ? 1 : -1;
  // Resting: a three-quarter turn towards the camera so the face is visible.
  return idle ? side * FORWARD_RIGHT * 0.45 : side * FORWARD_RIGHT;
}

/**
 * Drives the animal along the route. Everything time-based runs inside
 * `useFrame` — new moves are detected there by id, so the scene never
 * schedules React work from an effect. React state is only the pose, which
 * changes a few times per move. Every move comes from `ClimbMove`, never
 * from "correct"/"wrong", so what the player sees is exactly what the rules
 * did.
 */
export default function Climber({
  animalId,
  peakId,
  position,
  move,
  phase,
  boosted,
  theme,
  particlesRef,
  worldPositionRef,
  framingRef,
  shakeRef,
  reducedMotion,
}: ClimberProps) {
  const glowRef = useRef<THREE.Group>(null);
  const sparkTimerRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const tweenRef = useRef<Tween | null>(null);
  const restRef = useRef<Vec3 | null>(null);
  const facingRef = useRef(faceToward(1, true));
  const squashRef = useRef(0);
  const seenMoveRef = useRef<number | null>(null);
  const seenPhaseRef = useRef<string | null>(null);
  const lookTimerRef = useRef(0);
  const cheerTimerRef = useRef(0);
  const [pose, setPose] = useState<Pose>('idle');
  const [poseKey, setPoseKey] = useState(0);
  const [fitMs, setFitMs] = useState<number | undefined>(undefined);
  const [clipFrame, setClipFrame] = useState<ClipFrame>({});
  const body = useMemo(() => flightBody(animalId), [animalId]);

  function play(next: Pose, fit?: number, frame: ClipFrame = {}) {
    setPose(next);
    setFitMs(fit);
    setClipFrame(frame);
    setPoseKey((key) => key + 1);
  }

  function playSegment(segment: FlightSegment) {
    play(segment.pose, segment.ms, { hold: segment.hold, startAt: segment.startAt });
  }

  function startMove(next: ClimbMove, node: THREE.Group, now: number) {
    const segments = buildFlight(next, peakId, body);
    const from = ledgePoint(next.from, peakId);

    if (reducedMotion) {
      const last = segments[segments.length - 1];
      restRef.current = last ? last.to : from;
      tweenRef.current = null;
      node.position.set(restRef.current.x, restRef.current.y, restRef.current.z);
      play(next.kind === 'fall' ? 'fall' : next.kind === 'slip' ? 'hit' : 'land');
      return;
    }

    tweenRef.current = {
      kind: next.kind,
      segments,
      index: 0,
      started: now,
      tumble: next.kind === 'fall',
    };
    const first = segments[0];
    if (first?.face) facingRef.current = faceToward(first.face, false);

    if (next.kind === 'fall') {
      play('fall', FALL_MS + 200);
      particlesRef.current?.burst({
        x: from.x,
        y: from.y + 0.2,
        z: from.z + 0.4,
        count: 10,
        colors: [theme.rockDark, theme.rock],
        speed: 1.6,
        gravity: 5,
        life: 0.7,
        size: 0.12,
        up: 0.3,
      });
    } else if (next.kind === 'slip') {
      play('jump', SLIP_LEAP_MS);
    } else {
      play('jump', first ? first.ms : HOP_MS);
      if (next.fast) {
        particlesRef.current?.burst({
          x: from.x,
          y: from.y + 0.5,
          z: from.z + 0.5,
          count: 14,
          colors: ['#ffe066', '#fff5b8', theme.flag],
          speed: 1.4,
          gravity: -1.5,
          life: 0.8,
          size: 0.09,
          up: 0.7,
          spin: 6,
        });
      }
    }
  }

  function finishSegment(current: Tween, segment: FlightSegment, node: THREE.Group, now: number) {
    node.position.set(segment.to.x, segment.to.y, segment.to.z);
    if (segment.squashOnLand) squashRef.current = 1;
    if (segment.dustOnLand) {
      const big = current.kind === 'fall';
      // Small rock-coloured grit thrown off the front lip, falling fast:
      // big white cubes resting on the slab read as sugar cubes.
      particlesRef.current?.burst({
        x: segment.to.x,
        y: segment.to.y + 0.05,
        z: segment.to.z + (big ? 0.3 : 0.5),
        count: segment.dustCount ?? (big ? 40 : current.kind === 'slip' ? 16 : 10),
        colors: big ? [theme.ground, theme.rockDark] : [theme.rockDark, theme.rock],
        speed: big ? 3.2 : 1.3,
        gravity: big ? 6 : 9,
        life: big ? 1.1 : 0.55,
        size: big ? 0.14 : 0.07,
        up: 0.6,
      });
      if (big) shakeRef.current = 1;
    }
    current.index += 1;
    current.started = now;
    const next = current.segments[current.index];
    if (next) {
      if (next.face) facingRef.current = faceToward(next.face, false);
      playSegment(next);
      return;
    }
    restRef.current = segment.to;
    tweenRef.current = null;
    if (current.kind === 'fall') {
      if (bodyRef.current) bodyRef.current.rotation.set(0, 0, 0);
      // The Death clip holds its last frame: the animal stays down.
    } else if (current.kind === 'summit') {
      facingRef.current = faceToward(1, true);
      cheerTimerRef.current = 0;
      play('cheer');
    } else {
      facingRef.current = faceToward(facingRef.current, true);
      // A slip already settled with the land clip on its last segment.
      if (segment.pose === 'land') play('idle');
      else play('land', LAND_MS, { startAt: body.touchdown });
    }
  }

  useFrame((_, rawDelta) => {
    const node = groupRef.current;
    if (!node) return;
    const delta = sceneDelta(rawDelta);
    const now = sceneNow();

    // First frame, or the engine moved us without a move (e.g. a reset). A
    // fallen climber rests where the tumble ended, not back on ledge 0.
    if (!restRef.current) {
      restRef.current = phase === 'fell' ? fallLanding(peakId) : ledgePoint(position, peakId);
      node.position.set(restRef.current.x, restRef.current.y, restRef.current.z);
    }

    if (phase !== seenPhaseRef.current) {
      seenPhaseRef.current = phase;
      if (phase === 'summit' && !tweenRef.current) play('cheer');
      if (phase === 'fell' && pose !== 'fall') play('fall');
    }

    if (move && move.kind !== 'none' && move.id !== seenMoveRef.current) {
      seenMoveRef.current = move.id;
      startMove(move, node, now);
    } else if (!move && !tweenRef.current && phase !== 'fell') {
      const rest = ledgePoint(position, peakId);
      if (rest.y !== restRef.current.y || rest.x !== restRef.current.x) {
        restRef.current = rest;
        node.position.set(rest.x, rest.y, rest.z);
      }
    }

    const current = tweenRef.current;
    if (current) {
      const segment = current.segments[current.index];
      if (!segment) {
        tweenRef.current = null;
      } else {
        const raw = (now - current.started) / segment.ms;
        const p = flightPoint(segment, raw);
        node.position.set(p.x, p.y, p.z);
        if (current.tumble && bodyRef.current) {
          const tumble = tumbleAngles(raw);
          bodyRef.current.rotation.x = tumble.x;
          bodyRef.current.rotation.z = tumble.z;
        }
        if (raw >= 1) finishSegment(current, segment, node, now);
      }
    } else if (phase === 'summit') {
      cheerTimerRef.current += delta;
      if (cheerTimerRef.current > 1.6) {
        cheerTimerRef.current = 0;
        play(pose === 'cheer' ? 'jump' : 'cheer', pose === 'cheer' ? 700 : undefined);
        particlesRef.current?.burst({
          x: node.position.x,
          y: node.position.y + 1.2,
          z: node.position.z + 0.6,
          count: 30,
          colors: [theme.flag, '#ffd13b', '#4cc9f0', '#f72585', '#80ed99'],
          speed: 3.5,
          gravity: 3,
          life: 1.8,
          size: 0.11,
          up: 0.8,
          spin: 8,
        });
      }
      const restY = restRef.current.y;
      node.position.y = restY + Math.max(0, Math.sin((now / 1000) * 7)) * 0.12;
    } else if (phase === 'climb') {
      // Idle fidgets: look around every few seconds.
      lookTimerRef.current += delta;
      if (pose === 'idle' && lookTimerRef.current > 5 + Math.random() * 4) {
        lookTimerRef.current = 0;
        play('look');
      }
    }

    // Squash-and-stretch on landings, from the feet.
    if (squashRef.current > 0) {
      squashRef.current = Math.max(0, squashRef.current - delta * 5);
      const s = Math.sin(squashRef.current * Math.PI);
      node.scale.set(1 + s * 0.18, 1 - s * 0.22, 1 + s * 0.18);
    } else {
      node.scale.set(1, 1, 1);
    }

    // Turn smoothly toward the current facing; snappier in the air, so the
    // body is side-on (thinnest towards the rock) by the time it passes a ledge.
    const turnRate = tweenRef.current ? AIR_TURN_RATE : GROUND_TURN_RATE;
    node.rotation.y += (facingRef.current - node.rotation.y) * Math.min(1, delta * turnRate);

    // Boost glow: a breathing light plus a trickle of sparks while the meter is full.
    const glow = glowRef.current;
    const glowing = boosted && phase === 'climb';
    if (glow) {
      glow.visible = glowing;
      const light = glow.children[0] as THREE.PointLight | undefined;
      if (light) light.intensity = 2.4 + Math.sin((now / 1000) * 6) * 0.9;
    }
    if (glowing) {
      sparkTimerRef.current += delta;
      if (sparkTimerRef.current > 0.45) {
        sparkTimerRef.current = 0;
        particlesRef.current?.burst({
          x: node.position.x,
          y: node.position.y + 0.2,
          z: node.position.z + 0.3,
          count: 3,
          colors: ['#ffe066', '#fff5b8'],
          speed: 0.8,
          gravity: -1.2,
          life: 0.9,
          size: 0.07,
          up: 0.9,
          spin: 4,
        });
      }
    }

    worldPositionRef.current?.copy(node.position);
    const live = tweenRef.current;
    const landing =
      live && (live.kind === 'hop' || live.kind === 'summit' || live.kind === 'fall')
        ? live.segments[live.segments.length - 1]?.to
        : undefined;
    if (landing) framingRef?.current?.set(landing.x, landing.y, landing.z);
    else framingRef?.current?.copy(node.position);
  });

  function handlePoseFinished(finished: Pose) {
    if (finished === 'look' || finished === 'land' || finished === 'hit') {
      if (!tweenRef.current && phase === 'climb') play('idle');
    }
    if (finished === 'cheer' && phase === 'summit') play('idle');
    if (finished === 'jump' && phase === 'summit' && !tweenRef.current) play('idle');
  }

  return (
    <group ref={groupRef}>
      <group ref={glowRef} visible={false}>
        <pointLight color="#ffd13b" intensity={3} distance={3.5} position={[0, 0.6, 0.5]} />
      </group>
      <group ref={bodyRef}>
        <Animal
          id={animalId}
          pose={pose}
          poseKey={poseKey}
          fitMs={fitMs}
          hold={clipFrame.hold}
          startAt={clipFrame.startAt}
          onPoseFinished={handlePoseFinished}
        />
      </group>
    </group>
  );
}
