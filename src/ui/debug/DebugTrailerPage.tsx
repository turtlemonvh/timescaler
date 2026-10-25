import { Suspense, useEffect, useState } from 'react';
import { applyCorrect, applyMiss, createClimb, type ClimbState } from '../../engine/climb';
import { getPeak } from '../../engine/peaks';
import { generateQuestion, type Question } from '../../engine/questions';
import { mulberry32 } from '../../engine/rng';
import type { AnimalId } from '../../scene/animals/roster';
import ClimbScene, { type ClimbPhase } from '../../scene/climb/ClimbScene';
import { describeMove, type ClimbMove } from '../../scene/climb/motion';
import { preloadAnimal } from '../../scene/lazyPreload';
import { playCue } from '../../scene/audio/synth';
import MapScene from '../../scene/map/MapScene';
import CharacterPick from '../screens/CharacterPick';
import Climb from '../screens/Climb';
import Summit from '../screens/Summit';

/**
 * Dev-only film set for the trailer and the intro loop (#104). Each
 * `?shot=` is one take: the real screens and scenes, driven by a canned
 * script of timeouts, so the footage can only show what the game does.
 *
 * Opened in a browser it plays at real speed. Under `trailer/record.ts`,
 * which virtualises time, the page waits for `__trailer.start()` so the
 * recorder can finish loading models before the first frame counts.
 */

const noop = () => {};

/** The game shot's take: peak 10 mixes every question type, and seed 15
 * opens with six multiple-choice questions of five different kinds. */
const GAME = { peakId: 10, difficulty: 4, seed: 15, animal: 'fox' as AnimalId };
/** Per question: answer right, or pick a wrong option to show a slip. */
const GAME_ANSWERS = [true, true, true, true, false, true, true, true];
// The pause after the slip keeps the trailer's slip shot from ending on a hop.
const GAME_THINK_MS = [1500, 700, 700, 700, 900, 2600, 700, 700];

type Step = { at: number; run: () => void };

interface TrailerWindow {
  __trailer?: { ready: boolean; start: () => void };
  __vt?: unknown;
}

function schedule(steps: Step[]): () => void {
  const timers = steps.map((step) => setTimeout(step.run, step.at));
  return () => timers.forEach(clearTimeout);
}

