import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../animals/roster';
import { GALLOP_SPEED, travelPlan } from './travel';

describe('travelPlan', () => {
  it('always plays the clip at the rate that matches ground speed', () => {
    for (const animal of ANIMALS) {
      for (const distance of [0.3, 2, 4.5, 6, 12, 46]) {
        const plan = travelPlan(distance, animal.id);
        if (plan.pose === 'run') {
          expect(plan.speed / plan.timeScale).toBeCloseTo(GALLOP_SPEED[animal.id], 9);
        }
        // Re-derive the duration from distance and speed.
        expect(plan.ms).toBeCloseTo((distance / plan.speed) * 1000, 6);
      }
    }
  });

  it('keeps playback within a believable band', () => {
    for (const animal of ANIMALS) {
      for (let distance = 0.1; distance < 60; distance += 0.7) {
        const plan = travelPlan(distance, animal.id);
        expect(plan.timeScale).toBeGreaterThanOrEqual(1);
        expect(plan.timeScale).toBeLessThanOrEqual(1.9 + 1e-9);
      }
    }
  });

  it('crosses one leg in about a second, and gets there faster per unit on long trips', () => {
    const leg = travelPlan(5, 'deer');
    expect(leg.pose).toBe('run');
    expect(leg.ms).toBeGreaterThan(900);
    expect(leg.ms).toBeLessThan(1700);
    expect(travelPlan(40, 'deer').speed).toBeGreaterThan(leg.speed);
    expect(travelPlan(0.4, 'deer').pose).toBe('walk');
  });
});
