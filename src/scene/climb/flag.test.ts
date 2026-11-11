import { describe, expect, it } from 'vitest';
import { climbHeight } from '../../engine/climb';
import { PEAKS } from '../../engine/peaks';
import { BODY_ENVELOPES } from '../animals/bodyEnvelope';
import {
  WALL_COLUMNS,
  ledgePoint,
  summitPlateau,
  wallGrid,
  type Vec3,
  type WallGrid,
} from './cliffPath';
import { FLAG, flagFlutter, flagSwing, summitFlagFoot } from './flag';

/** Every climb length a peak can have, over all difficulties. */
function heights(peak: (typeof PEAKS)[number]): number[] {
  return [...new Set(Array.from({ length: 10 }, (_, d) => climbHeight(peak, d + 1)))];
}

/** Times covering many swing and flutter cycles, at both extremes and in between. */
const TIMES = Array.from({ length: 90 }, (_, i) => i * 0.0731);

/**
 * Points on the flag at `seconds`, relative to the pole's foot, derived the
 * way three.js places them in `CliffWorld`: the cloth's pivot sits on the
 * pole at `clothY`, is scaled along x by the flutter and turned about y by
 * the swing (Ry maps (x, z) to (x cos + z sin, -x sin + z cos)); the box
 * hangs from x = 0 to `clothWidth` in the pivot's frame.
 */
function flagPoints(seconds: number): Vec3[] {
  const yaw = flagSwing(seconds);
  const scale = flagFlutter(seconds);
  const out: Vec3[] = [];
  for (let i = 0; i <= 6; i++) {
    const x = (FLAG.clothWidth * scale * i) / 6;
    for (const z of [-FLAG.clothDepth / 2, FLAG.clothDepth / 2]) {
      for (let j = 0; j <= 2; j++) {
        out.push({
          x: 0.02 + x * Math.cos(yaw) + z * Math.sin(yaw),
          y: FLAG.clothY - FLAG.clothHeight / 2 + (FLAG.clothHeight * j) / 2,
          z: -x * Math.sin(yaw) + z * Math.cos(yaw),
        });
      }
    }
  }
  return out;
}

/** The pole's back edge and the finial's, which reach furthest towards the wall. */
function poleBackPoints(): Vec3[] {
  const out: Vec3[] = [];
  for (let j = 0; j <= 11; j++) {
    const y = (FLAG.poleHeight * j) / 11;
    out.push({ x: 0, y, z: -FLAG.poleRadius });
  }
  out.push({ x: 0, y: FLAG.finialY, z: -FLAG.finialRadius });
  out.push({ x: 0, y: FLAG.finialY + FLAG.finialRadius, z: 0 });
  return out;
}

type Triangle = readonly [Vec3, Vec3, Vec3];

/** The cliff mesh's triangles over a box of the face, split the way `CliffWorld` indexes each cell. */
function trianglesOver(grid: WallGrid, minX: number, maxX: number, minY: number, maxY: number) {
  const p = grid.positions;
  const stride = WALL_COLUMNS + 1;
  const vertex = (i: number): Vec3 => ({ x: p[i * 3], y: p[i * 3 + 1], z: p[i * 3 + 2] });
  const out: Triangle[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < WALL_COLUMNS; col++) {
      const a = row * stride + col;
      const c = a + stride;
      for (const [i, j, k] of [
        [a, a + 1, c + 1],
        [a, c + 1, c],
      ]) {
        const tri: Triangle = [vertex(i), vertex(j), vertex(k)];
        if (tri.every((v) => v.x < minX) || tri.every((v) => v.x > maxX)) continue;
        if (tri.every((v) => v.y < minY) || tri.every((v) => v.y > maxY)) continue;
        out.push(tri);
      }
    }
  }
  return out;
}