/** Full-bleed climb scene with no HUD: the intro loop's shots. */
function SceneShot({
  animalId,
  peakId = 1,
  startPosition,
  script,
}: {
  animalId: AnimalId;
  peakId?: number;
  startPosition: (state: ClimbState) => number;
  script: ('correct' | 'fast' | 'miss')[];
}) {
  const [state, setState] = useState<ClimbState>(() => {
    const fresh = createClimb(getPeak(peakId), 4);
    return { ...fresh, position: startPosition(fresh) };
  });
  const [move, setMove] = useState<ClimbMove | null>(null);
  const [phase, setPhase] = useState<ClimbPhase>('climb');

  useEffect(() => {
    let current = state;
    let count = 0;
    const steps = script.map((action, i) => ({
      at: 500 + i * 1000,
      run: () => {
        const fast = action === 'fast';
        const next = action === 'miss' ? applyMiss(current) : applyCorrect(current, fast);
        const described = describeMove(current, next, fast, ++count);
        current = next;
        setState(next);
        setMove(described);
        if (described.kind === 'summit') {
          playCue('summit');
          setTimeout(() => setPhase('summit'), 900);
        } else if (described.kind === 'slip') playCue('slip');
        else playCue(fast ? 'hopFast' : 'hop', { semitones: i });
      },
    }));
    return schedule(steps);
    // Runs once per take; `state` is only the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ClimbScene
      peakId={peakId}
      animalId={animalId}
      position={state.position}
      height={state.height}
      move={move}
      phase={phase}
    />
  );
}

/** The overworld, gliding the climber from peak to peak. */
function MapSweepShot({ stops, everyMs }: { stops: number[]; everyMs: number }) {
  const [selected, setSelected] = useState(stops[0]);
  useEffect(
    () =>
      schedule(
        stops
          .slice(1)
          .map((peakId, i) => ({ at: 400 + i * everyMs, run: () => setSelected(peakId) })),
      ),
    // One take per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <MapScene
      selectedPeakId={selected}
      summitedPeakIds={[1, 2, 3, 4, 5]}
      animalId="alpaca"
      onSelectPeak={noop}
    />
  );
}

function gameQuestions(): Question[] {
  const rng = mulberry32(GAME.seed);
  const peak = getPeak(GAME.peakId);
  return GAME_ANSWERS.map(() => generateQuestion(rng, { difficulty: GAME.difficulty, peak }));
}

/** The real Climb screen, answered by a scripted player who knows the seed. */
function GameShot() {
  useEffect(() => {
    const questions = gameQuestions();
    let answered = 0;
    let waiting = false;
    let poll: ReturnType<typeof setTimeout>;
    const tick = () => {
      const screen = document.querySelector('.climb-screen');
      if (!waiting && screen?.getAttribute('data-revealing') === 'false') {
        const question = questions[answered];
        if (question?.answer.kind === 'choice') {
          waiting = true;
          const right = question.answer.correctIndex;
          const pick = GAME_ANSWERS[answered]
            ? right
            : (right + 1) % question.answer.options.length;
          setTimeout(() => {
            document
              .querySelector<HTMLButtonElement>(`[data-testid="choice-option-${pick}"]`)
              ?.click();
            answered += 1;
            waiting = false;
          }, GAME_THINK_MS[answered]);
        }
      }
      poll = setTimeout(tick, 50);
    };
    tick();
    return () => clearTimeout(poll);
  }, []);

  return (
    <Climb
      peak={getPeak(GAME.peakId)}
      difficulty={GAME.difficulty}
      animalId={GAME.animal}
      seed={GAME.seed}
      onSummit={noop}
      onFall={noop}
      onBail={noop}
    />
  );
}

/** Focus walks across the six cards, so each animal cheers in turn. */
function PickShot() {
  useEffect(
    () =>
      schedule(
        ['fox', 'deer', 'stag', 'wolf', 'alpaca', 'husky'].map((id, i) => ({
          at: 300 + i * 550,
          run: () =>
            document
              .querySelector<HTMLButtonElement>(`[data-testid="character-option-${id}"]`)
              ?.focus({ preventScroll: true }),
        })),
      ),
    [],
  );
  return <CharacterPick onPick={noop} />;
}

function SummitShot() {
  useEffect(() => playCue('summit'), []);
  return (
    <Summit
      peak={getPeak(GAME.peakId)}
      animalId="wolf"
      elapsedMs={154_000}
      tier="firstAtDifficulty"
      difficulty={GAME.difficulty}
      reward={{ coins: 5 * GAME.difficulty, trophy: true }}
      onContinue={noop}
    />
  );
}

const SHOTS = {
  'fox-climb': {
    animals: ['fox'],
    render: () => (
      <SceneShot animalId="fox" startPosition={() => 3} script={['correct', 'fast', 'correct']} />
    ),
  },
  'deer-slip': {
    animals: ['deer'],
    render: () => (
      <SceneShot animalId="deer" peakId={3} startPosition={() => 6} script={['miss', 'correct']} />
    ),
  },
  'wolf-summit': {
    animals: ['wolf'],
    render: () => (
      <SceneShot
        animalId="wolf"
        peakId={8}
        startPosition={(s) => s.height - 1}
        script={['correct']}
      />
    ),
  },
  'map-sweep': {
    animals: ['alpaca'],
    render: () => <MapSweepShot stops={[1, 3, 6, 10, 1]} everyMs={1100} />,
  },
  game: { animals: [GAME.animal], render: () => <GameShot /> },
  pick: { animals: ['fox', 'deer', 'stag', 'wolf', 'alpaca', 'husky'], render: () => <PickShot /> },
  'map-wide': {
    animals: ['alpaca'],
    render: () => <MapSweepShot stops={[1, 3, 5, 8, 10]} everyMs={1000} />,
  },
  summit: { animals: ['wolf'], render: () => <SummitShot /> },
} satisfies Record<string, { animals: AnimalId[]; render: () => React.ReactNode }>;

export type ShotId = keyof typeof SHOTS;

export default function DebugTrailerPage() {
  const shotId = new URLSearchParams(window.location.search).get('shot') as ShotId | null;
  const shot = shotId ? SHOTS[shotId] : undefined;
  // Opened by hand rather than by the recorder (no virtual clock): just play.
  const [started, setStarted] = useState(() => !(window as unknown as TrailerWindow).__vt);

  useEffect(() => {
    if (!shot) return;
    for (const animal of shot.animals) preloadAnimal(animal);
    (window as unknown as TrailerWindow).__trailer = {
      ready: true,
      start: () => setStarted(true),
    };
  }, [shot]);

  if (!shot) {
    return (
      <main className="page">
        <h1>Trailer shots</h1>
        <p>
          Each link plays one take at real speed. <code>pnpm trailer:render</code> films them.
        </p>
        <ul>
          {Object.keys(SHOTS).map((id) => (
            <li key={id}>
              <a href={`?shot=${id}`}>{id}</a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }} data-trailer-started={started}>
      <Suspense fallback={<span className="scene-loading">Loading…</span>}>
        {started && shot.render()}
      </Suspense>
    </div>
  );
}
