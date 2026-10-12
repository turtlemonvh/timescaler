import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { summarizeProfile } from '../../engine/achievements';
import { PEAKS } from '../../engine/peaks';
import { COIN_CAP, computeRewards, type Trophy } from '../../engine/rewards';
import { ANIMALS, resolveAnimal, type AnimalId } from '../../scene/animals/roster';
import { playCue } from '../../scene/audio/synth';
import { AnimalShowcase } from '../../scene/lazy';
import { preloadAnimal } from '../../scene/lazyPreload';
import { peakTheme } from '../../scene/theme/peakThemes';
import { bestTimeForDifficulty } from '../../storage/profile';
import type { Profile } from '../../storage/types';
import { formatDuration } from '../formatDuration';
import { CoinIcon, PeakIcon, TrophyIcon } from '../hud/RewardIcons';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

export type ProfileSection = 'climber' | 'accomplishments';

export interface ProfileScreenProps {
  profile: Profile;
  /** Which section to scroll into view on open. */
  initialSection?: ProfileSection;
  onChangeAnimal: (animalId: AnimalId) => void;
  onBack: () => void;
}

/** A kid-readable animal silhouette stand-in: the animal's initial on its accent colour. */
function AnimalTile({
  id,
  name,
  accent,
  selected,
  onPick,
}: {
  id: AnimalId;
  name: string;
  accent: string;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={selected ? 'animal-tile animal-tile--selected' : 'animal-tile'}
      style={{ '--accent-card': accent } as React.CSSProperties}
      data-testid={`profile-animal-${id}`}
      aria-pressed={selected}
      onClick={onPick}
    >
      <span className="animal-tile__badge" aria-hidden="true">
        {name[0]}
      </span>
      <span className="animal-tile__name">{name}</span>
      {selected && <span className="animal-tile__tag">Climbing now</span>}
    </button>
  );
}

function TrophyMark({ trophy }: { trophy: Trophy }) {
  const label =
    trophy.kind === 'firstClear'
      ? `First clear at level ${trophy.difficulty}`
      : `New best time at level ${trophy.difficulty}`;
  return (
    <span
      className={`trophy-mark trophy-mark--${trophy.kind}`}
      title={label}
      aria-label={label}
      data-testid="profile-trophy"
    >
      <TrophyIcon size={22} />
      <span className="trophy-mark__level">{trophy.difficulty}</span>
    </span>
  );
}

/**
 * The player's page: change the climber, see coins, trophies, badges and
 * the trophy case peak by peak. Reached from the profile chip and the
 * rewards chip on the Map; the latter opens scrolled to Accomplishments.
 */
