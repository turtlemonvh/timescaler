import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { formatDateLong } from '../../engine/dateMath';
import { describeDifficultyComparisonTable } from '../../engine/difficultyDescribe';
import { PEAKS, type Peak } from '../../engine/peaks';
import { computeRewards, trophyCountByPeak } from '../../engine/rewards';
import { resolveAnimal } from '../../scene/animals/roster';
import { playCue } from '../../scene/audio/synth';
import { MapScene } from '../../scene/lazy';
import { preloadAnimal } from '../../scene/lazyPreload';
import { peakTheme } from '../../scene/theme/peakThemes';
import {
  bestTimeForDifficulty,
  highestAttemptBeyondCleared,
  isPeakSummited,
} from '../../storage/profile';
import type { PeakProgress, Profile } from '../../storage/types';
import { climbLogResultLabel, sortedClimbLog } from '../climbLogCsv';
import {
  CHANGED_CHIP_STYLE,
  COMPARE_TABLE_STYLE,
  COMPARE_TD_STYLE,
  COMPARE_TH_STYLE,
} from '../compareTableStyles';
import { formatDuration } from '../formatDuration';
import MuteButton from '../hud/MuteButton';
import ProfileChip from '../hud/ProfileChip';
import { CoinIcon, TrophyIcon } from '../hud/RewardIcons';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const HISTORY_PREVIEW_LIMIT = 5;

export interface MapProps {
  profile: Profile;
  /** Starts a climb on `peakId` at `difficulty`; the caller persists the level first. */
  onClimb: (peakId: number, difficulty: number) => void;
  /** Opens the parent/teacher Review screen. */
  onReview: () => void;
  /** Opens the Review screen's Climber Log tab, pre-filtered to this peak+level. */
  onViewFullHistory: (peakId: number, difficulty: number) => void;
  /** Opens the player's profile page; `'accomplishments'` scrolls to that section. */
  onOpenProfile: (section: 'climber' | 'accomplishments') => void;
}

interface PeakStatusProps {
  peak: Peak;
  progress: PeakProgress | undefined;
  climbLog: Profile['climbLog'];
  /** Trophies earned on this peak, across all difficulties. */
  trophyCount: number;
  /**
   * The status shows both on the peak's tile and in the selected-peak panel;
   * only the tile (always rendered, one per peak) carries the test ids.
   */
  withTestIds: boolean;
  /** Extra pills appended after the progress ones. */
  children?: React.ReactNode;
}

/** Progress pills for one peak: summited / tried / not climbed, plus trophies. */
function PeakStatus({
  peak,
  progress,
  climbLog,
  trophyCount,
  withTestIds,
  children,
}: PeakStatusProps) {
  const highestCleared = progress?.highestDifficultyCleared ?? null;
  const attemptBeyond = highestAttemptBeyondCleared(climbLog, peak.id, highestCleared);
  const summited = progress ? isPeakSummited(progress) : false;
  const testId = (name: string) => (withTestIds ? `${name}-${peak.id}` : undefined);

  return (
    <span data-testid={testId('peak-progress')} className="peak-card__status">
      {!summited && !attemptBeyond && (
        <span data-testid={testId('peak-status-none')}>Not climbed yet</span>
      )}
      {summited && (
        <span data-testid={testId('peak-status-summit')} className="pill pill--summit">
          Summited · Lv {highestCleared}
        </span>
      )}
      {attemptBeyond && (
        <span data-testid={testId('peak-status-attempt')} className="pill">
          Tried Lv {attemptBeyond.difficulty} ({attemptBeyond.count}×)
        </span>
      )}
      {trophyCount > 0 && (
        <span
          data-testid={testId('peak-trophies')}
          className="peak-card__trophies"
          aria-label={`${trophyCount} ${trophyCount === 1 ? 'trophy' : 'trophies'}`}
          title={`${trophyCount} ${trophyCount === 1 ? 'trophy' : 'trophies'}`}
        >
          {Array.from({ length: trophyCount }, (_, i) => (
            <TrophyIcon key={i} size={16} />
          ))}
        </span>
      )}
      {children}
    </span>
  );
}

interface PeakTileProps {
  peak: Peak;
  selected: boolean;
  onSelect: () => void;
  progress: PeakProgress | undefined;
  climbLog: Profile['climbLog'];
  trophyCount: number;
}

