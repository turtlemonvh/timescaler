import type {
  ClimbLogEntry,
  Goal,
  PeakProgress,
  Profile,
  QuestionTypeStats,
  SaveFile,
} from './types';

const DEFAULT_PEAK_DIFFICULTY = 1;

function makeProfileId(): string {
  return crypto.randomUUID();
}

/** Creates a new profile, appends it, and makes it the active one. */
export function createProfile(save: SaveFile, name: string, characterId: string): SaveFile {
  const profile: Profile = {
    id: makeProfileId(),
    name,
    characterId,
    createdAt: Date.now(),
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
  };
  return {
    ...save,
    profiles: [...save.profiles, profile],
    activeProfileId: profile.id,
  };
}

export function getProfile(save: SaveFile, profileId: string): Profile | undefined {
  return save.profiles.find((profile) => profile.id === profileId);
}

/** `progress[peakId] !== null` for a peak never yet visited — every reducer
 * that touches a peak's progress starts from this rather than assuming an
 * entry already exists. */
function defaultPeakProgress(): PeakProgress {
  return {
    difficulty: DEFAULT_PEAK_DIFFICULTY,
    highestDifficultyCleared: null,
    bestTimeMsByDifficulty: {},
    attempts: 0,
    bails: 0,
  };
}

/** The best (lowest) time ever summited at exactly `difficulty` on this
 * peak, or `null` if it's never been cleared at that difficulty — a peak
 * cleared at a harder level doesn't imply anything about an easier one, so
 * this never falls back to a different difficulty's time. */
export function bestTimeForDifficulty(
  progress: PeakProgress | undefined,
  difficulty: number,
): number | null {
  return progress?.bestTimeMsByDifficulty[difficulty] ?? null;
}

/** Whether a peak has ever been summited, at any difficulty. */
export function isPeakSummited(progress: PeakProgress): boolean {
  return progress.highestDifficultyCleared !== null;
}

export interface HighestAttemptBeyondCleared {
  difficulty: number;
  /** How many climb-log entries exist at exactly `difficulty` — not summed
   * across every level above `highestDifficultyCleared`, since mixing
   * counts from different levels into one number would be misleading. */
  count: number;
}

/** The hardest level this peak has been attempted at beyond whatever's
 * already been cleared (or beyond never-cleared, i.e. 0, if it's never been
 * summited at all) — `null` if there's no such attempt. Every matching
 * climb-log entry is guaranteed to be a `fell`/`bailed` result, never
 * `summited`: `recordSummit` always raises `highestDifficultyCleared` to at
 * least the summited difficulty, so an entry above it can't itself be a
 * summit. Powers the Map screen's "tried a harder level" pill.
 *
 * Takes `climbLog` and `highestDifficultyCleared` directly rather than a
 * whole `Profile` — a caller like `Map.tsx`'s `PeakCard` only ever has one
 * peak's `PeakProgress` in scope, not the full profile, and threading just
 * the two fields this actually needs avoids a fake-`Profile` wrapper. */
export function highestAttemptBeyondCleared(
  climbLog: ClimbLogEntry[],
  peakId: number,
  highestDifficultyCleared: number | null,
): HighestAttemptBeyondCleared | null {
  const baseline = highestDifficultyCleared ?? 0;
  const beyond = climbLog.filter((e) => e.peakId === peakId && e.difficulty > baseline);
  if (beyond.length === 0) return null;
  const difficulty = Math.max(...beyond.map((e) => e.difficulty));
  const count = beyond.filter((e) => e.difficulty === difficulty).length;
  return { difficulty, count };
}

export interface GoalsForPeak {
  /** Not yet achieved, soonest-due first. */
  pending: Goal[];
  /** The most recently achieved goal for this peak, or `null` if none has
   * been achieved yet — only the single most recent one, not the full
   * achieved history (that lives in the Climber Log / Goals tab instead).
   * `achievedAt` is narrowed to `number` here (never `null`), since every
   * goal in this slot is one that's already been achieved. */
  lastAchieved: (Goal & { achievedAt: number }) | null;
}

/** Splits a peak's goals into what's still pending and its most recent
 * achievement — powers the Curriculum tab's inline goal-creation card,
 * which shows both while browsing a peak's levels. */
