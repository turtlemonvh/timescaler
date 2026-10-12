import { useState, type CSSProperties } from 'react';
import type { Peak } from '../../engine/peaks';
import type { AnimalId } from '../../scene/animals/roster';
import ClimbScene from '../../scene/climb/ClimbScene';
import type { SummitTier } from '../../storage/profile';
import { formatDuration } from '../formatDuration';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

export interface SummitProps {
  peak: Peak;
  animalId: AnimalId;
  elapsedMs: number;
  /** How enthusiastic the celebration should be — see `summitTier` in `storage/profile.ts`. */
  tier: SummitTier;
  /** Scales the confetti — a harder level earns a bigger celebration. */
  difficulty: number;
  onContinue: () => void;
}

const TIER_MESSAGE: Readonly<Record<SummitTier, string | null>> = {
  success: null,
  newBest: 'New personal best!',
  firstAtDifficulty: 'First time clearing this level!',
};

const TIER_BASE_CONFETTI: Readonly<Record<SummitTier, number>> = {
  success: 4,
  newBest: 7,
  firstAtDifficulty: 10,
};

const CONFETTI_COLORS = ['var(--accent)', 'var(--pine)', 'var(--gold)', 'var(--danger)', '#4cc9f0'];

interface ConfettiPiece {
  dx: number;
  dy: number;
  rot: number;
  color: string;
  delayMs: number;
}

type ConfettiStyle = CSSProperties & { '--dx': string; '--dy': string; '--rot': string };

function buildConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const distance = 60 + Math.random() * 60;
    return {
      dx: Math.cos(angle) * distance,
      dy: -Math.abs(Math.sin(angle) * distance) - 30,
      rot: Math.random() * 360 - 180,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delayMs: Math.random() * 300,
    };
  });
}

/**
 * Shown when `Climb`'s `onSummit` fires: the same cliff scene, now in its
 * summit phase (the animal dances on the flag plateau while the camera
 * swings round), with the result card over it. Persisting the summit is
 * `App.tsx`'s job.
 */
export default function Summit({
  peak,
  animalId,
  elapsedMs,
  tier,
  difficulty,
  onContinue,
}: SummitProps) {
  const [confetti] = useState(() =>
    buildConfetti(TIER_BASE_CONFETTI[tier] + Math.floor(difficulty / 2)),
  );
  const reducedMotion = usePrefersReducedMotion();
  const tierMessage = TIER_MESSAGE[tier];

  return (
    <main className="result-screen result-screen--summit">
      <div className="climb-screen__scene" aria-hidden="true">
        <ClimbScene
          peakId={peak.id}
          animalId={animalId}
          position={peak.height}
          height={peak.height}
          move={null}
          phase="summit"
          reducedMotion={reducedMotion}
        />
      </div>
      <section className="result-card" data-testid="summit-celebration">
        <div className="result-card__burst" aria-hidden="true">
          {confetti.map((piece, i) => (
            <span
              key={i}
              className="confetti-piece"
              data-testid="summit-confetti-piece"
              style={
                {
                  '--dx': `${piece.dx}px`,
                  '--dy': `${piece.dy}px`,
                  '--rot': `${piece.rot}deg`,
                  background: piece.color,
                  animationDelay: `${piece.delayMs}ms`,
                } as ConfettiStyle
              }
            />
          ))}
        </div>
        {tier !== 'success' && (
          <span className="summit-ribbon" data-testid="summit-ribbon">
            NEW BEST!
          </span>
        )}
        <h1>Summit reached!</h1>
        {tier === 'firstAtDifficulty' && (
          <span className="summit-badge" data-testid="summit-badge" aria-hidden="true">
            🏅
          </span>
        )}
        <p>
          You made it to the top of <strong>{peak.name}</strong> in{' '}
          <span data-testid="summit-time">{formatDuration(elapsedMs)}</span>!
        </p>
        {tierMessage && (
          <p data-testid="summit-tier-message" className="result-card__tier">
            {tierMessage}
          </p>
        )}
        <p className="result-card__note">
          {peak.name} is yours forever — already-summited peaks stay summited even if you fall on a
          later climb.
        </p>
        <button type="button" data-testid="summit-continue" onClick={onContinue}>
          Back to Map
        </button>
      </section>
    </main>
  );
}
