import {
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { formatDateLong } from '../../engine/dateMath';
import {
  describeDifficultyComparisonTable,
  describeDifficultyLevel,
} from '../../engine/difficultyDescribe';
import { PEAKS, getPeak } from '../../engine/peaks';
import { generateQuestion } from '../../engine/questions';
import { mulberry32 } from '../../engine/rng';
import { goalsForPeak } from '../../storage/profile';
import type { Goal, Profile } from '../../storage/types';
import { climbLogResultLabel, downloadClimbLogCsv, sortedClimbLog } from '../climbLogCsv';
import {
  CHANGED_CHIP_STYLE,
  COMPARE_TABLE_STYLE,
  COMPARE_TD_STYLE,
  COMPARE_TH_STYLE,
} from '../compareTableStyles';
import { formatDuration } from '../formatDuration';
import { downloadProfileJson, parseProfileJson } from '../profileFile';
import { pad } from '../questionDisplay';
import SampleQuestion from '../SampleQuestion';

const DIFFICULTIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const TAB_BAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  gap: '0.4rem',
  flexWrap: 'wrap',
  background: 'var(--code-bg)',
  border: '1px solid var(--border)',
  borderRadius: 999,
  padding: '0.3rem',
  marginBottom: '1rem',
};
/** Explicitly resets every property the global `button` rule sets
 * (box-shadow, border-radius, min-height, ...) — leaving any of them
 * unset here means it leaks through as a stray pill-shaped shadow behind
 * this flat segmented-control look. */
const TAB_STYLE: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: 'var(--text)',
  padding: '0.5rem 0.9rem',
  minHeight: 'auto',
  border: 'none',
  borderRadius: 999,
  background: 'none',
  boxShadow: 'none',
  cursor: 'pointer',
};
const TAB_ACTIVE_STYLE: CSSProperties = {
  ...TAB_STYLE,
  color: '#fff',
  background: 'var(--accent)',
  cursor: 'default',
};
const CARD_STYLE: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '1rem',
  marginBottom: '0.75rem',
};
const CARD_HEADING_STYLE: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text)',
  margin: '0 0 0.75rem',
};
const GOAL_CTA_STYLE: CSSProperties = {
  ...CARD_STYLE,
  border: '2px dashed var(--accent-border)',
  background: 'var(--accent-bg)',
};
const PAGE_STEP_STYLE: CSSProperties = {
  minWidth: 32,
  minHeight: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-h)',
  fontSize: '0.85rem',
  fontWeight: 700,
  boxShadow: 'none',
};
const PAGE_STEP_CURRENT_STYLE: CSSProperties = {
  ...PAGE_STEP_STYLE,
  background: 'var(--accent)',
  borderColor: 'var(--accent)',
  color: '#fff',
};
const SCROLL_X_STYLE: CSSProperties = { overflowX: 'auto' };
/** `#root` sets `text-align: center` for the whole app; a plain bulleted
 * list never resets that, so wrapped text centers under a left-flush
 * marker. Left-align explicitly and swap the browser's default disc for a
 * themed dot instead of relying on `list-style`, which can't be colored
 * independently of the text. */
const BULLET_LIST_STYLE: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  textAlign: 'left',
};
const BULLET_ITEM_STYLE: CSSProperties = {
  position: 'relative',
  paddingLeft: '1rem',
  marginBottom: '0.35rem',
};
const BULLET_MARKER_STYLE: CSSProperties = { position: 'absolute', left: 0, color: 'var(--pine)' };

function Bullet({
  children,
  ...rest
}: { children: ReactNode } & Omit<ComponentPropsWithoutRef<'li'>, 'style'>) {
  return (
    <li style={BULLET_ITEM_STYLE} {...rest}>
      <span style={BULLET_MARKER_STYLE} aria-hidden="true">
        ●
      </span>
      {children}
    </li>
  );
}

function defaultCompareLevel(level: number): number {
  return level >= 10 ? level - 1 : level + 1;
}

/** Local-time `yyyy-mm-dd`, not `Date.prototype.toISOString()` — that's
 * UTC-based and can land on the wrong calendar day near midnight, the same
 * pitfall `randomDate` hit (see CLAUDE.md). */
function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Soonest-due first, regardless of pending/achieved status — a parent
 * scanning the list cares about "what's coming up", and an achieved goal
 * keeps its original target date rather than jumping to the front. */
function sortedGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate));
}

interface DifficultyPaginationProps {
  value: number;
  onChange: (level: number) => void;
}

/** Difficulty picker as pagination rather than a dropdown — browsing the
 * curriculum means stepping back and forth between levels often, and a
 * dropdown makes every step a multi-tap round trip through a closed menu. */
function DifficultyPagination({ value, onChange }: DifficultyPaginationProps) {
  return (
    <div
      data-testid="review-difficulty"
      style={{
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: '0.5rem',
      }}
    >
      <button
        type="button"
        data-testid="review-difficulty-prev"
        aria-label="Previous level"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        style={PAGE_STEP_STYLE}
      >
        ‹
      </button>
      {DIFFICULTIES.map((level) => (
        <button
          key={level}
          type="button"
          data-testid={`review-difficulty-page-${level}`}
          onClick={() => onChange(level)}
          style={level === value ? PAGE_STEP_CURRENT_STYLE : PAGE_STEP_STYLE}
        >
          {level}
        </button>
      ))}
      <button
        type="button"
        data-testid="review-difficulty-next"
        aria-label="Next level"
        disabled={value >= 10}
        onClick={() => onChange(value + 1)}
        style={PAGE_STEP_STYLE}
      >
        ›
      </button>
    </div>
  );
}

export interface ReviewProps {
  profile: Profile;
  onBack: () => void;
  onAddGoal: (peakId: number, difficulty: number, targetDate: string) => void;
  /** Called with an already-parsed, shape-checked `Profile` — collision
   * detection against the rest of the save file (and any overwrite
   * confirmation) is the caller's job, since Review only ever sees the one
   * active profile, not the full profile list. */
  onImportProfile: (profile: Profile) => void;
  /** Pre-filters the Climber Log tab to this peak+level and switches
   * straight to it — set when arriving via a peak card's "see full
   * history" link rather than by clicking the Review link directly. */
  initialLogFilter?: { peakId: number; difficulty: number };
}

type Section = 'curriculum' | 'log' | 'goals' | 'export';

/**
 * Parent/teacher-facing tooling, reachable from Map. Ships the curriculum
 * browser (6a), climber log (6b), goals (6c), and profile export/import
 * (6d) — the full set of sections this screen's shell was built for.
 */