/**
 * One peak in the compact list under the selected-peak panel: number, name
 * and progress only. Clicking it selects the peak, same as tapping the
 * mountain in the scene; the level picker and details live in the panel.
 */
function PeakTile({ peak, selected, onSelect, progress, climbLog, trophyCount }: PeakTileProps) {
  const theme = peakTheme(peak.id);
  return (
    <button
      type="button"
      className={selected ? 'peak-tile peak-tile--selected' : 'peak-tile'}
      data-testid={`peak-option-${peak.id}`}
      data-selected={selected ? 'true' : undefined}
      aria-pressed={selected}
      style={{ '--peak-rock': theme.rock, '--peak-flag': theme.flag } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="peak-card__number" aria-hidden="true">
        {peak.id}
      </span>
      <span className="peak-tile__title">
        <strong>{peak.name}</strong>
        <span className="peak-card__emphasis">{peak.emphasis}</span>
      </span>
      <PeakStatus
        peak={peak}
        progress={progress}
        climbLog={climbLog}
        trophyCount={trophyCount}
        withTestIds
      />
    </button>
  );
}

interface PeakCardProps {
  peak: Peak;
  progress: PeakProgress | undefined;
  climbLog: Profile['climbLog'];
  /** Trophies earned on this peak, across all difficulties. */
  trophyCount: number;
  /** The picked level — held by `Map` per peak, so switching peaks keeps each pick. */
  selectedLevel: number;
  onLevelChange: (level: number) => void;
  onClimb: (peakId: number, difficulty: number) => void;
  onViewFullHistory: (peakId: number, difficulty: number) => void;
}

/** The level suggested for a peak before the player picks one: one above the highest cleared. */
function defaultLevel(progress: PeakProgress | undefined): number {
  const highestCleared = progress?.highestDifficultyCleared ?? null;
  return highestCleared !== null ? Math.min(highestCleared + 1, 10) : (progress?.difficulty ?? 1);
}

/**
 * The selected peak's panel: progress pills, any level 1-10, and a details
 * disclosure with the level comparison table and recent history. The picked
 * level is provisional until "Climb!". Only one is shown at a time — for the
 * peak picked in the scene or the list below.
 */
function PeakCard({
  peak,
  progress,
  climbLog,
  trophyCount,
  selectedLevel,
  onLevelChange,
  onClimb,
  onViewFullHistory,
}: PeakCardProps) {
  const theme = peakTheme(peak.id);
  const highestCleared = progress?.highestDifficultyCleared ?? null;

  const compareRows = useMemo(
    () => describeDifficultyComparisonTable(highestCleared ?? 1, selectedLevel, peak.id),
    [highestCleared, selectedLevel, peak.id],
  );

  const levelHistory = useMemo(
    () =>
      sortedClimbLog(climbLog).filter(
        (entry) => entry.peakId === peak.id && entry.difficulty === selectedLevel,
      ),
    [climbLog, peak.id, selectedLevel],
  );

  const bestTimeAtSelectedLevel = bestTimeForDifficulty(progress, selectedLevel);

  return (
    <article
      className="peak-card"
      data-testid="peak-panel"
      data-peak-id={peak.id}
      style={{ '--peak-rock': theme.rock, '--peak-flag': theme.flag } as React.CSSProperties}
    >
      <div className="peak-card__head">
        <span className="peak-card__number" aria-hidden="true">
          {peak.id}
        </span>
        <div className="peak-card__title">
          <h2 className="peak-card__name">{peak.name}</h2>
          <span className="peak-card__emphasis">{peak.emphasis}</span>
        </div>
        <PeakStatus
          peak={peak}
          progress={progress}
          climbLog={climbLog}
          trophyCount={trophyCount}
          withTestIds={false}
        >
          {bestTimeAtSelectedLevel !== null && (
            <span data-testid={`peak-best-time-${peak.id}`} className="pill pill--best">
              🏆 Best Lv {selectedLevel}: {formatDuration(bestTimeAtSelectedLevel)}
            </span>
          )}
        </PeakStatus>
      </div>

      <div className="peak-card__actions">
        <label htmlFor={`peak-difficulty-${peak.id}`}>Level</label>
        <select
          id={`peak-difficulty-${peak.id}`}
          data-testid={`peak-difficulty-${peak.id}`}
          value={selectedLevel}
          onChange={(event) => onLevelChange(Number(event.target.value))}
        >
          {DIFFICULTIES.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-testid={`peak-climb-${peak.id}`}
          onClick={() => {
            playCue('select');
            onClimb(peak.id, selectedLevel);
          }}
        >
          Climb!
        </button>
      </div>

      <details className="peak-card__details">
        <summary data-testid={`peak-details-toggle-${peak.id}`}>
          Level {selectedLevel} details
        </summary>

        <table data-testid={`peak-compare-${peak.id}`} style={COMPARE_TABLE_STYLE}>
          <thead>
            <tr>
              <th style={COMPARE_TH_STYLE}>Item</th>
              <th style={COMPARE_TH_STYLE}>Now</th>
              <th style={COMPARE_TH_STYLE}>Level {selectedLevel}</th>
              <th style={COMPARE_TH_STYLE}>Changed</th>
            </tr>
          </thead>
          <tbody>
            {compareRows.map((row) => (
              <tr
                key={row.item}
                data-testid={`peak-compare-row-${peak.id}`}
                data-changed={row.changed}
              >
                <td style={COMPARE_TD_STYLE}>{row.item}</td>
                <td style={COMPARE_TD_STYLE}>{row.current}</td>
                <td style={COMPARE_TD_STYLE}>{row.next}</td>
                <td style={COMPARE_TD_STYLE}>
                  {row.changed ? (
                    <span style={CHANGED_CHIP_STYLE}>Changed</span>
                  ) : (
                    <span style={{ color: 'var(--text)' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ margin: '0.5rem 0 0.25rem' }}>History at level {selectedLevel}</p>
        {levelHistory.length === 0 ? (
          <p data-testid={`peak-history-empty-${peak.id}`}>No climbs at this level yet.</p>
        ) : (
          <>
            <table data-testid={`peak-history-${peak.id}`}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {levelHistory.slice(0, HISTORY_PREVIEW_LIMIT).map((entry) => (
                  <tr key={entry.id} data-testid={`peak-history-row-${peak.id}`}>
                    <td>{formatDateLong(new Date(entry.startedAt))}</td>
                    <td>{formatDuration(entry.endedAt - entry.startedAt)}</td>
                    <td>{climbLogResultLabel(entry.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {levelHistory.length > HISTORY_PREVIEW_LIMIT && (
              <button
                type="button"
                data-variant="secondary"
                data-testid={`peak-history-more-${peak.id}`}
                onClick={() => onViewFullHistory(peak.id, selectedLevel)}
              >
                See all {levelHistory.length} →
              </button>
            )}
          </>
        )}
      </details>
    </article>
  );
}

/** The first peak that is not yet summited, else the last one. */
function firstOpenPeak(profile: Profile): number {
  for (const peak of PEAKS) {
    const progress = profile.progress[peak.id];
    if (!progress || !isPeakSummited(progress)) return peak.id;
  }
  return PEAKS[PEAKS.length - 1].id;
}

/**
 * Peak selection: the 3D island with the player's animal standing at the
 * selected peak, the selected peak's panel (level picker, details, Climb!)
 * right under it, and a compact list of every peak's progress below that.
 * Tapping a mountain or a list entry selects it — only the selected peak's
 * details are shown, so the selection is what drives the screen. All ten
 * peaks are open from the start — the spec has no unlock mechanic.
 */
export default function Map({
  profile,
  onClimb,
  onReview,
  onViewFullHistory,
  onOpenProfile,
}: MapProps) {
  const animal = resolveAnimal(profile.characterId);
  const reducedMotion = usePrefersReducedMotion();
  const [selectedPeakId, setSelectedPeakId] = useState(() => firstOpenPeak(profile));
  const [recenterKey, setRecenterKey] = useState(0);
  const [levelByPeak, setLevelByPeak] = useState<Record<number, number>>({});
  const stageRef = useRef<HTMLDivElement>(null);

  // The climb needs this model; start fetching while the player is still choosing.
  useEffect(() => {
    preloadAnimal(animal.id);
  }, [animal.id]);
  const summitedPeakIds = useMemo(
    () =>
      PEAKS.filter((peak) => {
        const progress = profile.progress[peak.id];
        return progress ? isPeakSummited(progress) : false;
      }).map((peak) => peak.id),
    [profile.progress],
  );

  const rewards = useMemo(() => computeRewards(profile), [profile]);
  const trophyCounts = useMemo(() => trophyCountByPeak(rewards.trophies), [rewards.trophies]);

  const selectedPeak = PEAKS.find((peak) => peak.id === selectedPeakId) ?? PEAKS[0];

  function select(peakId: number) {
    if (peakId !== selectedPeakId) playCue('tap');
    setSelectedPeakId(peakId);
  }

  /** Picking from the list can happen far below the panel — bring the scene and panel back into view. */
  function selectFromList(peakId: number) {
    select(peakId);
    stageRef.current?.scrollIntoView?.({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }

  return (
    <main className="map-screen">
      <div className="map-screen__scene" data-testid="map-stage" ref={stageRef}>
        <Suspense
          fallback={
            <div className="scene-fallback scene-fallback--sky">
              <span className="scene-loading">Loading the mountain…</span>
            </div>
          }
        >
          <MapScene
            selectedPeakId={selectedPeakId}
            summitedPeakIds={summitedPeakIds}
            animalId={animal.id}
            onSelectPeak={select}
            recenterKey={recenterKey}
            reducedMotion={reducedMotion}
          />
        </Suspense>
        <p className="map-screen__hint" aria-hidden="true">
          Drag to look around · tap a peak to pick it
        </p>
        <button
          type="button"
          className="map-recenter"
          data-testid="map-recenter"
          title="Back to your climber"
          aria-label="Back to your climber"
          onClick={() => setRecenterKey((key) => key + 1)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.2" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <path
              d="M12 2v4M12 18v4M2 12h4M18 12h4"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="map-screen__bar">
          <div className="map-screen__bar-left">
            <button
              type="button"
              className="chip-button"
              data-testid="profile-open"
              title="Your climber and accomplishments"
              onClick={() => onOpenProfile('climber')}
            >
              <ProfileChip
                name={profile.name}
                preview={
                  <span
                    className="profile-chip__animal"
                    style={{ background: animal.accent }}
                    title={animal.name}
                  >
                    {animal.name[0]}
                  </span>
                }
              />
            </button>
            <button
              type="button"
              className="chip-button rewards-chip"
              data-testid="rewards-chip"
              aria-label={`${rewards.coins} coins, ${rewards.trophies.length} trophies — see accomplishments`}
              onClick={() => onOpenProfile('accomplishments')}
            >
              <CoinIcon />
              <span data-testid="rewards-coins">{rewards.coins}</span>
              <span className="rewards-chip__sep" aria-hidden="true">
                ·
              </span>
              <TrophyIcon />
              <span data-testid="rewards-trophies">{rewards.trophies.length}</span>
            </button>
          </div>
          <h1 className="map-screen__title">Choose a peak</h1>
          <div className="map-screen__bar-actions">
            <MuteButton />
            <button
              type="button"
              data-variant="secondary"
              data-testid="map-review-link"
              onClick={onReview}
            >
              Review
            </button>
          </div>
        </div>
      </div>

      <div className="page map-screen__list">
        <PeakCard
          key={selectedPeak.id}
          peak={selectedPeak}
          progress={profile.progress[selectedPeak.id]}
          climbLog={profile.climbLog}
          trophyCount={trophyCounts[selectedPeak.id] ?? 0}
          selectedLevel={
            levelByPeak[selectedPeak.id] ?? defaultLevel(profile.progress[selectedPeak.id])
          }
          onLevelChange={(level) =>
            setLevelByPeak((current) => ({ ...current, [selectedPeak.id]: level }))
          }
          onClimb={onClimb}
          onViewFullHistory={onViewFullHistory}
        />

        <div className="peak-tiles" data-testid="peak-grid">
          {PEAKS.map((peak) => (
            <PeakTile
              key={peak.id}
              peak={peak}
              selected={peak.id === selectedPeakId}
              onSelect={() => selectFromList(peak.id)}
              progress={profile.progress[peak.id]}
              climbLog={profile.climbLog}
              trophyCount={trophyCounts[peak.id] ?? 0}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
