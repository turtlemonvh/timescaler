import { useState } from 'react';
import { applyCorrect, applyMiss, createClimb, type ClimbState } from '../../engine/climb';
import { PEAKS, getPeak } from '../../engine/peaks';
import ClimbStage, { NO_MOVE, type ClimbStageMove } from '../climb/ClimbStage';
import { moveKindFor } from '../climb/climbStageMotion';

const NARROW_WIDTH = 390;

interface StageState {
  climb: ClimbState;
  move: ClimbStageMove;
}

function start(peakId: number, difficulty: number): StageState {
  return { climb: createClimb(getPeak(peakId), difficulty), move: NO_MOVE };
}

/**
 * Dev-only driver for `ClimbStage` (issue #94). Every button applies a real
 * `climb.ts` transition and lets `moveKindFor` decide the animation, so what
 * you see here is what a climb does — this page cannot show a hop the rules
 * would not grant. The two exceptions are labelled: "Fill boost" and "Reset"
 * set state directly, because no single answer reaches them.
 *
 * The 390px toggle narrows the stage's *container*, and the stage's narrow
 * layout is written as a container query, so the toggle reproduces a phone
 * rather than merely squeezing the desktop layout.
 */
export default function DebugClimbStagePage() {
  const [peakId, setPeakId] = useState(1);
  const [difficulty, setDifficulty] = useState(5);
  const [narrow, setNarrow] = useState(false);
  const [state, setState] = useState<StageState>(() => start(1, 5));

  const peak = getPeak(peakId);

  /** Apply a `climb.ts` transition and let the stage read the move off it. */
  function transition(next: (current: ClimbState) => ClimbState, fast = false) {
    setState((current) => {
      const climb = next(current.climb);
      return {
        climb,
        move: {
          kind: moveKindFor(current.climb, climb, { fast }),
          seq: current.move.seq + 1,
        },
      };
    });
  }

  function reset(nextPeakId = peakId, nextDifficulty = difficulty) {
    setState(start(nextPeakId, nextDifficulty));
  }

  return (
    <main>
      <h1>Debug: climb-stage</h1>
      <p>Dev-only. Not shipped to production — see CONTRIBUTING for how to reach this page.</p>

      <p style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        <button
          type="button"
          data-testid="stage-correct"
          onClick={() => transition((c) => applyCorrect(c, false))}
        >
          Correct
        </button>
        <button
          type="button"
          data-testid="stage-fast-correct"
          onClick={() => transition((c) => applyCorrect(c, true), true)}
        >
          Fast correct
        </button>
        <button
          type="button"
          data-testid="stage-miss"
          onClick={() => transition((c) => applyMiss(c))}
        >
          Miss
        </button>
        <button
          type="button"
          data-variant="secondary"
          data-testid="stage-fill-boost"
          onClick={() =>
            setState((current) => ({
              ...current,
              climb: { ...current.climb, boost: current.climb.boostCapacity },
            }))
          }
        >
          Fill boost
        </button>
        <button
          type="button"
          data-testid="stage-summit"
          onClick={() =>
            transition((c) => applyCorrect({ ...c, position: Math.max(0, c.height - 1) }, false))
          }
        >
          Summit
        </button>
        <button
          type="button"
          data-testid="stage-fall"
          onClick={() => transition((c) => applyMiss({ ...c, fallRisk: c.fallRiskCapacity }))}
        >
          Fall
        </button>
        <button
          type="button"
          data-variant="ghost"
          data-testid="stage-reset"
          onClick={() => reset()}
        >
          Reset
        </button>
        <button
          type="button"
          data-variant="secondary"
          data-testid="stage-narrow-toggle"
          aria-pressed={narrow}
          onClick={() => setNarrow((on) => !on)}
        >
          {narrow ? `Narrow ${NARROW_WIDTH}px: on` : `Narrow ${NARROW_WIDTH}px: off`}
        </button>
      </p>

      <p style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
        <label htmlFor="stage-peak">Peak</label>
        <select
          id="stage-peak"
          data-testid="stage-peak"
          value={peakId}
          onChange={(event) => {
            const next = Number(event.target.value);
            setPeakId(next);
            reset(next);
          }}
        >
          {PEAKS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor="stage-difficulty">Difficulty</label>
        <select
          id="stage-difficulty"
          data-testid="stage-difficulty"
          value={difficulty}
          onChange={(event) => {
            const next = Number(event.target.value);
            setDifficulty(next);
            reset(peakId, next);
          }}
        >
          {[1, 3, 5, 7, 9, 10].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </p>

      <p data-testid="stage-state">
        position {state.climb.position}/{state.climb.height} · boost {state.climb.boost}/
        {state.climb.boostCapacity} · fall risk {state.climb.fallRisk}/
        {state.climb.fallRiskCapacity} · status {state.climb.status} · move {state.move.kind}
      </p>

      <div
        className="climb-stage-frame"
        data-testid="stage-frame"
        style={{
          width: narrow ? NARROW_WIDTH : '100%',
          maxWidth: '100%',
          margin: '0 auto',
          border: '2px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <ClimbStage
          peak={peak}
          position={state.climb.position}
          height={state.climb.height}
          status={state.climb.status}
          move={state.move}
          boosted={state.climb.boost >= state.climb.boostCapacity}
        >
          <h2 className="climb-stage__title">{peak.name}</h2>
          <p>The question card docks here, over the bottom of the wall.</p>
        </ClimbStage>
      </div>
    </main>
  );
}
