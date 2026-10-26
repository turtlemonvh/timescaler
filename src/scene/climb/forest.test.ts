import { describe, expect, it } from 'vitest';
import { PEAKS } from '../../engine/peaks';
import { BODY_ENVELOPES } from '../animals/bodyEnvelope';
import { fallLanding } from './cliffPath';
import { PINE_RADIUS, basePines } from './forest';

describe('forest', () => {
  it('leaves the fall landing clear: no pine canopy reaches a fallen animal', () => {
    for (const peak of PEAKS) {
      const landing = fallLanding(peak.id);
      for (const [id, env] of Object.entries(BODY_ENVELOPES)) {
        // Lying on its side after the Death clip, side-on to the wall either way:
        // nose-to-tail along x, keeled over up to 1.4 units along z.
        const halfLength = Math.max(Math.abs(env.z[0]), Math.abs(env.z[1]));
        const sideways = Math.max(1.4, env.x[1]);
        for (const pine of basePines(peak.id)) {
          const r = PINE_RADIUS * pine.scale;
          const dx = Math.max(0, Math.abs(pine.x - landing.x) - halfLength);
          const dz = Math.max(0, Math.abs(pine.z - landing.z) - sideways);
          expect(
            Math.hypot(dx, dz),
            `peak ${peak.id} ${id} vs pine at ${pine.x},${pine.z}`,
          ).toBeGreaterThan(r);
        }
      }
    }
  });

  it('still plants a forest and a fringe on every peak', () => {
    for (const peak of PEAKS) {
      const pines = basePines(peak.id);
      expect(pines.length).toBeGreaterThan(40);
      expect(pines.some((p) => Math.abs(p.x) < 3)).toBe(true);
    }
  });
});