export function goalsForPeak(goals: Goal[], peakId: number): GoalsForPeak {
  const forPeak = goals.filter((g) => g.peakId === peakId);
  const pending = forPeak
    .filter((g) => g.achievedAt === null)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const achieved = forPeak
    .filter((g): g is Goal & { achievedAt: number } => g.achievedAt !== null)
    .sort((a, b) => b.achievedAt - a.achievedAt);
  return { pending, lastAchieved: achieved[0] ?? null };
}

function makeClimbLogEntry(
  peakId: number,
  difficulty: number,
  elapsedMs: number,
  result: ClimbLogEntry['result'],
): ClimbLogEntry {
  const endedAt = Date.now();
  return {
    id: crypto.randomUUID(),
    peakId,
    difficulty,
    startedAt: endedAt - elapsedMs,
    endedAt,
    result,
  };
}

function updateProfile(
  save: SaveFile,
  profileId: string,
  update: (profile: Profile) => Profile,
): SaveFile {
  return {
    ...save,
    profiles: save.profiles.map((profile) =>
      profile.id === profileId ? update(profile) : profile,
    ),
  };
}

/** Changes which animal climbs for this profile. The id is stored as-is;
 * `resolveAnimal` on the read side tolerates legacy and unknown ids. */
export function setCharacter(save: SaveFile, profileId: string, characterId: string): SaveFile {
  return updateProfile(save, profileId, (profile) => ({ ...profile, characterId }));
}

/** Sets a single peak's current/selected difficulty, independent of any
 * other peak's — this is what "picking a level" on the map persists. */
export function setPeakDifficulty(
  save: SaveFile,
  profileId: string,
  peakId: number,
  difficulty: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const prior = profile.progress[peakId] ?? defaultPeakProgress();
    return {
      ...profile,
      progress: { ...profile.progress, [peakId]: { ...prior, difficulty } },
    };
  });
}

/** Marks a peak summited at `difficulty`, keeping the best (lowest) time
 * for that exact difficulty and the highest difficulty ever cleared, and
 * appends a climb-log entry. */
export function recordSummit(
  save: SaveFile,
  profileId: string,
  peakId: number,
  difficulty: number,
  elapsedMs: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const prior = profile.progress[peakId] ?? defaultPeakProgress();
    const priorBestAtDifficulty = prior.bestTimeMsByDifficulty[difficulty];
    const bestAtDifficulty =
      priorBestAtDifficulty != null ? Math.min(priorBestAtDifficulty, elapsedMs) : elapsedMs;
    return {
      ...profile,
      progress: {
        ...profile.progress,
        [peakId]: {
          ...prior,
          highestDifficultyCleared: Math.max(prior.highestDifficultyCleared ?? 0, difficulty),
          bestTimeMsByDifficulty: {
            ...prior.bestTimeMsByDifficulty,
            [difficulty]: bestAtDifficulty,
          },
          attempts: prior.attempts + 1,
        },
      },
      climbLog: [...profile.climbLog, makeClimbLogEntry(peakId, difficulty, elapsedMs, 'summited')],
    };
  });
}

export type SummitTier = 'success' | 'newBest' | 'firstAtDifficulty';

/**
 * Which of the three celebration tiers a just-completed summit earns —
 * "more enthusiastic as you go up from 1 to 3" per the original ask.
 * Compares against `priorProgress`, so the caller must pass the profile's
 * state from *before* this summit's own `recordSummit` call updates it
 * (App.tsx does this by reading `profile.progress[peakId]` in the same
 * render pass that still holds the pre-summit save). A first-ever clear at
 * `difficulty` is deliberately its own top tier rather than folding into
 * "new best" — going from no record to a record is a bigger moment than
 * merely beating an existing one.
 */
export function summitTier(
  priorProgress: PeakProgress | undefined,
  difficulty: number,
  elapsedMs: number,
): SummitTier {
  const priorBest = bestTimeForDifficulty(priorProgress, difficulty);
  if (priorBest === null) return 'firstAtDifficulty';
  if (elapsedMs < priorBest) return 'newBest';
  return 'success';
}

