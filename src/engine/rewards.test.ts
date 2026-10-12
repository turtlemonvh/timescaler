import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COIN_CAP,
  awardForTier,
  computeRewards,
  replaySummitTiers,
  rewardDelta,
  trophyCountByPeak,
} from './rewards';
import { mulberry32, pick, randInt } from './rng';
import {
  createProfile,
  getProfile,
  recordBail,
  recordFall,
  recordSummit,
  summitTier,
  type SummitTier,
} from '../storage/profile';
import type { ClimbLogEntry, Profile, SaveFile } from '../storage/types';

const EMPTY_SAVE: SaveFile = { v: 3, activeProfileId: null, profiles: [] };
const T0 = 1_700_000_000_000;

function makeProfile(climbLog: ClimbLogEntry[]): Profile {
  return {
    id: 'p',
    name: 'Riley',
    characterId: 'fox',
    createdAt: T0,
    progress: {},
    stats: {},
    goals: [],
    climbLog,
  };
}

let rowId = 0;
/** A log row ending `minutesIn` minutes after T0 that took `elapsedSec`. */
function row(
  minutesIn: number,
  peakId: number,
  difficulty: number,
  elapsedSec: number,
  result: ClimbLogEntry['result'],
): ClimbLogEntry {
  const endedAt = T0 + minutesIn * 60_000;
  rowId += 1;
  return {
    id: `row-${rowId}`,
    peakId,
    difficulty,
    startedAt: endedAt - elapsedSec * 1000,
    endedAt,
    result,
  };
}

/**
 * Hand-written history on peak 1 (plus one row on peak 2), deliberately
 * stored out of chronological order to prove the replay sorts by
 * `startedAt`. Expected awards, derived by hand from the table:
 *
 *  min  peak lv  time  result    tier               coins  trophy
 *   1    1   2   60s   summited  firstAtDifficulty  +10    firstClear
 *   2    1   2   10s   fell      (skipped)
 *   3    1   2   70s   summited  success (slower)    +2
 *   4    1   2    5s   bailed    (skipped)
 *   5    1   2   60s   summited  success (tie)       +2
 *   6    1   2   50s   summited  newBest             +6    newBest
 *   7    1   3   90s   summited  firstAtDifficulty  +15    firstClear
 *   8    1   3   20s   fell      (skipped)
 *   9    1   2   40s   summited  newBest (2nd)       +2    — (only the first new best pays)
 *  10    2   1   30s   summited  firstAtDifficulty   +5    firstClear
 *                                              total  42    4 trophies
 */
const FIXTURE_LOG: ClimbLogEntry[] = [
  row(7, 1, 3, 90, 'summited'),
  row(1, 1, 2, 60, 'summited'),
  row(4, 1, 2, 5, 'bailed'),
  row(2, 1, 2, 10, 'fell'),
  row(10, 2, 1, 30, 'summited'),
  row(5, 1, 2, 60, 'summited'),
  row(3, 1, 2, 70, 'summited'),
  row(9, 1, 2, 40, 'summited'),
  row(8, 1, 3, 20, 'fell'),
  row(6, 1, 2, 50, 'summited'),
];

describe('awardForTier', () => {
  it('pays 5×, 3× and 1× difficulty for the three tiers', () => {
    expect(awardForTier('firstAtDifficulty', 4)).toEqual({ coins: 20, trophy: 'firstClear' });
    expect(awardForTier('newBest', 4)).toEqual({ coins: 12, trophy: 'newBest' });
    expect(awardForTier('success', 4)).toEqual({ coins: 4, trophy: null });
  });

  it('pays a repeat new best like a plain summit', () => {
    expect(awardForTier('newBest', 4, false)).toEqual({ coins: 4, trophy: null });
  });
});

