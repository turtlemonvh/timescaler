/**
 * Pure flap–glide maths for the birds (no three.js), so the cycle can be unit
 * tested. Angles are radians: `shoulder` raises the whole wing about the
 * flight axis (positive = up), `wrist` adds a lagging fold to the outer panel.
 */

const TAU = Math.PI * 2;

export interface WingPose {
  shoulder: number;
  wrist: number;
  /** Vertical body offset, in bird units (before the bird's scale). */
  bob: number;
  /** Roll about the flight axis. */
  bank: number;
}

/**
 * Warps a beat phase `p` in [0, 1) so the downstroke takes `down` of the beat.
 * The result's cosine is +1 at the top of the stroke and −1 at the bottom, so
 * phases [0, 0.5) are the downstroke and [0.5, 1) the upstroke.
 */
export function warp(p: number, down = 0.4): number {
  return p < down ? (p / down) * 0.5 : 0.5 + ((p - down) / (1 - down)) * 0.5;
}

/** Per-bird rhythm, so the flock never flaps in sync. */
export function songbirdRhythm(seed: number) {
  const beat = 2.4 + (seed % 3) * 0.25;
  const beats = 4;
  const glide = 0.9 + (seed % 2) * 0.35;
  const flapping = beats / beat;
  return { beat, beats, glide, flapping, cycle: flapping + glide, offset: seed * 1.37 };
}

/** Four quick beats with a fast downstroke, then a glide on slightly raised wings. */
export function songbirdPose(t: number, seed: number): WingPose {
  const { beat, glide, flapping, cycle, offset } = songbirdRhythm(seed);
  const c = (((t + offset) % cycle) + cycle) % cycle;
  let shoulder: number;
  let wrist: number;
  let bob: number;
  if (c < flapping) {
    const ph = warp((c * beat) % 1);
    shoulder = 0.15 + 0.85 * Math.cos(TAU * ph);
    wrist = 0.45 * Math.cos(TAU * (ph - 0.1)) + 0.1;
    // Rises on each downstroke, gaining a little height over the burst.
    bob = -0.035 * Math.cos(TAU * ph) + 0.04 * (c / flapping);
  } else {
    const k = (c - flapping) / glide;
    shoulder = 0.12 + Math.sin(t * 3) * 0.02;
    wrist = -0.05;
    // Sinks back through the glide.
    bob = 0.04 * (1 - k);
  }
  return { shoulder, wrist, bob, bank: Math.sin((t + offset) * 0.6) * 0.08 };
}

export const HAWK_CYCLE = 6.2;
export const HAWK_FLAP = 1.8;

/** Glides on a shallow V (dihedral) and makes two slow beats every ~6 s. */
export function hawkPose(t: number, seed = 0): WingPose {
  const c = (((t + seed * 2.3) % HAWK_CYCLE) + HAWK_CYCLE) % HAWK_CYCLE;
  let shoulder = 0.18 + Math.sin(t * 1.3) * 0.03;
  let wrist = 0.06;
  if (c < HAWK_FLAP) {
    const ph = warp((c * 1.1) % 1, 0.45);
    // Eases in and out of the beats so the wings don't snap from the glide.
    const k = Math.min(1, c / 0.3, (HAWK_FLAP - c) / 0.3);
    shoulder = shoulder * (1 - k) + k * (0.1 + 0.55 * Math.cos(TAU * ph));
    wrist = wrist * (1 - k) + k * 0.3 * Math.cos(TAU * (ph - 0.12));
  }
  return { shoulder, wrist, bob: 0, bank: 0 };
}

/**
 * The hawk's thermal circle near the summit, relative to the summit's
 * standing point. The whole circle sits well behind the flag and the
 * climber in depth, so on screen it may pass behind the flag but never in
 * front of it or through it. It circles out to the flag's side of the peak,
 * about level with the flag's top, where the summit camera's swing keeps
 * open sky in view. `phase` is where it starts when the summit begins: the
 * camera's swing starts then too, so the pairing was tuned (in a model of
 * `CameraRig`) to keep the hawk in frame as long as possible.
 */
export const HAWK_ORBIT = {
  dx: 3,
  dy: 2.8,
  dz: -5,
  radius: 3,
  rate: 0.45,
  bank: 0.35,
  phase: 5.24,
};

/**
 * Where the hawk is on its circle `t` seconds into the summit, and which way
 * it faces (yaw about +Y).
 */
export function hawkOrbit(t: number): { x: number; y: number; z: number; yaw: number } {
  const a = (t + HAWK_ORBIT.phase) * HAWK_ORBIT.rate;
  return {
    x: HAWK_ORBIT.dx + Math.cos(a) * HAWK_ORBIT.radius,
    y: HAWK_ORBIT.dy + Math.sin((t + HAWK_ORBIT.phase) * 0.3) * 0.15,
    z: HAWK_ORBIT.dz + Math.sin(a) * HAWK_ORBIT.radius,
    // Forward (+X) turned onto the circle's tangent, (−sin a, 0, cos a).
    yaw: -a - Math.PI / 2,
  };
}