export default function ProfileScreen({
  profile,
  initialSection = 'climber',
  onChangeAnimal,
  onBack,
}: ProfileScreenProps) {
  const animal = resolveAnimal(profile.characterId);
  const reducedMotion = usePrefersReducedMotion();
  const [cheerKey, setCheerKey] = useState(0);
  const summary = useMemo(() => summarizeProfile(profile), [profile]);
  const rewards = useMemo(() => computeRewards(profile), [profile]);
  const accomplishmentsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    preloadAnimal(animal.id);
  }, [animal.id]);

  useEffect(() => {
    if (initialSection === 'accomplishments') {
      accomplishmentsRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [initialSection]);

  function pick(id: AnimalId) {
    if (id === animal.id) return;
    playCue('select');
    setCheerKey((key) => key + 1);
    onChangeAnimal(id);
  }

  const trophiesByPeak = useMemo(() => {
    const map = new Map<number, Trophy[]>();
    for (const trophy of rewards.trophies) {
      map.set(trophy.peakId, [...(map.get(trophy.peakId) ?? []), trophy]);
    }
    return map;
  }, [rewards.trophies]);

  const earned = summary.badges.filter((b) => b.earned).length;

  return (
    <main className="page profile-screen" data-testid="profile-screen">
      <div className="profile-screen__top">
        <button type="button" data-variant="secondary" data-testid="profile-back" onClick={onBack}>
          ← Back to map
        </button>
      </div>

      <section className="profile-hero" aria-labelledby="profile-hero-title">
        <div className="profile-hero__stage" aria-hidden="true">
          <Suspense fallback={<span className="scene-fallback" />}>
            <AnimalShowcase
              key={`${animal.id}-${cheerKey}`}
              animalId={animal.id}
              accent={animal.accent}
              pose={cheerKey > 0 ? 'cheer' : 'idle'}
              reducedMotion={reducedMotion}
            />
          </Suspense>
        </div>
        <div className="profile-hero__text">
          <h1 id="profile-hero-title" data-testid="profile-name">
            {profile.name}
          </h1>
          <p className="profile-hero__animal" data-testid="profile-animal-name">
            climbs with <strong>{animal.name}</strong> · {animal.tagline}
          </p>
          <div className="profile-hero__stats">
            <span className="stat-pill" data-testid="profile-coins">
              <CoinIcon size={18} /> {summary.coins}
            </span>
            <span className="stat-pill" data-testid="profile-trophies">
              <TrophyIcon size={18} /> {summary.trophies}
            </span>
            <span className="stat-pill" data-testid="profile-peaks">
              <PeakIcon size={18} /> {summary.peaksSummited} / {PEAKS.length} peaks
            </span>
          </div>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-climber-title">
        <h2 id="profile-climber-title">Pick your climber</h2>
        <p className="profile-section__lead">
          Tap an animal to switch. Your peaks and trophies stay.
        </p>
        <div className="animal-grid">
          {ANIMALS.map((candidate) => (
            <AnimalTile
              key={candidate.id}
              id={candidate.id}
              name={candidate.name}
              accent={candidate.accent}
              selected={candidate.id === animal.id}
              onPick={() => pick(candidate.id)}
            />
          ))}
        </div>
      </section>

      <section
        className="profile-section"
        id="accomplishments"
        ref={accomplishmentsRef}
        aria-labelledby="profile-accomplishments-title"
        data-testid="profile-accomplishments"
      >
        <h2 id="profile-accomplishments-title">Accomplishments</h2>

        <div className="coin-purse" data-testid="profile-coin-purse">
          <div className="coin-purse__head">
            <span>
              <CoinIcon size={20} /> <strong>{summary.coins}</strong> of {COIN_CAP} coins
            </span>
            <span className="coin-purse__hint">
              {summary.coins >= COIN_CAP
                ? 'Purse full!'
                : 'First clears pay the most — try a new level.'}
            </span>
          </div>
          <div
            className="coin-purse__bar"
            role="progressbar"
            aria-valuenow={summary.coins}
            aria-valuemax={COIN_CAP}
          >
            <div
              className="coin-purse__fill"
              style={{ width: `${(summary.coins / COIN_CAP) * 100}%` }}
            />
          </div>
        </div>

        <h3>
          Badges{' '}
          <span className="muted">
            ({earned} of {summary.badges.length})
          </span>
        </h3>
        <ul className="badge-grid" data-testid="profile-badges">
          {summary.badges.map((badge) => (
            <li
              key={badge.id}
              className={badge.earned ? 'badge badge--earned' : 'badge'}
              data-testid={`badge-${badge.id}`}
              data-earned={badge.earned ? 'true' : 'false'}
            >
              <span className="badge__icon" aria-hidden="true">
                {badge.earned ? '★' : '☆'}
              </span>
              <span className="badge__title">{badge.title}</span>
              <span className="badge__blurb">{badge.blurb}</span>
              {!badge.earned && badge.target > 1 && (
                <span className="badge__progress">
                  {badge.progress} / {badge.target}
                </span>
              )}
            </li>
          ))}
        </ul>

        <h3>Trophy case</h3>
        <ul className="trophy-case" data-testid="profile-trophy-case">
          {PEAKS.map((peak) => {
            const theme = peakTheme(peak.id);
            const progress = profile.progress[peak.id];
            const trophies = trophiesByPeak.get(peak.id) ?? [];
            const highest = progress?.highestDifficultyCleared ?? null;
            const best = highest !== null ? bestTimeForDifficulty(progress, highest) : null;
            return (
              <li
                key={peak.id}
                className="trophy-shelf"
                style={
                  { '--peak-rock': theme.rock, '--peak-flag': theme.flag } as React.CSSProperties
                }
                data-testid={`trophy-shelf-${peak.id}`}
              >
                <span className="trophy-shelf__peak">
                  <span className="peak-card__number" aria-hidden="true">
                    {peak.id}
                  </span>
                  <span className="trophy-shelf__name">{peak.name}</span>
                </span>
                <span className="trophy-shelf__status">
                  {highest !== null ? (
                    <>
                      Summited · Lv {highest}
                      {best !== null && <> · best {formatDuration(best)}</>}
                    </>
                  ) : (
                    'Not climbed yet'
                  )}
                </span>
                <span className="trophy-shelf__trophies">
                  {trophies.length === 0 ? (
                    <span className="trophy-shelf__empty">No trophies yet</span>
                  ) : (
                    trophies.map((trophy, i) => <TrophyMark key={i} trophy={trophy} />)
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        <h3>By the numbers</h3>
        <dl className="numbers" data-testid="profile-numbers">
          <div>
            <dt>Climbs started</dt>
            <dd>{summary.climbs}</dd>
          </div>
          <div>
            <dt>Summits</dt>
            <dd>{summary.summits}</dd>
          </div>
          <div>
            <dt>Falls</dt>
            <dd>{summary.falls}</dd>
          </div>
          <div>
            <dt>Questions answered</dt>
            <dd>{summary.questionsAnswered}</dd>
          </div>
          <div>
            <dt>Right first time</dt>
            <dd>{summary.accuracy === null ? '—' : `${Math.round(summary.accuracy * 100)}%`}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
