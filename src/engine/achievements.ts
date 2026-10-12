import { PEAKS } from './peaks';
import { COIN_CAP, computeRewards } from './rewards';
import { isPeakSummited } from '../storage/profile';
import type { Profile } from '../storage/types';

/**
 * Badges for the profile screen: pure selectors over a `Profile`, like
 * `rewards.ts`. Each badge has a target and a current value so the screen
 * can show progress toward the ones not yet earned — a 7-year-old wants to
 * know "two more peaks!" more than they want a locked icon.
 */
export type BadgeId =
  | 'firstSummit'
  | 'fivePeaks'
  | 'allPeaks'
  | 'firstTrophy'
  | 'fullPurse'
  | 'tenClimbs'
  | 'sharpshooter'
  | 'comeback';

export interface Badge {
  id: BadgeId;
  title: string;
  /** One line a child can read. */
  blurb: string;
  earned: boolean;
  /** Progress toward the badge, 0..target. */
  progress: number;
  target: number;
}

export interface ProfileSummary {
  peaksSummited: number;
  climbs: number;
  summits: number;
  falls: number;
  questionsAnswered: number;
  questionsCorrect: number;
  /** 0..1, or null before any question has been answered. */
  accuracy: number | null;
  coins: number;
  trophies: number;
  badges: Badge[];
}

const SHARPSHOOTER_MIN_QUESTIONS = 20;

export function summarizeProfile(profile: Profile): ProfileSummary {
  const rewards = computeRewards(profile);
  const peaksSummited = PEAKS.filter((peak) => {
    const progress = profile.progress[peak.id];
    return progress ? isPeakSummited(progress) : false;
  }).length;
  const summits = profile.climbLog.filter((entry) => entry.result === 'summited').length;
  const falls = profile.climbLog.filter((entry) => entry.result === 'fell').length;
  const climbs = profile.climbLog.length;
  const questionsAnswered = Object.values(profile.stats).reduce((sum, s) => sum + s.asked, 0);
  const questionsCorrect = Object.values(profile.stats).reduce((sum, s) => sum + s.correct, 0);
  const accuracy = questionsAnswered > 0 ? questionsCorrect / questionsAnswered : null;

  // A comeback: a summit logged after a fall on the same peak.
  const comeback = profile.climbLog.some(
    (entry) =>
      entry.result === 'summited' &&
      profile.climbLog.some(
        (earlier) =>
          earlier.result === 'fell' &&
          earlier.peakId === entry.peakId &&
          earlier.endedAt < entry.startedAt,
      ),
  );

  const badge = (
    id: BadgeId,
    title: string,
    blurb: string,
    progress: number,
    target: number,
  ): Badge => ({
    id,
    title,
    blurb,
    earned: progress >= target,
    progress: Math.min(progress, target),
    target,
  });

  const badges: Badge[] = [
    badge('firstSummit', 'First summit', 'Reach the top of any peak.', summits, 1),
    badge('fivePeaks', 'Trailblazer', 'Summit five different peaks.', peaksSummited, 5),
    badge('allPeaks', 'Peak collector', 'Summit all ten peaks.', peaksSummited, PEAKS.length),
    badge('firstTrophy', 'Trophy hunter', 'Earn your first trophy.', rewards.trophies.length, 1),
    badge('fullPurse', 'Full purse', `Collect ${COIN_CAP} coins.`, rewards.coins, COIN_CAP),
    badge('tenClimbs', 'Regular', 'Start ten climbs.', climbs, 10),
    badge(
      'sharpshooter',
      'Sharpshooter',
      `Get 9 in 10 right across ${SHARPSHOOTER_MIN_QUESTIONS} questions.`,
      questionsAnswered >= SHARPSHOOTER_MIN_QUESTIONS && accuracy !== null && accuracy >= 0.9
        ? 1
        : 0,
      1,
    ),
    badge('comeback', 'Comeback', 'Fall off a peak, then summit it.', comeback ? 1 : 0, 1),
  ];

  return {
    peaksSummited,
    climbs,
    summits,
    falls,
    questionsAnswered,
    questionsCorrect,
    accuracy,
    coins: rewards.coins,
    trophies: rewards.trophies.length,
    badges,
  };
}
