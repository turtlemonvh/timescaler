import { Suspense, useState } from 'react';
import type { Peak } from '../../engine/peaks';
import type { AnimalId } from '../../scene/animals/roster';
import { ClimbScene } from '../../scene/lazy';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

/** Playful, low-stakes tone — a fall is part of the game, not a failure to be coached through. */
const ENCOURAGING_MESSAGES: readonly string[] = [
  'Whoops! Even mountain goats trip sometimes.',
  'Gravity: 1, You: 0. Rematch?',
  'That slope was extra slippery today!',
  'Your paws needed a snack break. Try again!',
  'Ice happens. Climb on!',
];

function randomMessage(): string {
  return ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
}

export interface FellProps {
  peak: Peak;
  animalId: AnimalId;
  onRetry: () => void;
  onReturnToMap: () => void;
}

/**
 * Shown when `Climb`'s `onFall` fires: the cliff scene in its fallen phase
 * (the animal is down at the foot of the wall) with two exits — retrying in
 * place is the whole point of falling rather than summiting.
 */
export default function Fell({ peak, animalId, onRetry, onReturnToMap }: FellProps) {
  const [message] = useState(randomMessage);
  const reducedMotion = usePrefersReducedMotion();
  return (
    <main className="result-screen result-screen--fell">
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
            position={0}
            height={peak.height}
            move={null}
            phase="fell"
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </div>
      <section className="result-card">
        <h1>You slipped!</h1>
        <p>
          Too many misses on <strong>{peak.name}</strong> sent you back down. Progress on other
          peaks is safe — try again whenever you&apos;re ready.
        </p>
        <p data-testid="fell-message" className="fell-message">
          &ldquo;{message}&rdquo;
        </p>
        <div className="result-card__actions">
          <button type="button" data-testid="fell-retry" onClick={onRetry}>
            Try Again
          </button>
          <button
            type="button"
            data-variant="secondary"
            data-testid="fell-map"
            onClick={onReturnToMap}
          >
            Back to Map
          </button>
        </div>
      </section>
    </main>
  );
}
