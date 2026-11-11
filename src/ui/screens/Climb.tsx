import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { ClimbState } from '../../engine/climb';
import type { Peak } from '../../engine/peaks';
import type { DisplaySpec } from '../../engine/questions';
import type { AnimalId } from '../../scene/animals/roster';
import { playCue } from '../../scene/audio/synth';
import { ClimbScene } from '../../scene/lazy';
import type { ClimbMove } from '../../scene/climb/motion';
import BoostMeter from '../hud/BoostMeter';
import FallRiskMeter from '../hud/FallRiskMeter';
import MuteButton from '../hud/MuteButton';
import TimerBar from '../hud/TimerBar';
import { useClimbRun } from '../useClimbRun';
import { useMediaQuery } from '../useMediaQuery';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';
import { useVisualViewport } from '../useVisualViewport';
import AnalogClock from '../widgets/AnalogClock';
import CalendarMonth from '../widgets/CalendarMonth';
import ChoiceGrid from '../widgets/ChoiceGrid';
import DatePicker from '../widgets/DatePicker';
import NumberEntry from '../widgets/NumberEntry';

export { REVEAL_MS } from '../useClimbRun';

export interface ClimbProps {
  peak: Peak;
  difficulty: number;
  animalId: AnimalId;
  /** Caller-supplied so a retry after falling isn't byte-identical to the failed run. */
  seed: number;
  onSummit: (finalState: ClimbState, elapsedMs: number) => void;
  onFall: (finalState: ClimbState, elapsedMs: number) => void;
  /** Player-initiated exit, mid-climb — no summit/fall state change. */
  onBail: (elapsedMs: number) => void;
  /** Reported after every answer (timeouts count as incorrect), regardless of outcome. */
  onQuestionAnswered?: (typeId: string, correct: boolean, elapsedMs: number) => void;
}

const MOVE_LABEL: Record<ClimbMove['kind'], string> = {
  hop: 'Hop up!',
  slip: 'Slipped!',
  fall: 'Fell!',
  summit: 'Summit!',
  none: '',
};

/** Longest option label that still reads well in a half-width portrait button. */
const TWO_COLUMN_MAX_LABEL = 18;

function choiceColumns(options: string[], docked: boolean): number | undefined {
  if (!docked || options.length !== 4) return undefined;
  return options.every((option) => option.length <= TWO_COLUMN_MAX_LABEL) ? 2 : undefined;
}

function renderDisplay(display: DisplaySpec, clockSize: number, compact: boolean) {
  switch (display.kind) {
    case 'analogClock':
      return (
        <AnalogClock
          time={display.time}
          showSeconds={display.showSeconds}
          showNumerals={display.showNumerals}
          size={clockSize}
        />
      );
    case 'calendar':
      return (
        <CalendarMonth
          year={display.year}
          monthIndex={display.monthIndex}
          highlightDay={display.highlightDay}
          compact={compact}
        />
      );
    case 'none':
      return null;
  }
}

/**
 * The climb screen: the 3D cliff fills the viewport, the HUD floats at the
 * top, and the question card docks at the bottom (portrait) or the right
 * (landscape). All gameplay lives in `useClimbRun`; this component only
 * renders and plays sounds.
 */
