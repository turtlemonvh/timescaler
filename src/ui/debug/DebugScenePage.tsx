import { useState } from 'react';
import { applyCorrect, applyMiss, createClimb, type ClimbState } from '../../engine/climb';
import { PEAKS, getPeak } from '../../engine/peaks';
import { ANIMALS, type AnimalId } from '../../scene/animals/roster';
import ClimbScene, { type ClimbPhase } from '../../scene/climb/ClimbScene';
import { describeMove, type ClimbMove } from '../../scene/climb/motion';
import MapScene from '../../scene/map/MapScene';
import AnimalShowcase from '../../scene/pedestal/AnimalShowcase';
import { playCue } from '../../scene/audio/synth';

/**
 * Dev-only stage for the three.js scenes: drive the climb with real
 * `climb.ts` transitions (so the scene can only show what the rules allow),
 * flip between peaks and animals, and eyeball the overworld and turntables.
 */
export default function DebugScenePage() {
  const [view, setView] = useState<'climb' | 'map' | 'pick'>('climb');
  const [peakId, setPeakId] = useState(1);
  const [animalId, setAnimalId] = useState<AnimalId>('fox');
  const [difficulty, setDifficulty] = useState(5);
  const [state, setState] = useState<ClimbState>(() => createClimb(getPeak(1), 5));
  const [move, setMove] = useState<ClimbMove | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [phase, setPhase] = useState<ClimbPhase>('climb');
  const [selectedPeak, setSelectedPeak] = useState(1);

  function apply(next: ClimbState, fast: boolean) {
    const described = describeMove(state, next, fast, moveCount + 1);
    setMoveCount((n) => n + 1);
    setMove(described);
    setState(next);
    if (described.kind === 'fall') {
      playCue('fall');
      setTimeout(() => setPhase('fell'), 1500);
    } else if (described.kind === 'summit') {
      playCue('summit');
      setTimeout(() => setPhase('summit'), 900);
    } else if (described.kind === 'slip') playCue('slip');
    else playCue(described.fast ? 'hopFast' : 'hop');
  }

  function reset(nextPeakId = peakId, nextDifficulty = difficulty) {
    setState(createClimb(getPeak(nextPeakId), nextDifficulty));
    setMove(null);
    setPhase('climb');
  }

  function fillBoost() {
    let next = state;
    while (next.boost < next.boostCapacity) next = { ...next, boost: next.boost + 1 };
    setState(next);
  }

  function nearSummit() {
    setState({ ...state, position: state.height - 1 });
    setMove(null);
  }

  return (
    <div className="debug-scene">
      <div className="debug-scene__stage">
        {view === 'climb' && (
          <ClimbScene
            peakId={peakId}
            animalId={animalId}
            position={state.position}
            height={state.height}
            move={move}
            phase={phase}
          />
        )}
        {view === 'map' && (
          <MapScene
            selectedPeakId={selectedPeak}
            summitedPeakIds={[1, 2, 3]}
            animalId={animalId}
            onSelectPeak={setSelectedPeak}
          />
        )}
        {view === 'pick' && (
          <div className="debug-scene__pick">
            {ANIMALS.map((animal) => (
              <div key={animal.id} className="debug-scene__card">
                <AnimalShowcase animalId={animal.id} accent={animal.accent} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="debug-scene__controls" data-testid="debug-scene-controls">
        <strong>Debug: scene</strong>
        <label>
          View{' '}
          <select value={view} onChange={(e) => setView(e.target.value as typeof view)}>
            <option value="climb">climb</option>
            <option value="map">map</option>
            <option value="pick">pick</option>
          </select>
        </label>
        <label>
          Peak{' '}
          <select
            value={peakId}
            onChange={(e) => {
              const id = Number(e.target.value);
              setPeakId(id);
              setSelectedPeak(id);
              reset(id, difficulty);
            }}
          >
            {PEAKS.map((peak) => (
              <option key={peak.id} value={peak.id}>
                {peak.id}. {peak.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Animal{' '}
          <select value={animalId} onChange={(e) => setAnimalId(e.target.value as AnimalId)}>
            {ANIMALS.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Level{' '}
          <input
            type="number"
            min={1}
            max={10}
            value={difficulty}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDifficulty(d);
              reset(peakId, d);
            }}
            style={{ width: '3.5rem' }}
          />
        </label>
        <span data-testid="debug-scene-readout">
          {state.position} / {state.height} · boost {state.boost}/{state.boostCapacity} · risk{' '}
          {state.fallRisk}/{state.fallRiskCapacity} · {phase}
        </span>
        <button type="button" onClick={() => apply(applyCorrect(state, false), false)}>
          Correct
        </button>
        <button type="button" onClick={() => apply(applyCorrect(state, true), true)}>
          Fast correct
        </button>
        <button type="button" onClick={() => apply(applyMiss(state), false)}>
          Miss
        </button>
        <button type="button" data-variant="secondary" onClick={fillBoost}>
          Fill boost
        </button>
        <button type="button" data-variant="secondary" onClick={nearSummit}>
          Near summit
        </button>
        <button type="button" data-variant="secondary" onClick={() => reset()}>
          Reset
        </button>
      </div>
    </div>
  );
}
