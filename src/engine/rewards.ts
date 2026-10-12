/**
 * Coins and trophies — pure selectors over a `Profile`'s existing
 * `climbLog`. No storage writes, no React, and no new `Profile` field: every
 * award is recomputed on demand by replaying the log.
 *
 * Replay: summited rows only (`fell` / `bailed` rows earn nothing and are
 * skipped), in `startedAt` order, grouped by (peakId, difficulty). Each
 * row's elapsed time is `endedAt - startedAt` (exact — `makeClimbLogEntry`
 * sets `startedAt = endedAt - elapsedMs`), and its tier comes from the same
 * `summitTier` the Summit screen uses live, fed a running best-time record,
 * so the replayed sequence matches what the player actually saw: a first
 * clear at a difficulty, a strictly faster time (a tie is a plain
 * `success`, because `summitTier` uses strict `<`), or any other summit.
 *
 * Award table (from #76 / #103):
 * - first clear at a difficulty (`firstAtDifficulty`) → `5 × difficulty`
 *   coins + a trophy
 * - first time beating your own time at that difficulty (the first
 *   `newBest`) → `3 × difficulty` coins + a trophy
 * - any other summit (including later new bests) → `1 × difficulty` coins,
 *   no trophy
 *
 * Coins cap at `COIN_CAP` in total. There is no separate "at most two
 * trophies per (peak, difficulty)" rule — there are exactly two
 * trophy-worthy moments per (peak, difficulty), each of which can only
 * happen once, so the cap falls out of the table (asserted in the tests).
 *
 * Known gap (documented, deliberately not fixed): profiles migrated from
 * save v1 or v2 have an empty `climbLog`, so a long-standing player starts
 * at 0 coins and 0 trophies even with peaks already cleared. `PeakProgress`
 * aggregates can't recover per-climb history, and back-filling from them
 * would invent a tier sequence that never happened.
 */
import { summitTier, type SummitTier } from '../storage/profile';
import type { ClimbLogEntry, PeakProgress, Profile } from '../storage/types';

export const COIN_CAP = 50;

export type TrophyKind = 'firstClear' | 'newBest';

export interface Trophy {
  peakId: number;
  difficulty: number;
  kind: TrophyKind;
  /** Epoch ms — the summit's `endedAt`. */
  earnedAt: number;
}

export interface Rewards {
  /** Total coins, already capped at `COIN_CAP`. */
  coins: number;
  /** In the order they were earned. */
  trophies: Trophy[];
}

export interface SummitAward {
  /** Uncapped. */
  coins: number;
  trophy: TrophyKind | null;
}

/**
 * The uncapped award for one summit, given its tier. `firstNewBest` says
 * whether a `newBest` is the first one at this (peak, difficulty) — only that
 * one earns the trophy and the `3 ×` coins. Ignored for the other tiers.
 */
export function awardForTier(
  tier: SummitTier,
  difficulty: number,
  firstNewBest = true,
): SummitAward {
  if (tier === 'firstAtDifficulty') return { coins: 5 * difficulty, trophy: 'firstClear' };
  if (tier === 'newBest' && firstNewBest) return { coins: 3 * difficulty, trophy: 'newBest' };
  return { coins: 1 * difficulty, trophy: null };
}

function emptyProgress(): PeakProgress {
  return {
    difficulty: 1,
    highestDifficultyCleared: null,
    bestTimeMsByDifficulty: {},
    attempts: 0,
    bails: 0,
  };
}

export interface ReplayedSummit {
  entry: ClimbLogEntry;
  tier: SummitTier;
}

/**
 * The summited rows of `climbLog` in `startedAt` order, each with the tier
 * `summitTier` gave (or would have given) it live. Exported so the tests can
 * check the replay against a live `recordSummit` run.
 */
export function replaySummitTiers(profile: Profile): ReplayedSummit[] {
  const summits = profile.climbLog
    .filter((entry) => entry.result === 'summited')
    .sort((a, b) => a.startedAt - b.startedAt);

  // Per-peak running record, shaped like PeakProgress so `summitTier` reads it
  // exactly as it reads the live one.
  const running: Record<number, PeakProgress> = {};
  return summits.map((entry) => {
    const elapsedMs = entry.endedAt - entry.startedAt;
    const prior = running[entry.peakId] ?? emptyProgress();
    const tier = summitTier(prior, entry.difficulty, elapsedMs);
    const priorBest = prior.bestTimeMsByDifficulty[entry.difficulty];
    running[entry.peakId] = {
      ...prior,
      bestTimeMsByDifficulty: {
        ...prior.bestTimeMsByDifficulty,
        [entry.difficulty]: priorBest != null ? Math.min(priorBest, elapsedMs) : elapsedMs,
      },
    };
    return { entry, tier };
  });
}

/** Replays `climbLog` and returns the total (capped) coins and every trophy. */
export function computeRewards(profile: Profile): Rewards {
  const newBestTaken = new Set<string>();
  let coins = 0;
  const trophies: Trophy[] = [];

  for (const { entry, tier } of replaySummitTiers(profile)) {
    const key = `${entry.peakId}:${entry.difficulty}`;
    const award = awardForTier(tier, entry.difficulty, !newBestTaken.has(key));
    if (award.trophy === 'newBest') newBestTaken.add(key);
    coins += award.coins;
    if (award.trophy) {
      trophies.push({
        peakId: entry.peakId,
        difficulty: entry.difficulty,
        kind: award.trophy,
        earnedAt: entry.endedAt,
      });
    }
  }

  return { coins: Math.min(coins, COIN_CAP), trophies };
}

/**
 * What one just-finished summit added, for the Summit screen: the difference
 * between the rewards before and after it, so the coin cap and the
 * first-new-best-only rule apply exactly as `computeRewards` applies them.
 * `before` is the profile from *before* `recordSummit`; `after` has this
 * summit appended to its log.
 */
export function rewardDelta(before: Profile, after: Profile): { coins: number; trophy: boolean } {
  const prior = computeRewards(before);
  const next = computeRewards(after);
  return {
    coins: next.coins - prior.coins,
    trophy: next.trophies.length > prior.trophies.length,
  };
}

/** Trophy count per peak id, across all difficulties — for the Map's peak cards. */
export function trophyCountByPeak(trophies: readonly Trophy[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const trophy of trophies) counts[trophy.peakId] = (counts[trophy.peakId] ?? 0) + 1;
  return counts;
}
