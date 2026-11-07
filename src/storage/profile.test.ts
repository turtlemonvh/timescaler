import { describe, expect, it, vi } from 'vitest';
import {
  addGoal,
  bestTimeForDifficulty,
  checkGoalsAchieved,
  createProfile,
  getProfile,
  goalsForPeak,
  highestAttemptBeyondCleared,
  importProfile,
  isPeakSummited,
  isValidProfile,
  recordBail,
  recordFall,
  recordQuestionStat,
  recordSummit,
  setPeakDifficulty,
  summitTier,
} from './profile';
import type { Profile, SaveFile } from './types';

const EMPTY_SAVE: SaveFile = { v: 3, activeProfileId: null, profiles: [] };

describe('ids outside a secure context', () => {
  // A dev server opened over plain HTTP from another device (LAN, tailnet) isn't a
  // secure context, so the browser leaves crypto.randomUUID undefined there.
  it('creates profiles, climb log entries and goals without crypto.randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
      save = createProfile(save, 'Sam', 'preset-2');
      const id = save.profiles[1].id;
      save = recordSummit(save, id, 1, 1, 60000);
      save = addGoal(save, id, 2, 1, '2026-12-01');
      const profile = getProfile(save, id)!;
      const ids = [save.profiles[0].id, id, profile.climbLog[0].id, profile.goals[0].id];
      for (const value of ids) {
        expect(value).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('createProfile', () => {
  it('appends a new profile with defaults and makes it active', () => {
    const save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    expect(save.profiles).toHaveLength(1);
    const profile = save.profiles[0];
    expect(profile.name).toBe('Riley');
    expect(profile.characterId).toBe('preset-1');
    expect(profile.progress).toEqual({});
    expect(profile.stats).toEqual({});
    expect(profile.goals).toEqual([]);
    expect(profile.climbLog).toEqual([]);
    expect(save.activeProfileId).toBe(profile.id);
  });

  it('gives each profile a distinct id', () => {
    const save = createProfile(createProfile(EMPTY_SAVE, 'A', 'preset-1'), 'B', 'preset-2');
    expect(save.profiles[0].id).not.toBe(save.profiles[1].id);
  });

  it('does not mutate the original save', () => {
    createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    expect(EMPTY_SAVE.profiles).toHaveLength(0);
  });
});

describe('getProfile', () => {
  it('finds a profile by id', () => {
    const save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    expect(getProfile(save, id)?.name).toBe('Riley');
  });

  it('returns undefined for an unknown id', () => {
    expect(getProfile(EMPTY_SAVE, 'nope')).toBeUndefined();
  });
});

describe('setPeakDifficulty', () => {
  it("updates only the target peak's difficulty, creating a progress entry if none exists", () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = setPeakDifficulty(save, id, 1, 8);
    expect(getProfile(save, id)?.progress[1]).toEqual({
      difficulty: 8,
      highestDifficultyCleared: null,
      bestTimeMsByDifficulty: {},
      attempts: 0,
      bails: 0,
    });
  });

  it('leaves other peaks and other profiles untouched', () => {
    let save = createProfile(EMPTY_SAVE, 'A', 'preset-1');
    save = createProfile(save, 'B', 'preset-2');
    const [a, b] = save.profiles;
    save = setPeakDifficulty(save, a.id, 1, 8);
    save = setPeakDifficulty(save, a.id, 2, 5);
    expect(getProfile(save, a.id)?.progress[1]?.difficulty).toBe(8);
    expect(getProfile(save, a.id)?.progress[2]?.difficulty).toBe(5);
    expect(getProfile(save, b.id)?.progress[1]).toBeUndefined();
  });

  it('preserves the rest of an existing progress entry', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = setPeakDifficulty(save, id, 1, 7);
    expect(getProfile(save, id)?.progress[1]).toEqual({
      difficulty: 7,
      highestDifficultyCleared: 5,
      bestTimeMsByDifficulty: { 5: 90000 },
      attempts: 1,
      bails: 0,
    });
  });
});

describe('isPeakSummited', () => {
  it('is false when highestDifficultyCleared is null', () => {
    expect(
      isPeakSummited({
        difficulty: 1,
        highestDifficultyCleared: null,
        bestTimeMsByDifficulty: {},
        attempts: 0,
        bails: 0,
      }),
    ).toBe(false);
  });

  it('is true when highestDifficultyCleared is set, at any level', () => {
    expect(
      isPeakSummited({
        difficulty: 1,
        highestDifficultyCleared: 1,
        bestTimeMsByDifficulty: { 1: 90000 },
        attempts: 1,
        bails: 0,
      }),
    ).toBe(true);
  });
});

/** Reads `profile.climbLog` and the requested peak's `highestDifficultyCleared`
 * from `save`, matching the two fields `highestAttemptBeyondCleared` needs —
 * a thin wrapper so each test below doesn't repeat that lookup. */
function attemptBeyond(save: SaveFile, profileId: string, peakId: number) {
  const profile = getProfile(save, profileId)!;
  return highestAttemptBeyondCleared(
    profile.climbLog,
    peakId,
    profile.progress[peakId]?.highestDifficultyCleared ?? null,
  );
}

describe('highestAttemptBeyondCleared', () => {
  it('returns null when the peak has never been attempted', () => {
    const save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    expect(attemptBeyond(save, id, 1)).toBeNull();
  });

  it('returns null when every attempt is at or below the highest level cleared', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = recordFall(save, id, 1, 5, 30000);
    expect(attemptBeyond(save, id, 1)).toBeNull();
  });

  it('reports a fall above never-having-cleared (baseline 0)', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordFall(save, id, 1, 3, 20000);
    expect(attemptBeyond(save, id, 1)).toEqual({
      difficulty: 3,
      count: 1,
    });
  });

  it('reports a fall/bail above the highest level actually cleared', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = recordFall(save, id, 1, 7, 15000);
    expect(attemptBeyond(save, id, 1)).toEqual({
      difficulty: 7,
      count: 1,
    });
  });

  it('reports only the highest difficulty attempted, with a count scoped to that level', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordFall(save, id, 1, 6, 10000);
    save = recordFall(save, id, 1, 8, 10000);
    save = recordBail(save, id, 1, 8, 5000);
    expect(attemptBeyond(save, id, 1)).toEqual({
      difficulty: 8,
      count: 2,
    });
  });

  it('only counts attempts on the requested peak', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordFall(save, id, 2, 6, 10000);
    expect(attemptBeyond(save, id, 1)).toBeNull();
  });
});