export default function Review({
  profile,
  onBack,
  onAddGoal,
  onImportProfile,
  initialLogFilter,
}: ReviewProps) {
  const [section, setSection] = useState<Section>(initialLogFilter ? 'log' : 'curriculum');
  const [peakId, setPeakId] = useState(PEAKS[0].id);
  const [difficulty, setDifficulty] = useState(1);
  const [compareLevel, setCompareLevel] = useState(() => defaultCompareLevel(difficulty));
  // Tracks the difficulty compareLevel was last defaulted for — when they
  // drift apart (the player paged to a new level), reset compareLevel to
  // the new default. Setting state conditionally during render, compared
  // against a value tracked in its own state, is React's own recommended
  // way to "adjust state when a prop changes" without the extra render
  // pass (and the lint error) a `useEffect` doing the same setState causes.
  const [compareLevelDefaultedFor, setCompareLevelDefaultedFor] = useState(difficulty);
  if (difficulty !== compareLevelDefaultedFor) {
    setCompareLevelDefaultedFor(difficulty);
    setCompareLevel(defaultCompareLevel(difficulty));
  }

  const [sampleRefreshCount, setSampleRefreshCount] = useState(0);
  const sampleKey = `${peakId}-${difficulty}`;
  const [sampleKeyForRefreshCount, setSampleKeyForRefreshCount] = useState(sampleKey);
  if (sampleKey !== sampleKeyForRefreshCount) {
    setSampleKeyForRefreshCount(sampleKey);
    setSampleRefreshCount(0);
  }

  const [goalCtaDate, setGoalCtaDate] = useState(() => todayIsoDate());
  const [goalPeakId, setGoalPeakId] = useState(PEAKS[0].id);
  const [goalDifficulty, setGoalDifficulty] = useState(1);
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [logPeakFilter, setLogPeakFilter] = useState<number | 'all'>(
    initialLogFilter?.peakId ?? 'all',
  );
  const [logDifficultyFilter, setLogDifficultyFilter] = useState<number | 'all'>(
    initialLogFilter?.difficulty ?? 'all',
  );

  const bullets = useMemo(() => describeDifficultyLevel(difficulty, peakId), [difficulty, peakId]);
  const compareRows = useMemo(
    () => describeDifficultyComparisonTable(difficulty, compareLevel, peakId),
    [difficulty, compareLevel, peakId],
  );
  const sampleQuestion = useMemo(() => {
    const peak = getPeak(peakId);
    const rng = mulberry32(peakId * 1000 + difficulty * 10 + sampleRefreshCount);
    return generateQuestion(rng, { difficulty, peak });
  }, [peakId, difficulty, sampleRefreshCount]);
  const { pending: pendingGoalsForPeak, lastAchieved: lastAchievedGoalForPeak } = useMemo(
    () => goalsForPeak(profile.goals, peakId),
    [profile.goals, peakId],
  );

  const climbLog = useMemo(() => sortedClimbLog(profile.climbLog), [profile.climbLog]);
  const filteredClimbLog = useMemo(
    () =>
      climbLog.filter(
        (entry) =>
          (logPeakFilter === 'all' || entry.peakId === logPeakFilter) &&
          (logDifficultyFilter === 'all' || entry.difficulty === logDifficultyFilter),
      ),
    [climbLog, logPeakFilter, logDifficultyFilter],
  );
  const goals = useMemo(() => sortedGoals(profile.goals), [profile.goals]);

  function handleCreateGoalFromCurriculum() {
    onAddGoal(peakId, difficulty, goalCtaDate);
    setGoalCtaDate(todayIsoDate());
  }

  function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = parseProfileJson(String(reader.result));
        setImportError(null);
        onImportProfile(imported);
      } catch {
        setImportError("That file doesn't look like a climber profile.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <main className="page page--wide">
      <h1>Review</h1>
      <p>
        A reference for parents and teachers: what does each peak actually ask at each difficulty
        level, and what has {profile.name} actually done?
      </p>
      <button
        type="button"
        data-testid="review-back"
        onClick={onBack}
        style={{ marginBottom: '1rem' }}
      >
        Back to Map
      </button>

      <div style={TAB_BAR_STYLE}>
        <button
          type="button"
          data-testid="review-tab-curriculum"
          disabled={section === 'curriculum'}
          onClick={() => setSection('curriculum')}
          style={section === 'curriculum' ? TAB_ACTIVE_STYLE : TAB_STYLE}
        >
          Curriculum
        </button>
        <button
          type="button"
          data-testid="review-tab-log"
          disabled={section === 'log'}
          onClick={() => setSection('log')}
          style={section === 'log' ? TAB_ACTIVE_STYLE : TAB_STYLE}
        >
          Climber log
        </button>
        <button
          type="button"
          data-testid="review-tab-goals"
          disabled={section === 'goals'}
          onClick={() => setSection('goals')}
          style={section === 'goals' ? TAB_ACTIVE_STYLE : TAB_STYLE}
        >
          Goals
        </button>
        <button
          type="button"
          data-testid="review-tab-export"
          disabled={section === 'export'}
          onClick={() => setSection('export')}
          style={section === 'export' ? TAB_ACTIVE_STYLE : TAB_STYLE}
        >
          Export/Import
        </button>
      </div>

      {section === 'curriculum' && (
        <section data-testid="review-curriculum">
          <div style={CARD_STYLE}>
            <h3 style={CARD_HEADING_STYLE}>Browse</h3>
            <p style={{ margin: 0 }}>
              <label htmlFor="review-peak">Peak</label>{' '}
              <select
                id="review-peak"
                data-testid="review-peak"
                value={peakId}
                onChange={(event) => setPeakId(Number(event.target.value))}
              >
                {PEAKS.map((peak) => (
                  <option key={peak.id} value={peak.id}>
                    {peak.id}. {peak.name} — {peak.emphasis}
                  </option>
                ))}
              </select>
            </p>
            <DifficultyPagination value={difficulty} onChange={setDifficulty} />
          </div>

          <div style={CARD_STYLE}>
            <h3 style={CARD_HEADING_STYLE}>What difficulty {difficulty} means</h3>
            <ul
              data-testid="review-difficulty-bullets"
              style={{ ...BULLET_LIST_STYLE, columns: 2, columnGap: '1.25rem' }}
            >
              {bullets.map((line) => (
                <Bullet key={line}>{line}</Bullet>
              ))}
            </ul>
          </div>

          <div style={CARD_STYLE}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
              }}
            >
              <h3 style={{ ...CARD_HEADING_STYLE, margin: 0 }}>Compare to</h3>
              <select
                data-testid="review-compare-level"
                value={compareLevel}
                onChange={(event) => setCompareLevel(Number(event.target.value))}
              >
                {DIFFICULTIES.filter((level) => level !== difficulty).map((level) => (
                  <option key={level} value={level}>
                    Level {level}
                  </option>
                ))}
              </select>
            </div>
            <div style={SCROLL_X_STYLE}>
              <table data-testid="review-compare-table" style={COMPARE_TABLE_STYLE}>
                <thead>
                  <tr>
                    <th style={COMPARE_TH_STYLE}>Item</th>
                    <th style={COMPARE_TH_STYLE}>Level {difficulty}</th>
                    <th style={COMPARE_TH_STYLE}>Level {compareLevel}</th>
                    <th style={COMPARE_TH_STYLE}>Changed</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.item} data-testid="review-compare-row" data-changed={row.changed}>
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
            </div>
          </div>

          <div style={GOAL_CTA_STYLE} data-testid="review-goal-cta">
            Create a goal for <strong>{profile.name}</strong> on{' '}
            <strong>{getPeak(peakId).name}</strong> at difficulty <strong>{difficulty}</strong> by{' '}
            <input
              type="date"
              data-testid="review-goal-cta-date"
              value={goalCtaDate}
              onChange={(event) => setGoalCtaDate(event.target.value)}
            />{' '}
            <button
              type="button"
              data-testid="review-goal-cta-submit"
              disabled={!goalCtaDate}
              onClick={handleCreateGoalFromCurriculum}
            >
              Create goal
            </button>
            {pendingGoalsForPeak.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.25rem', fontWeight: 700 }}>
                  Pending goals for this peak
                </p>
                <ul data-testid="review-goal-cta-pending-list" style={BULLET_LIST_STYLE}>
                  {pendingGoalsForPeak.map((goal) => (
                    <Bullet key={goal.id} data-testid="review-goal-cta-pending-row">
                      Level {goal.difficulty} by {goal.targetDate}
                    </Bullet>
                  ))}
                </ul>
              </div>
            )}
            {lastAchievedGoalForPeak && (
              <p
                data-testid="review-goal-cta-achieved"
                style={{ marginTop: '0.75rem', marginBottom: 0 }}
              >
                Last achieved: Level {lastAchievedGoalForPeak.difficulty} on{' '}
                {formatDateLong(new Date(lastAchievedGoalForPeak.achievedAt))}
              </p>
            )}
          </div>

          <div style={CARD_STYLE}>
            <h3 style={CARD_HEADING_STYLE}>Sample question</h3>
            <SampleQuestion question={sampleQuestion} />
            <button
              type="button"
              data-testid="review-sample-refresh"
              onClick={() => setSampleRefreshCount((n) => n + 1)}
              style={{ display: 'block', margin: '0.75rem auto 0' }}
            >
              Show another example
            </button>
          </div>
        </section>
      )}

      {section === 'log' && (
        <section data-testid="review-log">
          <div style={CARD_STYLE}>
            <p style={{ margin: 0 }}>
              <label htmlFor="review-log-filter-peak">Peak</label>{' '}
              <select
                id="review-log-filter-peak"
                data-testid="review-log-filter-peak"
                value={logPeakFilter}
                onChange={(event) =>
                  setLogPeakFilter(
                    event.target.value === 'all' ? 'all' : Number(event.target.value),
                  )
                }
              >
                <option value="all">All peaks</option>
                {PEAKS.map((peak) => (
                  <option key={peak.id} value={peak.id}>
                    {peak.id}. {peak.name}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="review-log-filter-difficulty">Level</label>{' '}
              <select
                id="review-log-filter-difficulty"
                data-testid="review-log-filter-difficulty"
                value={logDifficultyFilter}
                onChange={(event) =>
                  setLogDifficultyFilter(
                    event.target.value === 'all' ? 'all' : Number(event.target.value),
                  )
                }
              >
                <option value="all">All levels</option>
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </p>

            <p style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                data-testid="review-log-download"
                disabled={filteredClimbLog.length === 0}
                onClick={() => downloadClimbLogCsv(filteredClimbLog)}
              >
                Download CSV
              </button>
            </p>

            {filteredClimbLog.length === 0 ? (
              <p data-testid="review-log-empty">
                {climbLog.length === 0 ? 'No climbs yet.' : 'No climbs match this filter.'}
              </p>
            ) : (
              <div style={SCROLL_X_STYLE}>
                <table data-testid="review-log-table" style={COMPARE_TABLE_STYLE}>
                  <thead>
                    <tr>
                      <th style={COMPARE_TH_STYLE}>Peak</th>
                      <th style={COMPARE_TH_STYLE}>Difficulty</th>
                      <th style={COMPARE_TH_STYLE}>Date</th>
                      <th style={COMPARE_TH_STYLE}>Duration</th>
                      <th style={COMPARE_TH_STYLE}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClimbLog.map((entry) => (
                      <tr key={entry.id} data-testid="review-log-row">
                        <td style={COMPARE_TD_STYLE}>{getPeak(entry.peakId).name}</td>
                        <td style={COMPARE_TD_STYLE}>{entry.difficulty}</td>
                        <td style={COMPARE_TD_STYLE}>
                          {formatDateLong(new Date(entry.startedAt))}
                        </td>
                        <td style={COMPARE_TD_STYLE}>
                          {formatDuration(entry.endedAt - entry.startedAt)}
                        </td>
                        <td style={COMPARE_TD_STYLE}>{climbLogResultLabel(entry.result)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {section === 'goals' && (
        <section data-testid="review-goals">
          <div style={CARD_STYLE}>
            <form
              data-testid="review-goal-form"
              onSubmit={(event) => {
                event.preventDefault();
                onAddGoal(goalPeakId, goalDifficulty, goalTargetDate);
                setGoalTargetDate('');
              }}
            >
              <label htmlFor="review-goal-peak">Peak</label>{' '}
              <select
                id="review-goal-peak"
                data-testid="review-goal-peak"
                value={goalPeakId}
                onChange={(event) => setGoalPeakId(Number(event.target.value))}
              >
                {PEAKS.map((peak) => (
                  <option key={peak.id} value={peak.id}>
                    {peak.id}. {peak.name}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="review-goal-difficulty">Level</label>{' '}
              <select
                id="review-goal-difficulty"
                data-testid="review-goal-difficulty"
                value={goalDifficulty}
                onChange={(event) => setGoalDifficulty(Number(event.target.value))}
              >
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>{' '}
              <label htmlFor="review-goal-date">By</label>{' '}
              <input
                id="review-goal-date"
                data-testid="review-goal-date"
                type="date"
                value={goalTargetDate}
                onChange={(event) => setGoalTargetDate(event.target.value)}
              />{' '}
              <button type="submit" data-testid="review-goal-submit" disabled={!goalTargetDate}>
                Add goal
              </button>
            </form>
          </div>

          <div style={CARD_STYLE}>
            {goals.length === 0 ? (
              <p data-testid="review-goals-empty" style={{ margin: 0 }}>
                No goals yet.
              </p>
            ) : (
              <ul data-testid="review-goals-list" style={BULLET_LIST_STYLE}>
                {goals.map((goal) => (
                  <Bullet key={goal.id} data-testid="review-goal-row">
                    {getPeak(goal.peakId).name} — level {goal.difficulty} by {goal.targetDate}:{' '}
                    {goal.achievedAt === null
                      ? 'Pending'
                      : `Achieved ${formatDateLong(new Date(goal.achievedAt))}`}
                  </Bullet>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {section === 'export' && (
        <section data-testid="review-export">
          <div style={CARD_STYLE}>
            <p style={{ marginBottom: '0.75rem' }}>
              The profile lives only in this browser&apos;s storage — export it to keep a backup, or
              to move it to another device.
            </p>
            <button
              type="button"
              data-testid="review-export-download"
              onClick={() => downloadProfileJson(profile)}
            >
              Export {profile.name}&apos;s profile
            </button>
          </div>

          <div style={CARD_STYLE}>
            <p style={{ margin: 0 }}>
              <label htmlFor="review-import-file">Import a profile file</label>{' '}
              <input
                id="review-import-file"
                data-testid="review-import-file"
                type="file"
                accept="application/json"
                onChange={handleImportFile}
              />
            </p>
            {importError && (
              <p data-testid="review-import-error" style={{ marginBottom: 0 }}>
                {importError}
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
