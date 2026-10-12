import { useMemo, useState } from 'react';
import { formatDateLong } from '../../engine/dateMath';
import { describeDifficultyComparisonTable } from '../../engine/difficultyDescribe';
import { PEAKS, type Peak } from '../../engine/peaks';
import { resolveAnimal } from '../../scene/animals/roster';
import { playCue } from '../../scene/audio/synth';
import MapScene from '../../scene/map/MapScene';
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
}

interface PeakCardProps {
  peak: Peak;
  selected: boolean;
  onSelect: () => void;
  progress: PeakProgress | undefined;
  climbLog: Profile['climbLog'];
  onClimb: (peakId: number, difficulty: number) => void;
  onViewFullHistory: (peakId: number, difficulty: number) => void;
}

/**
 * One peak's picker: progress pills, any level 1-10, and a details
 * disclosure with the level comparison table and recent history. The picked
 * level is provisional until "Climb!".
 */
function PeakCard({
  peak,
  selected,
  onSelect,
  progress,
  climbLog,
  onClimb,
  onViewFullHistory,
}: PeakCardProps) {
  const theme = peakTheme(peak.id);
  const highestCleared = progress?.highestDifficultyCleared ?? null;
  const defaultLevel =
    highestCleared !== null ? Math.min(highestCleared + 1, 10) : (progress?.difficulty ?? 1);
  const [selectedLevel, setSelectedLevel] = useState(defaultLevel);

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

  const attemptBeyond = highestAttemptBeyondCleared(climbLog, peak.id, highestCleared);
  const summited = progress ? isPeakSummited(progress) : false;
  const bestTimeAtSelectedLevel = bestTimeForDifficulty(progress, selectedLevel);

  return (
    <article
      className={selected ? 'peak-card peak-card--selected' : 'peak-card'}
      data-testid={`peak-option-${peak.id}`}
      data-selected={selected ? 'true' : undefined}
      style={{ '--peak-rock': theme.rock, '--peak-flag': theme.flag } as React.CSSProperties}
      onClick={onSelect}
    >
      <div className="peak-card__head">
        <span className="peak-card__number" aria-hidden="true">
          {peak.id}
        </span>
        <div className="peak-card__title">
          <strong>{peak.name}</strong>
          <span className="peak-card__emphasis">{peak.emphasis}</span>
        </div>
        <span data-testid={`peak-progress-${peak.id}`} className="peak-card__status">
          {!summited && !attemptBeyond && (
            <span data-testid={`peak-status-none-${peak.id}`}>Not climbed yet</span>
          )}
          {summited && (
            <span data-testid={`peak-status-summit-${peak.id}`} className="pill pill--summit">
              Summited · Lv {highestCleared}
            </span>
          )}
          {attemptBeyond && (
            <span data-testid={`peak-status-attempt-${peak.id}`} className="pill">
              Tried Lv {attemptBeyond.difficulty} ({attemptBeyond.count}×)
            </span>
          )}
          {bestTimeAtSelectedLevel !== null && (
            <span data-testid={`peak-best-time-${peak.id}`} className="pill pill--best">
              🏆 Best Lv {selectedLevel}: {formatDuration(bestTimeAtSelectedLevel)}
            </span>
          )}
        </span>
      </div>

      <div className="peak-card__actions">
        <label htmlFor={`peak-difficulty-${peak.id}`}>Level</label>
        <select
          id={`peak-difficulty-${peak.id}`}
          data-testid={`peak-difficulty-${peak.id}`}
          value={selectedLevel}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setSelectedLevel(Number(event.target.value))}
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
          onClick={(event) => {
            event.stopPropagation();
            playCue('select');
            onClimb(peak.id, selectedLevel);
          }}
        >
          Climb!
        </button>
      </div>

      <details className="peak-card__details" onClick={(event) => event.stopPropagation()}>
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
 * selected peak, and the list of peak cards below it. Clicking a mountain
 * or a card selects it; "Climb!" starts the climb. All ten peaks are open
 * from the start — the spec has no unlock mechanic.
 */
export default function Map({ profile, onClimb, onReview, onViewFullHistory }: MapProps) {
  const animal = resolveAnimal(profile.characterId);
  const reducedMotion = usePrefersReducedMotion();
  const [selectedPeakId, setSelectedPeakId] = useState(() => firstOpenPeak(profile));
  const summitedPeakIds = useMemo(
    () =>
      PEAKS.filter((peak) => {
        const progress = profile.progress[peak.id];
        return progress ? isPeakSummited(progress) : false;
      }).map((peak) => peak.id),
    [profile.progress],
  );

  function select(peakId: number) {
    if (peakId !== selectedPeakId) playCue('tap');
    setSelectedPeakId(peakId);
  }

  return (
    <main className="map-screen">
      <div className="map-screen__scene" data-testid="map-stage">
        <MapScene
          selectedPeakId={selectedPeakId}
          summitedPeakIds={summitedPeakIds}
          animalId={animal.id}
          onSelectPeak={select}
          reducedMotion={reducedMotion}
        />
        <div className="map-screen__bar">
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

      <div className="page map-screen__list" data-testid="peak-grid">
        {PEAKS.map((peak) => (
          <PeakCard
            key={peak.id}
            peak={peak}
            selected={peak.id === selectedPeakId}
            onSelect={() => select(peak.id)}
            progress={profile.progress[peak.id]}
            climbLog={profile.climbLog}
            onClimb={onClimb}
            onViewFullHistory={onViewFullHistory}
          />
        ))}
      </div>
    </main>
  );
}