describe('recordSummit', () => {
  it('marks the peak summited at the given difficulty and records the time on a first summit', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    const progress = getProfile(save, id)?.progress[1];
    expect(progress).toEqual({
      difficulty: 1,
      highestDifficultyCleared: 5,
      bestTimeMsByDifficulty: { 5: 90000 },
      attempts: 1,
      bails: 0,
    });
  });

  it('keeps the best (lowest) time across multiple summits at the same difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = recordSummit(save, id, 1, 5, 60000);
    expect(getProfile(save, id)?.progress[1]?.bestTimeMsByDifficulty[5]).toBe(60000);
    expect(getProfile(save, id)?.progress[1]?.attempts).toBe(2);
    save = recordSummit(save, id, 1, 5, 120000);
    expect(getProfile(save, id)?.progress[1]?.bestTimeMsByDifficulty[5]).toBe(60000);
    expect(getProfile(save, id)?.progress[1]?.attempts).toBe(3);
  });

  it('tracks best time per difficulty independently — clearing a harder level does not touch an easier one', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 3, 50000);
    save = recordSummit(save, id, 1, 7, 90000);
    expect(getProfile(save, id)?.progress[1]?.bestTimeMsByDifficulty).toEqual({
      3: 50000,
      7: 90000,
    });
    // A slower climb at level 7 doesn't touch level 3's record, and vice versa.
    save = recordSummit(save, id, 1, 7, 200000);
    save = recordSummit(save, id, 1, 3, 45000);
    expect(getProfile(save, id)?.progress[1]?.bestTimeMsByDifficulty).toEqual({
      3: 45000,
      7: 90000,
    });
  });

  it('keeps the highest difficulty ever cleared, not just the latest', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 7, 90000);
    save = recordSummit(save, id, 1, 4, 80000);
    expect(getProfile(save, id)?.progress[1]?.highestDifficultyCleared).toBe(7);
  });

  it('tracks progress per peak independently', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = recordSummit(save, id, 2, 5, 50000);
    expect(getProfile(save, id)?.progress[1]?.bestTimeMsByDifficulty[5]).toBe(90000);
    expect(getProfile(save, id)?.progress[2]?.bestTimeMsByDifficulty[5]).toBe(50000);
  });

  it('appends a climb-log entry with the difficulty, duration, and "summited" result', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 3, 6, 45000);
    const log = getProfile(save, id)?.climbLog;
    expect(log).toHaveLength(1);
    expect(log?.[0]).toMatchObject({ peakId: 3, difficulty: 6, result: 'summited' });
    expect((log?.[0].endedAt ?? 0) - (log?.[0].startedAt ?? 0)).toBe(45000);
  });
});

