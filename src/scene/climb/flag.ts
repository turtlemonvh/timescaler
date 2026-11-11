import { ledgePoint, wallFrontZ, wallGrid, type Vec3, type WallGrid } from './cliffPath';

/**
 * The summit flag's size and motion, shared by `CliffWorld` (which draws it)
 * and the tests (which check its whole sweep stays out of the rock). Lengths
 * are in scene units, relative to the pole's foot.
 */
export const FLAG = {
  /** Pole foot to the right of the summit standing point: clear of every animal resting there. */
  offsetX: 1.3,
  poleHeight: 2.2,
  poleRadius: 0.05,
  finialY: 2.25,
  finialRadius: 0.09,
  /** Height of the cloth's centre line; it hangs from the pole and runs out along +x. */
  clothY: 1.85,
  clothWidth: 0.9,
  clothHeight: 0.55,
  clothDepth: 0.03,
} as const;

/** Rest yaw of the cloth (negative turns its free edge towards the camera, away from the wall). */
const SWING_REST = -0.25;
/** The swing either side of the rest yaw: the free edge never goes behind the pole. */
const SWING_AMPLITUDE = 0.25;
/** How far in front of the rock the flag stays. */
const CLEARANCE = 0.03;
/** How far in front of the summit standing point the pole stands when the rock allows. */
const MIN_FORWARD = 0.1;

/** The cloth's yaw at `seconds`, in -0.5..0: it only ever swings towards the camera. */
export function flagSwing(seconds: number): number {
  return SWING_REST + SWING_AMPLITUDE * Math.sin(seconds * 3.2);
}

/** The cloth's length along its pole-to-edge axis at `seconds`, in 0.8..1. */
export function flagFlutter(seconds: number): number {
  return 0.9 + Math.sin(seconds * 6) * 0.1;
}

/**
 * Where the flag's pole stands: on the summit plateau, `FLAG.offsetX` to the
 * right of the standing point, and far enough forward that the rock behind
 * it never reaches the pole, the finial or the cloth. The peak rises just
 * behind the summit and its rock bulges by up to ~0.5 in z, so a fixed
 * offset from the standing point put the cloth's swing, and on some peaks
 * the pole, inside the mountain. The cloth only swings forward
 * (`flagSwing` <= 0), so it never reaches further back than its own
 * thickness behind the pole: each part is held clear of the frontmost rock
 * over the stretch of the face it spans.
 */
export function summitFlagFoot(
  height: number,
  peakId: number,
  grid: WallGrid = wallGrid(height, peakId),
): Vec3 {
  const summit = ledgePoint(height, peakId);
  const x = summit.x + FLAG.offsetX;
  const y = summit.y;
  const pole =
    wallFrontZ(grid, x - FLAG.poleRadius, x + FLAG.poleRadius, y, y + FLAG.poleHeight) +
    FLAG.poleRadius;
  const finial =
    wallFrontZ(
      grid,
      x - FLAG.finialRadius,
      x + FLAG.finialRadius,
      y + FLAG.finialY - FLAG.finialRadius,
      y + FLAG.finialY + FLAG.finialRadius,
    ) + FLAG.finialRadius;
  const cloth =
    wallFrontZ(
      grid,
      x,
      x + 0.02 + FLAG.clothWidth,
      y + FLAG.clothY - FLAG.clothHeight / 2,
      y + FLAG.clothY + FLAG.clothHeight / 2,
    ) +
    FLAG.clothDepth / 2;
  return { x, y, z: Math.max(summit.z + MIN_FORWARD, Math.max(pole, finial, cloth) + CLEARANCE) };
}
