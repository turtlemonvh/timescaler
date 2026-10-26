import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../animals/roster';
import { GALLOP_SPEED, MAX_DASH_TIME_SCALE, MAX_TRIP_SECONDS, travelPlan } from './travel';

const DISTANCES = [0.3, 2, 4.5, 6, 12, 20, 35.5];

describe('travelPlan', () => {
  it('plays the clip at the rate that matches ground speed, short of a dash', () => {
    for (const animal of ANIMALS) {
      for (const distance of DISTANCES) {
        const plan = travelPlan(distance, animal.id);
        // Re-derive the duration from distance and speed.
        expect(plan.ms).toBeCloseTo((distance / plan.speed) * 1000, 6);
        if (plan.pose === 'run' && plan.timeScale < MAX_DASH_TIME_SCALE) {
          expect(plan.speed / plan.timeScale).toBeCloseTo(GALLOP_SPEED[animal.id], 9);
        }
      }
    }
  });

  it('never keeps a kid waiting more than a few seconds', () => {
    for (const animal of ANIMALS) {
      for (let distance = 0.1; distance < 40; distance += 0.7) {
        expect(travelPlan(distance, animal.id).ms).toBeLessThanOrEqual(
          MAX_TRIP_SECONDS * 1000 + 1e-6,
        );
      }
    }
  });

  it('keeps playback within a believable band', () => {
    for (const animal of ANIMALS) {
      for (let distance = 0.1; distance < 40; distance += 0.7) {
        const plan = travelPlan(distance, animal.id);
        expect(plan.timeScale).toBeGreaterThanOrEqual(1);
        expect(plan.timeScale).toBeLessThanOrEqual(MAX_DASH_TIME_SCALE + 1e-9);
      }
    }
  });

  it('crosses one leg in about a second, whichever animal', () => {
    for (const animal of ANIMALS) {
      const leg = travelPlan(4.5, animal.id);
      expect(leg.pose).toBe('run');
      expect(leg.ms, animal.id).toBeGreaterThan(700);
      expect(leg.ms, animal.id).toBeLessThan(1400);
    }
    // The slowest gallop isn't left far behind on a longer trip.
    expect(travelPlan(10, 'alpaca').ms).toBeLessThan(travelPlan(10, 'deer').ms * 1.25);
    expect(travelPlan(0.4, 'deer').pose).toBe('walk');
  });
});