describe('bestTimeForDifficulty', () => {
  it('returns null for an undefined progress entry', () => {
    expect(bestTimeForDifficulty(undefined, 5)).toBeNull();
  });

  it('returns null when this exact difficulty has never been cleared, even if others have', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    expect(bestTimeForDifficulty(getProfile(save, id)?.progress[1], 6)).toBeNull();
  });

  it('returns the recorded best time for a cleared difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    expect(bestTimeForDifficulty(getProfile(save, id)?.progress[1], 5)).toBe(90000);
  });
});

describe('summitTier', () => {
  it('is "firstAtDifficulty" when this exact difficulty has never been cleared before', () => {
    expect(summitTier(undefined, 5, 90000)).toBe('firstAtDifficulty');

    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 3, 50000);
    // Cleared at a different difficulty, but not this one.
    expect(summitTier(getProfile(save, id)?.progress[1], 5, 90000)).toBe('firstAtDifficulty');
  });

  it('is "newBest" when the new time beats the prior best at this exact difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    expect(summitTier(getProfile(save, id)?.progress[1], 5, 60000)).toBe('newBest');
  });

  it('is "success" when the new time does not beat the prior best at this exact difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 60000);
    expect(summitTier(getProfile(save, id)?.progress[1], 5, 90000)).toBe('success');
    expect(summitTier(getProfile(save, id)?.progress[1], 5, 60000)).toBe('success');
  });
});

describe('recordFall', () => {
  it('increments attempts without marking the peak summited', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordFall(save, id, 1, 3, 30000);
    expect(getProfile(save, id)?.progress[1]).toEqual({
      difficulty: 1,
      highestDifficultyCleared: null,
      bestTimeMsByDifficulty: {},
      attempts: 1,
      bails: 0,
    });
  });

  it('a fall after a prior summit keeps highestDifficultyCleared and the prior best time', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordSummit(save, id, 1, 5, 90000);
    save = recordFall(save, id, 1, 5, 30000);
    expect(getProfile(save, id)?.progress[1]).toEqual({
      difficulty: 1,
      highestDifficultyCleared: 5,
      bestTimeMsByDifficulty: { 5: 90000 },
      attempts: 2,
      bails: 0,
    });
  });

  it('appends a climb-log entry with the "fell" result', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordFall(save, id, 2, 4, 20000);
    const log = getProfile(save, id)?.climbLog;
    expect(log?.[0]).toMatchObject({ peakId: 2, difficulty: 4, result: 'fell' });
  });
});

