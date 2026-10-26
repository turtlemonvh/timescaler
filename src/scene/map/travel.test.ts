import { describe, expect, it } from 'vitest';
import { ANIMALS } from '../animals/roster';
import { TRAIL } from './trailPath';
import { GALLOP_SPEED, MAX_DASH_TIME_SCALE, RAMP, travelPlan, tripProgress } from './travel';

const DISTANCES = [0.3, 2, 4.5, 6, 12, 20, TRAIL.length];

describe('travelPlan', () => {
  it('plays the clip at the rate that matches cruising speed, short of a dash', () => {
    for (const animal of ANIMALS) {
      for (const distance of DISTANCES) {
        const plan = travelPlan(distance, animal.id);
        if (plan.pose === 'run' && plan.timeScale < MAX_DASH_TIME_SCALE) {
          expect(plan.speed / plan.timeScale).toBeCloseTo(GALLOP_SPEED[animal.id], 9);
        }
      }
    }
  });

  it('gets anywhere — even peak 1 to peak 10 — in under 2 seconds', () => {
    // Re-derive each trip's time from the distance and the motion profile:
    // integrate tripProgress's speed (dp/dt × distance) and check it never
    // exceeds the plan's cruising speed, and that the whole trip fits 2 s.
    for (const animal of ANIMALS) {
      for (let distance = 0.1; distance <= TRAIL.length + 0.1; distance += 0.5) {
        for (const running of [undefined, 1, 1.4]) {
          const plan = travelPlan(distance, animal.id, running);
          expect(plan.ms, `${animal.id} ${distance.toFixed(1)} u`).toBeLessThan(2000);
          let fastest = 0;
          for (let k = 0; k < 400; k++) {
            const dp =
              tripProgress((k + 1) / 400, plan.rampIn) - tripProgress(k / 400, plan.rampIn);
            fastest = Math.max(fastest, (dp * distance) / (plan.ms / 1000 / 400));
          }
          expect(fastest).toBeLessThanOrEqual(plan.speed * 1.0001);
          expect(fastest).toBeGreaterThan(plan.speed * 0.99);
        }
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

  it('crosses one leg in about a second at a natural gait, whichever animal', () => {
    for (const animal of ANIMALS) {
      const leg = travelPlan(4.5, animal.id);
      expect(leg.pose).toBe('run');
      expect(leg.ms, animal.id).toBeGreaterThan(700);
      expect(leg.ms, animal.id).toBeLessThan(1400);
      expect(leg.timeScale, animal.id).toBeLessThan(2);
    }
    // Longer trips go faster.
    expect(travelPlan(20, 'deer').speed).toBeGreaterThan(travelPlan(4.5, 'deer').speed);
    expect(travelPlan(0.4, 'deer').pose).toBe('walk');
  });

  it('keeps a gallop already under way at its rate, so the clip does not restart', () => {
    const plan = travelPlan(6, 'wolf', 1.3);
    expect(plan.pose).toBe('run');
    expect(plan.timeScale).toBe(1.3);
    expect(plan.rampIn).toBe(false);
    expect(plan.speed).toBeCloseTo(GALLOP_SPEED.wolf * 1.3, 9);
    // A short re-target mid-gallop keeps galloping rather than dropping to a walk.
    expect(travelPlan(0.3, 'wolf', 1.3).pose).toBe('run');
  });
});

describe('tripProgress', () => {
  it('starts at 0, ends at 1 and never goes backwards', () => {
    for (const rampIn of [true, false]) {
      expect(tripProgress(0, rampIn)).toBeCloseTo(0, 12);
      expect(tripProgress(1, rampIn)).toBeCloseTo(1, 12);
      for (let k = 1; k <= 200; k++) {
        expect(tripProgress(k / 200, rampIn)).toBeGreaterThanOrEqual(
          tripProgress((k - 1) / 200, rampIn),
        );
      }
    }
  });

  it('eases out of a standstill and into the stop', () => {
    const early = tripProgress(RAMP / 4, true) / (RAMP / 4);
    const middle = (tripProgress(0.6, true) - tripProgress(0.4, true)) / 0.2;
    expect(early).toBeLessThan(middle / 2);
    // Already galloping: no ramp-in, so it starts at full speed.
    expect(tripProgress(0.05, false) / 0.05).toBeCloseTo(1 / (1 - RAMP / 2), 9);
  });
});