/** The mesh's z at (x, y), by barycentric interpolation in the triangle covering it; `-Infinity` off the face. */
function meshZ(triangles: readonly Triangle[], x: number, y: number): number {
  let best = -Infinity;
  for (const [A, B, C] of triangles) {
    const det = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(det) < 1e-12) continue;
    const u = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / det;
    const v = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / det;
    const w = 1 - u - v;
    if (u < -1e-9 || v < -1e-9 || w < -1e-9) continue;
    best = Math.max(best, u * A.z + v * B.z + w * C.z);
  }
  return best;
}

describe('summit flag', () => {
  it('keeps the pole, the finial and the cloth’s whole sweep in front of the rock on every peak', () => {
    for (const peak of PEAKS) {
      for (const height of heights(peak)) {
        const grid = wallGrid(height, peak.id);
        const foot = summitFlagFoot(height, peak.id, grid);
        const points = [...poleBackPoints(), ...TIMES.flatMap(flagPoints)];
        const triangles = trianglesOver(
          grid,
          foot.x - 0.2,
          foot.x + 1.2,
          foot.y - 0.2,
          foot.y + 2.6,
        );
        let worst = Infinity;
        let behind = 0;
        for (const p of points) {
          const rock = meshZ(triangles, foot.x + p.x, foot.y + p.y);
          if (rock > -Infinity) behind++;
          worst = Math.min(worst, foot.z + p.z - rock);
        }
        // The face really is behind the flag (the check isn't passing vacuously).
        expect(behind, `peak ${peak.id} height ${height}`).toBeGreaterThan(points.length / 4);
        expect(worst, `peak ${peak.id} height ${height}`).toBeGreaterThan(0.01);
      }
    }
  });

  it('only ever swings the cloth forward, away from the wall, and keeps it readable', () => {
    for (const t of TIMES) {
      expect(flagSwing(t)).toBeLessThanOrEqual(0);
      // Never turned so far towards the camera that it reads edge-on.
      expect(Math.cos(flagSwing(t))).toBeGreaterThan(0.85);
    }
    expect(Math.min(...TIMES.map(flagSwing))).toBeLessThan(-0.45);
    expect(Math.max(...TIMES.map(flagSwing))).toBeGreaterThan(-0.05);
  });

  it('stands the pole on the summit plateau', () => {
    for (const peak of PEAKS) {
      for (const height of heights(peak)) {
        const foot = summitFlagFoot(height, peak.id);
        const plateau = summitPlateau(height, peak.id);
        const where = `peak ${peak.id} height ${height}`;
        expect(foot.y, where).toBeCloseTo(plateau.max.y);
        expect(foot.x + FLAG.poleRadius, where).toBeLessThan(plateau.max.x);
        expect(foot.z + FLAG.poleRadius, where).toBeLessThan(plateau.max.z);
        expect(foot.z - FLAG.poleRadius, where).toBeGreaterThan(plateau.min.z);
      }
    }
  });

  it('stays clear of every animal resting on the summit', () => {
    // Climber.tsx: at the summit the animal turns a three-quarter towards the
    // camera, facing +x (`faceToward(1, true)`, yaw 0.45 * PI/2). Its nose is
    // +z and its side +x in its own frame (BODY_ENVELOPES).
    const yaw = (Math.PI / 2) * 0.45;
    for (const peak of PEAKS) {
      for (const height of heights(peak)) {
        const summit = ledgePoint(height, peak.id);
        const foot = summitFlagFoot(height, peak.id);
        const points = [{ x: 0, y: 0, z: 0 }, ...TIMES.flatMap(flagPoints)];
        for (const [id, env] of Object.entries(BODY_ENVELOPES)) {
          let worst = Infinity;
          for (const p of points) {
            const dx = foot.x + p.x - summit.x;
            const dz = foot.z + p.z - summit.z;
            const along = dx * Math.sin(yaw) + dz * Math.cos(yaw);
            const side = dx * Math.cos(yaw) - dz * Math.sin(yaw);
            worst = Math.min(
              worst,
              Math.max(along - env.z[1], env.z[0] - along, side - env.x[1], env.x[0] - side),
            );
          }
          expect(worst, `peak ${peak.id} height ${height} ${id}`).toBeGreaterThan(FLAG.poleRadius);
        }
      }
    }
  });
});
