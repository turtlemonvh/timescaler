import { describe, expect, it } from 'vitest';
import { snapShadowTarget } from './shadowSnap';

const OFFSET = { x: 6, y: 9, z: 7 };
const TEXEL = 18 / 2048;

function acrossLight(p: { x: number; y: number; z: number }) {
  // Remove the component along the light; what's left must sit on the texel grid.
  const len = Math.hypot(OFFSET.x, OFFSET.y, OFFSET.z);
  const d = { x: OFFSET.x / len, y: OFFSET.y / len, z: OFFSET.z / len };
  const along = p.x * d.x + p.y * d.y + p.z * d.z;
  return { x: p.x - d.x * along, y: p.y - d.y * along, z: p.z - d.z * along };
}

describe('snapShadowTarget', () => {
  it('stays within half a texel (per axis) of the real target', () => {
    for (const t of [
      { x: 0, y: 0, z: 0 },
      { x: 1.234, y: 17.9, z: -1.79 },
      { x: -1.6, y: 41.3, z: -4.1 },
    ]) {
      const s = snapShadowTarget(t, OFFSET, TEXEL);
      expect(Math.hypot(s.x - t.x, s.y - t.y, s.z - t.z)).toBeLessThanOrEqual(TEXEL * 0.75);
    }
  });

  it('moves only in whole texels across the light, so tiny steps do nothing', () => {
    // Start on a grid point so a 0.1-texel nudge can't cross a texel boundary.
    const grid = snapShadowTarget({ x: 1, y: 5, z: -0.5 }, OFFSET, TEXEL);
    const a = snapShadowTarget(grid, OFFSET, TEXEL);
    const b = snapShadowTarget({ ...grid, x: grid.x + TEXEL * 0.1 }, OFFSET, TEXEL);
    const pa = acrossLight(a);
    const pb = acrossLight(b);
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z)).toBeLessThan(1e-9);
  });

  it('keeps sliding along the light direction freely (no depth snapping)', () => {
    const t = { x: 0.3, y: 2, z: 0.1 };
    const len = Math.hypot(OFFSET.x, OFFSET.y, OFFSET.z);
    const moved = {
      x: t.x + (OFFSET.x / len) * 0.37,
      y: t.y + (OFFSET.y / len) * 0.37,
      z: t.z + (OFFSET.z / len) * 0.37,
    };
    const a = acrossLight(snapShadowTarget(t, OFFSET, TEXEL));
    const b = acrossLight(snapShadowTarget(moved, OFFSET, TEXEL));
    expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-9);
  });
});