export default function Climb({
  peak,
  difficulty,
  animalId,
  seed,
  onSummit,
  onFall,
  onBail,
  onQuestionAnswered,
}: ClimbProps) {
  const run = useClimbRun({ peak, difficulty, seed, onSummit, onFall, onQuestionAnswered });
  const reducedMotion = usePrefersReducedMotion();
  // Keeps the card above the on-screen keyboard on iOS (see index.css).
  const visualViewport = useVisualViewport();
  // Landscape phones leave little height beside the scene; a smaller clock keeps the answers in view.
  const shortScreen = useMediaQuery('(max-height: 520px)');
  // Matches the CSS breakpoint that moves the card to the right-hand side.
  // Otherwise it docks along the bottom (portrait), capped at 60svh so the
  // climber stays in view above it — the clock, choices and calendar all
  // tighten up there so the whole question fits without scrolling.
  const sideCard = useMediaQuery('(min-width: 720px) and (min-aspect-ratio: 1/1)');
  const docked = !sideCard;
  const clockSize = shortScreen ? 150 : docked ? 180 : 220;
  // The set-the-clock pad (up to two 52px rows) and its Submit button need
  // room too, so that clock only gets the full size when the card has the
  // height for it: the side card from 620px, the 60svh bottom card from
  // 760px. On a short landscape screen the pad sits beside the face instead
  // (see index.css), so the face itself is what has to stay small.
  const tallScreen = useMediaQuery('(min-height: 620px)');
  const tallerScreen = useMediaQuery('(min-height: 760px)');
  const roomForPad = docked ? tallerScreen : tallScreen;
  const handsClockSize = shortScreen ? 120 : roomForPad ? clockSize : docked ? 130 : 150;
  const { climbState, question, revealing, move } = run;
  const answer = question.answer;
  const [showTitle, setShowTitle] = useState(true);
  useEffect(() => {
    // Start the clock after the scene's first frame has painted: the first
    // climb pays for shader compilation and geometry on the main thread, and
    // the title should still be readable once the picture appears.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timeout = setTimeout(() => setShowTitle(false), 2600);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const streak = run.streak;
  useEffect(() => {
    if (!move) return;
    switch (move.kind) {
      case 'hop':
        // Each hop in a row climbs a semitone, so a run of right answers is audible.
        playCue(move.fast ? 'hopFast' : 'hop', { semitones: Math.min(streak - 1, 11) });
        break;
      case 'slip':
        playCue('slip');
        break;
      case 'fall':
        playCue('fall');
        break;
      case 'summit':
        playCue('summit');
        break;
      case 'none':
        break;
    }
    // `streak` changes in the same render as `move`, so this still runs once per answer.
  }, [move, streak]);

  function handleBail() {
    if (revealing) return;
    onBail(run.elapsedMs());
  }

  function renderAnswerSection() {
    switch (answer.kind) {
      case 'choice':
        return (
          <ChoiceGrid
            options={answer.options}
            columns={choiceColumns(answer.options, docked)}
            selectedIndex={run.selectedIndex}
            correctIndex={revealing ? answer.correctIndex : undefined}
            disabled={revealing}
            onSelect={run.answerChoice}
          />
        );
      case 'setHands':
        return (
          <div data-testid="climb-set-hands" className="climb-card__stack">
            <AnalogClock
              time={run.draftTime}
              precision={answer.precision}
              onHandChange={run.setDraftTime}
              disabled={revealing}
              size={handsClockSize}
            />
            <button
              type="button"
              data-testid="climb-submit"
              onClick={run.submitSetHands}
              disabled={revealing}
            >
              Submit
            </button>
          </div>
        );
      case 'number':
        return (
          // A form so Enter / the keyboard's "Go" key submits like the button
          // does. An empty field disables the button, which also blocks the
          // implicit submit, and `submitNumber` ignores it regardless.
          <form
            data-testid="climb-number"
            className="climb-card__stack climb-card__stack--number"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              run.submitNumber();
            }}
          >
            <NumberEntry value={run.draftNumber} onChange={run.setDraftNumber} unit={answer.unit} />
            <button
              type="submit"
              data-testid="climb-submit"
              disabled={revealing || run.draftNumber === ''}
            >
              Submit
            </button>
          </form>
        );
      case 'pickDate':
        return (
          <DatePicker
            initialYear={answer.year}
            initialMonthIndex={answer.monthIndex}
            onChange={revealing ? undefined : run.pickDate}
            compact={docked}
          />
        );
    }
  }

  const moveLabel = move && move.kind !== 'none' && revealing ? MOVE_LABEL[move.kind] : '';

  return (
    <main
      className="climb-screen"
      data-move={move?.kind ?? 'none'}
      data-revealing={revealing ? 'true' : 'false'}
      style={
        visualViewport
          ? ({
              '--visual-height': `${visualViewport.height}px`,
              '--keyboard-inset': `${visualViewport.bottomInset}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="climb-screen__scene" aria-hidden="true">
        <Suspense
          fallback={
            <div className="scene-fallback scene-fallback--sky">
              <span className="scene-loading">Loading the mountain…</span>
            </div>
          }
        >
          <ClimbScene
            peakId={peak.id}
            animalId={animalId}
            position={climbState.position}
            height={climbState.height}
            move={move}
            phase="climb"
            boosted={climbState.boost >= climbState.boostCapacity}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </div>

      {showTitle && (
        <div className="climb-title" data-testid="climb-title" aria-hidden="true">
          <span className="climb-title__peak">{peak.name}</span>
          <span className="climb-title__level">Level {difficulty}</span>
        </div>
      )}

      <header className="climb-hud" data-testid="climb-hud">
        <div className="climb-hud__group">
          <h1 className="climb-hud__peak">{peak.name}</h1>
          <span className="climb-hud__readout" data-testid="climb-readout">
            <strong>{climbState.position}</strong> / {climbState.height}
          </span>
          {moveLabel && (
            <span className="climb-hud__move" data-testid="climb-move-label">
              {moveLabel}
            </span>
          )}
          {streak >= 3 && (
            <span className="climb-hud__streak" data-testid="climb-streak">
              {streak} in a row!
            </span>
          )}
        </div>
        <div className="climb-hud__group">
          <div className="climb-hud__meter" title="Boost">
            <span className="climb-hud__label">Boost</span>
            <BoostMeter boost={climbState.boost} boostCapacity={climbState.boostCapacity} />
          </div>
          <div className="climb-hud__meter" title="Grip">
            <span className="climb-hud__label">Grip</span>
            <FallRiskMeter
              fallRisk={climbState.fallRisk}
              fallRiskCapacity={climbState.fallRiskCapacity}
            />
          </div>
          <MuteButton />
          <button
            type="button"
            data-variant="secondary"
            data-testid="climb-bail"
            onClick={handleBail}
            disabled={revealing}
          >
            Bail
          </button>
        </div>
      </header>

      <section className="climb-card" aria-live="polite">
        <TimerBar fraction={run.timeLeftMs / question.timeLimitMs} />
        <p className="climb-card__prompt" data-testid="climb-prompt">
          {question.prompt}
        </p>
        <div className="climb-card__display" data-testid="climb-display">
          {renderDisplay(question.display, clockSize, docked)}
        </div>
        <div className="climb-card__answer" data-testid="climb-answer">
          {renderAnswerSection()}
        </div>
        {revealing && (
          <p className="climb-card__explain" data-testid="climb-explain">
            {question.explainCorrect}
          </p>
        )}
      </section>
    </main>
  );
}