describe('recordBail', () => {
  it('increments bails without touching attempts', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordBail(save, id, 1, 3, 10000);
    expect(getProfile(save, id)?.progress[1]).toEqual({
      difficulty: 1,
      highestDifficultyCleared: null,
      bestTimeMsByDifficulty: {},
      attempts: 0,
      bails: 1,
    });
  });

  it('accumulates bails across multiple calls, independent of attempts', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordBail(save, id, 1, 3, 5000);
    save = recordFall(save, id, 1, 3, 8000);
    save = recordBail(save, id, 1, 3, 3000);
    const progress = getProfile(save, id)?.progress[1];
    expect(progress?.bails).toBe(2);
    expect(progress?.attempts).toBe(1);
  });

  it('appends a climb-log entry with the "bailed" result', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordBail(save, id, 5, 2, 7000);
    const log = getProfile(save, id)?.climbLog;
    expect(log?.[0]).toMatchObject({ peakId: 5, difficulty: 2, result: 'bailed' });
  });
});

describe('addGoal', () => {
  it('appends a pending goal with the given peak, difficulty, and target date', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 3, 6, '2026-12-01');
    const goals = getProfile(save, id)?.goals;
    expect(goals).toHaveLength(1);
    expect(goals?.[0]).toMatchObject({
      peakId: 3,
      difficulty: 6,
      targetDate: '2026-12-01',
      achievedAt: null,
    });
  });

  it('gives each goal a distinct id and leaves other profiles untouched', () => {
    let save = createProfile(EMPTY_SAVE, 'A', 'preset-1');
    save = createProfile(save, 'B', 'preset-2');
    const [a, b] = save.profiles;
    save = addGoal(save, a.id, 1, 5, '2026-01-01');
    save = addGoal(save, a.id, 2, 5, '2026-02-01');
    expect(getProfile(save, a.id)?.goals).toHaveLength(2);
    expect(getProfile(save, a.id)?.goals[0].id).not.toBe(getProfile(save, a.id)?.goals[1].id);
    expect(getProfile(save, b.id)?.goals).toHaveLength(0);
  });
});

describe('checkGoalsAchieved', () => {
  it('marks a pending goal achieved when cleared at exactly its target difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 1, 5);
    expect(getProfile(save, id)?.goals[0].achievedAt).not.toBeNull();
  });

  it('marks a pending goal achieved when cleared above its target difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 1, 7);
    expect(getProfile(save, id)?.goals[0].achievedAt).not.toBeNull();
  });

  it('leaves a goal pending when cleared below its target difficulty', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 1, 3);
    expect(getProfile(save, id)?.goals[0].achievedAt).toBeNull();
  });

  it('only touches goals for the matching peak', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = addGoal(save, id, 2, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 1, 5);
    const goals = getProfile(save, id)?.goals ?? [];
    expect(goals.find((g) => g.peakId === 1)?.achievedAt).not.toBeNull();
    expect(goals.find((g) => g.peakId === 2)?.achievedAt).toBeNull();
  });

  it('does not re-stamp an already-achieved goal', () => {
    vi.useFakeTimers();
    try {
      let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
      const id = save.profiles[0].id;
      save = addGoal(save, id, 1, 5, '2026-12-01');
      save = checkGoalsAchieved(save, id, 1, 5);
      const firstAchievedAt = getProfile(save, id)?.goals[0].achievedAt;
      vi.advanceTimersByTime(60000);
      save = checkGoalsAchieved(save, id, 1, 8);
      expect(getProfile(save, id)?.goals[0].achievedAt).toBe(firstAchievedAt);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('goalsForPeak', () => {
  it('returns empty pending and null lastAchieved when there are no goals', () => {
    expect(goalsForPeak([], 1)).toEqual({ pending: [], lastAchieved: null });
  });

  it('returns only pending (not yet achieved) goals for the requested peak', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = addGoal(save, id, 2, 3, '2026-11-01'); // different peak
    const goals = getProfile(save, id)?.goals ?? [];
    expect(goalsForPeak(goals, 1).pending).toHaveLength(1);
    expect(goalsForPeak(goals, 1).pending[0].peakId).toBe(1);
  });

  it('sorts pending goals soonest-due first', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = addGoal(save, id, 1, 7, '2026-06-01');
    const goals = getProfile(save, id)?.goals ?? [];
    const pending = goalsForPeak(goals, 1).pending;
    expect(pending.map((g) => g.targetDate)).toEqual(['2026-06-01', '2026-12-01']);
  });

  it('excludes achieved goals from pending', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 1, 5);
    const goals = getProfile(save, id)?.goals ?? [];
    expect(goalsForPeak(goals, 1).pending).toHaveLength(0);
  });

  it('returns null lastAchieved when nothing has been achieved for this peak', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 1, 5, '2026-12-01');
    const goals = getProfile(save, id)?.goals ?? [];
    expect(goalsForPeak(goals, 1).lastAchieved).toBeNull();
  });

  it('returns the most recently achieved goal when there are several', () => {
    vi.useFakeTimers();
    try {
      let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
      const id = save.profiles[0].id;
      save = addGoal(save, id, 1, 3, '2026-01-01');
      save = checkGoalsAchieved(save, id, 1, 3);
      vi.advanceTimersByTime(60000);
      save = addGoal(save, id, 1, 5, '2026-02-01');
      save = checkGoalsAchieved(save, id, 1, 5);
      const goals = getProfile(save, id)?.goals ?? [];
      expect(goalsForPeak(goals, 1).lastAchieved?.difficulty).toBe(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('only considers goals for the requested peak, for both pending and lastAchieved', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = addGoal(save, id, 2, 5, '2026-12-01');
    save = checkGoalsAchieved(save, id, 2, 5);
    save = addGoal(save, id, 2, 7, '2026-12-15');
    const goals = getProfile(save, id)?.goals ?? [];
    expect(goalsForPeak(goals, 1)).toEqual({ pending: [], lastAchieved: null });
  });
});

function makeImportedProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'imported-id',
    name: 'Sam',
    characterId: 'preset-2',
    createdAt: 1700000000000,
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
    ...overrides,
  };
}