/** Increments attempts on a fall and appends a climb-log entry.
 * `highestDifficultyCleared`/`bestTimeMs` carry over unchanged from any
 * prior run. */
export function recordFall(
  save: SaveFile,
  profileId: string,
  peakId: number,
  difficulty: number,
  elapsedMs: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const prior = profile.progress[peakId] ?? defaultPeakProgress();
    return {
      ...profile,
      progress: {
        ...profile.progress,
        [peakId]: { ...prior, attempts: prior.attempts + 1 },
      },
      climbLog: [...profile.climbLog, makeClimbLogEntry(peakId, difficulty, elapsedMs, 'fell')],
    };
  });
}

/** Increments `bails` (a separate counter from `attempts` — bailing out is a
 * third, distinct outcome from summiting or falling) and appends a
 * climb-log entry. */
export function recordBail(
  save: SaveFile,
  profileId: string,
  peakId: number,
  difficulty: number,
  elapsedMs: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const prior = profile.progress[peakId] ?? defaultPeakProgress();
    return {
      ...profile,
      progress: {
        ...profile.progress,
        [peakId]: { ...prior, bails: prior.bails + 1 },
      },
      climbLog: [...profile.climbLog, makeClimbLogEntry(peakId, difficulty, elapsedMs, 'bailed')],
    };
  });
}

/** Adds a new pending goal: summit `peakId` at `difficulty` by `targetDate`. */
export function addGoal(
  save: SaveFile,
  profileId: string,
  peakId: number,
  difficulty: number,
  targetDate: string,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const goal: Goal = {
      id: crypto.randomUUID(),
      peakId,
      difficulty,
      targetDate,
      createdAt: Date.now(),
      achievedAt: null,
    };
    return { ...profile, goals: [...profile.goals, goal] };
  });
}

/** Marks any pending goal for `peakId` as achieved if `clearedDifficulty`
 * meets or exceeds its target — a goal for level 5 is satisfied by clearing
 * level 7 too, not just exactly 5. Call after `recordSummit`, not as part
 * of it: goal-checking and summit-recording are independent concerns. */
export function checkGoalsAchieved(
  save: SaveFile,
  profileId: string,
  peakId: number,
  clearedDifficulty: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => ({
    ...profile,
    goals: profile.goals.map((goal) =>
      goal.peakId === peakId && goal.achievedAt === null && clearedDifficulty >= goal.difficulty
        ? { ...goal, achievedAt: Date.now() }
        : goal,
    ),
  }));
}

/** Shallow shape check for a JSON blob a user picked via the Review
 * screen's profile import — same lightweight-validation spirit as
 * `save.ts`'s `migrate()`: checks top-level field types, not every nested
 * `PeakProgress`/`Goal`/`ClimbLogEntry` entry. */
export function isValidProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.characterId === 'string' &&
    typeof p.createdAt === 'number' &&
    typeof p.progress === 'object' &&
    p.progress !== null &&
    typeof p.stats === 'object' &&
    p.stats !== null &&
    Array.isArray(p.goals) &&
    Array.isArray(p.climbLog)
  );
}

/** Replaces the profile with a matching id, or appends `profile` as new.
 * The caller is responsible for confirming an overwrite with the user
 * before calling this on a colliding id — this reducer just does the
 * replace-or-append, same as every other reducer here staying UI-agnostic. */
export function importProfile(save: SaveFile, profile: Profile): SaveFile {
  const exists = save.profiles.some((p) => p.id === profile.id);
  return {
    ...save,
    profiles: exists
      ? save.profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...save.profiles, profile],
  };
}

export function recordQuestionStat(
  save: SaveFile,
  profileId: string,
  typeId: string,
  correct: boolean,
  elapsedMs: number,
): SaveFile {
  return updateProfile(save, profileId, (profile) => {
    const prior: QuestionTypeStats = profile.stats[typeId] ?? { asked: 0, correct: 0, totalMs: 0 };
    return {
      ...profile,
      stats: {
        ...profile.stats,
        [typeId]: {
          asked: prior.asked + 1,
          correct: prior.correct + (correct ? 1 : 0),
          totalMs: prior.totalMs + elapsedMs,
        },
      },
    };
  });
}
