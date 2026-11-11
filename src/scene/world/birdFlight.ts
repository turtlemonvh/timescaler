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
 * standing point. The whole circle sits behind the flag's depth (the flag
 * stands at +0.1 z, its finial tops out at +2.35 y) and above the flag. It
 * rings the peak, so whichever way the summit camera swings it sees the hawk
 * on one side or the other, passing behind the peak's tip now and then. It
 * is kept far back so that even the circle's near side stays below the top
 * of the frame: the summit camera sits only ~2 above the summit.
 */
export const HAWK_ORBIT = { dx: 0, dy: 3, dz: -7, radius: 4.2, rate: 0.45, bank: 0.35 };

/** Where the hawk is on its circle at `t`, and which way it faces (yaw about +Y). */
export function hawkOrbit(t: number): { x: number; y: number; z: number; yaw: number } {
  const a = t * HAWK_ORBIT.rate;
  return {
    x: HAWK_ORBIT.dx + Math.cos(a) * HAWK_ORBIT.radius,
    y: HAWK_ORBIT.dy + Math.sin(t * 0.3) * 0.15,
    z: HAWK_ORBIT.dz + Math.sin(a) * HAWK_ORBIT.radius,
    // Forward (+X) turned onto the circle's tangent, (−sin a, 0, cos a).
    yaw: -a - Math.PI / 2,
  };
}