describe('isValidProfile', () => {
  it('accepts a well-formed profile', () => {
    expect(isValidProfile(makeImportedProfile())).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'not a profile'],
    ['missing fields', { id: 'x', name: 'x' }],
    ['wrong-typed goals', { ...makeImportedProfile(), goals: 'not an array' }],
    ['wrong-typed progress', { ...makeImportedProfile(), progress: null }],
  ])('rejects %s', (_label, value) => {
    expect(isValidProfile(value)).toBe(false);
  });
});

describe('importProfile', () => {
  it('appends a profile with a new id', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const imported = makeImportedProfile();
    save = importProfile(save, imported);
    expect(save.profiles).toHaveLength(2);
    expect(getProfile(save, imported.id)).toEqual(imported);
  });

  it('replaces the existing profile when the id matches', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    const imported = makeImportedProfile({ id, name: 'Riley (restored)' });
    save = importProfile(save, imported);
    expect(save.profiles).toHaveLength(1);
    expect(getProfile(save, id)?.name).toBe('Riley (restored)');
  });

  it('does not mutate the original save', () => {
    const save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    importProfile(save, makeImportedProfile());
    expect(save.profiles).toHaveLength(1);
  });
});

describe('recordQuestionStat', () => {
  it('accumulates asked/correct/totalMs across calls for the same type', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordQuestionStat(save, id, 'readAnalog', true, 4000);
    save = recordQuestionStat(save, id, 'readAnalog', false, 6000);
    expect(getProfile(save, id)?.stats.readAnalog).toEqual({
      asked: 2,
      correct: 1,
      totalMs: 10000,
    });
  });

  it('tracks stats per question type independently', () => {
    let save = createProfile(EMPTY_SAVE, 'Riley', 'preset-1');
    const id = save.profiles[0].id;
    save = recordQuestionStat(save, id, 'readAnalog', true, 4000);
    save = recordQuestionStat(save, id, 'readCalendar', true, 5000);
    expect(getProfile(save, id)?.stats.readAnalog).toEqual({ asked: 1, correct: 1, totalMs: 4000 });
    expect(getProfile(save, id)?.stats.readCalendar).toEqual({
      asked: 1,
      correct: 1,
      totalMs: 5000,
    });
  });
});