describe('computeRewards', () => {
  it('is zero for an empty climb log (incl. migrated v1/v2 profiles)', () => {
    expect(computeRewards(makeProfile([]))).toEqual({ coins: 0, trophies: [] });
  });

  it('awards exactly the hand-derived coins and trophies for the fixture log', () => {
    const { coins, trophies } = computeRewards(makeProfile(FIXTURE_LOG));
    expect(coins).toBe(42);
    expect(trophies).toEqual([
      { peakId: 1, difficulty: 2, kind: 'firstClear', earnedAt: T0 + 1 * 60_000 },
      { peakId: 1, difficulty: 2, kind: 'newBest', earnedAt: T0 + 6 * 60_000 },
      { peakId: 1, difficulty: 3, kind: 'firstClear', earnedAt: T0 + 7 * 60_000 },
      { peakId: 2, difficulty: 1, kind: 'firstClear', earnedAt: T0 + 10 * 60_000 },
    ]);
  });

  it('replays the fixture into the hand-derived tier sequence, skipping fell/bailed rows', () => {
    const tiers = replaySummitTiers(makeProfile(FIXTURE_LOG)).map(({ entry, tier }) => [
      (entry.endedAt - T0) / 60_000,
      tier,
    ]);
    expect(tiers).toEqual([
      [1, 'firstAtDifficulty'],
      [3, 'success'],
      [5, 'success'],
      [6, 'newBest'],
      [7, 'firstAtDifficulty'],
      [9, 'newBest'],
      [10, 'firstAtDifficulty'],
    ]);
  });

  it('treats an exact tie with the best time as success, not a new best', () => {
    const log = [row(1, 1, 5, 60, 'summited'), row(2, 1, 5, 60, 'summited')];
    const { coins, trophies } = computeRewards(makeProfile(log));
    expect(coins).toBe(25 + 5);
    expect(trophies).toHaveLength(1);
  });

  it('ignores a fast fall when judging the next summit', () => {
    const log = [
      row(1, 1, 1, 60, 'summited'),
      row(2, 1, 1, 5, 'fell'),
      row(3, 1, 1, 30, 'summited'),
    ];
    expect(replaySummitTiers(makeProfile(log)).map((r) => r.tier)).toEqual([
      'firstAtDifficulty',
      'newBest',
    ]);
  });

  it('caps the coin total at 50', () => {
    const log = [
      row(1, 1, 10, 60, 'summited'), // +50
      row(2, 2, 10, 60, 'summited'), // +50, capped
    ];
    const { coins, trophies } = computeRewards(makeProfile(log));
    expect(COIN_CAP).toBe(50);
    expect(coins).toBe(50);
    expect(trophies).toHaveLength(2);
  });

  it('never yields more than 2 trophies per (peak, difficulty), with no rule enforcing it', () => {
    const rng = mulberry32(103);
    const log: ClimbLogEntry[] = [];
    for (let i = 0; i < 400; i++) {
      // Few peaks/levels and a shrinking time trend so new bests keep happening.
      log.push(
        row(
          i,
          randInt(rng, 1, 2),
          randInt(rng, 1, 3),
          randInt(rng, 10, 400 - Math.floor(i / 2)),
          pick(rng, ['summited', 'summited', 'fell', 'bailed'] as const),
        ),
      );
    }
    const profile = makeProfile(log);
    const newBests = replaySummitTiers(profile).filter((r) => r.tier === 'newBest');
    expect(newBests.length).toBeGreaterThan(6); // more new bests than trophy slots
    const perGroup: Record<string, number> = {};
    for (const t of computeRewards(profile).trophies) {
      const key = `${t.peakId}:${t.difficulty}`;
      perGroup[key] = (perGroup[key] ?? 0) + 1;
    }
    expect(Object.keys(perGroup).length).toBeGreaterThan(0);
    for (const count of Object.values(perGroup)) expect(count).toBeLessThanOrEqual(2);
  });
});

describe('replay matches summitTier live', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reproduces the tier sequence summitTier gives during real recordSummit calls', () => {
    let now = T0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    let save = createProfile(EMPTY_SAVE, 'Riley', 'fox');
    const profileId = save.activeProfileId!;
    const liveTiers: SummitTier[] = [];

    type Step = [peakId: number, difficulty: number, elapsedSec: number, ClimbLogEntry['result']];
    const steps: Step[] = [
      [1, 2, 60, 'summited'], // first clear
      [1, 2, 10, 'fell'],
      [1, 2, 70, 'summited'], // slower repeat
      [1, 2, 5, 'bailed'],
      [1, 2, 60, 'summited'], // exact tie
      [1, 2, 50, 'summited'], // faster repeat
      [1, 3, 90, 'summited'], // first clear at another difficulty, same peak
      [1, 3, 20, 'fell'],
      [1, 2, 40, 'summited'], // faster again
      [2, 1, 30, 'summited'],
    ];
    for (const [peakId, difficulty, elapsedSec, result] of steps) {
      now += 5 * 60_000;
      const elapsedMs = elapsedSec * 1000;
      if (result === 'summited') {
        const before = getProfile(save, profileId)!;
        liveTiers.push(summitTier(before.progress[peakId], difficulty, elapsedMs));
        save = recordSummit(save, profileId, peakId, difficulty, elapsedMs);
      } else if (result === 'fell') {
        save = recordFall(save, profileId, peakId, difficulty, elapsedMs);
      } else {
        save = recordBail(save, profileId, peakId, difficulty, elapsedMs);
      }
    }

    const profile = getProfile(save, profileId)!;
    expect(liveTiers).toEqual([
      'firstAtDifficulty',
      'success',
      'success',
      'newBest',
      'firstAtDifficulty',
      'newBest',
      'firstAtDifficulty',
    ]);
    expect(replaySummitTiers(profile).map((r) => r.tier)).toEqual(liveTiers);
    expect(computeRewards(profile).coins).toBe(42);
  });
});

describe('rewardDelta', () => {
  it('reports what the newest summit added', () => {
    const before = makeProfile([row(1, 1, 4, 60, 'summited')]); // 20
    const slower = makeProfile([...before.climbLog, row(2, 1, 4, 90, 'summited')]);
    expect(rewardDelta(before, slower)).toEqual({ coins: 4, trophy: false });
    const faster = makeProfile([...before.climbLog, row(2, 1, 4, 30, 'summited')]);
    expect(rewardDelta(before, faster)).toEqual({ coins: 12, trophy: true });
  });

  it('reports only the coins left under the cap', () => {
    const before = makeProfile([row(1, 1, 9, 60, 'summited')]); // 45
    const after = makeProfile([...before.climbLog, row(2, 2, 3, 60, 'summited')]); // +15 → 50
    expect(rewardDelta(before, after)).toEqual({ coins: 5, trophy: true });
  });
});

describe('trophyCountByPeak', () => {
  it('counts trophies per peak across difficulties', () => {
    const { trophies } = computeRewards(makeProfile(FIXTURE_LOG));
    expect(trophyCountByPeak(trophies)).toEqual({ 1: 3, 2: 1 });
  });
});
