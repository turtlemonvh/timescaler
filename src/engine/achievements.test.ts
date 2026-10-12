import { describe, expect, it } from 'vitest';
import { summarizeProfile } from './achievements';
import type { ClimbLogEntry, Profile } from '../storage/types';

function entry(
  id: string,
  peakId: number,
  result: ClimbLogEntry['result'],
  startedAt: number,
  elapsedMs = 60_000,
): ClimbLogEntry {
  return { id, peakId, difficulty: 1, result, startedAt, endedAt: startedAt + elapsedMs };
}

function profileWith(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p',
    name: 'Riley',
    characterId: 'fox',
    createdAt: 0,
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
    ...overrides,
  };
}

describe('summarizeProfile', () => {
  it('is all zeros and no badges for a fresh profile', () => {
    const summary = summarizeProfile(profileWith());
    expect(summary.peaksSummited).toBe(0);
    expect(summary.climbs).toBe(0);
    expect(summary.accuracy).toBeNull();
    expect(summary.coins).toBe(0);
    expect(summary.badges.every((b) => !b.earned)).toBe(true);
    expect(summary.badges.find((b) => b.id === 'fivePeaks')?.progress).toBe(0);
  });

  it('counts summits, falls, accuracy and progress toward badges', () => {
    const profile = profileWith({
      progress: {
        1: {
          difficulty: 1,
          highestDifficultyCleared: 1,
          bestTimeMsByDifficulty: { 1: 60_000 },
          attempts: 2,
          bails: 0,
        },
        2: {
          difficulty: 1,
          highestDifficultyCleared: 1,
          bestTimeMsByDifficulty: { 1: 60_000 },
          attempts: 1,
          bails: 0,
        },
      },
      stats: { a: { asked: 10, correct: 9, totalMs: 0 }, b: { asked: 10, correct: 9, totalMs: 0 } },
      climbLog: [
        entry('1', 1, 'fell', 1_000),
        entry('2', 1, 'summited', 100_000),
        entry('3', 2, 'summited', 200_000),
      ],
    });
    const summary = summarizeProfile(profile);
    expect(summary.peaksSummited).toBe(2);
    expect(summary.summits).toBe(2);
    expect(summary.falls).toBe(1);
    expect(summary.questionsAnswered).toBe(20);
    expect(summary.accuracy).toBeCloseTo(0.9);
    const byId = Object.fromEntries(summary.badges.map((b) => [b.id, b]));
    expect(byId.firstSummit.earned).toBe(true);
    expect(byId.comeback.earned).toBe(true);
    expect(byId.sharpshooter.earned).toBe(true);
    expect(byId.fivePeaks.earned).toBe(false);
    expect(byId.fivePeaks.progress).toBe(2);
    expect(byId.firstTrophy.earned).toBe(true);
    expect(summary.coins).toBe(10);
  });

  it('does not award a comeback for a fall after the summit', () => {
    const profile = profileWith({
      climbLog: [entry('1', 1, 'summited', 1_000), entry('2', 1, 'fell', 100_000)],
    });
    expect(summarizeProfile(profile).badges.find((b) => b.id === 'comeback')?.earned).toBe(false);
  });
});
