import { Suspense, useEffect, useState } from 'react';
import { ANIMALS, type AnimalId } from '../../scene/animals/roster';
import { playCue } from '../../scene/audio/synth';
import { AnimalShowcase } from '../../scene/lazy';
import { preloadAnimal } from '../../scene/lazyPreload';
import { usePrefersReducedMotion } from '../usePrefersReducedMotion';

export interface CharacterPickProps {
  onPick: (characterId: string) => void;
}

/**
 * One-time-per-profile choice of animal, reached right after naming a new
 * profile. Six live turntables; hovering or focusing one makes it cheer.
 * Stored as `Profile.characterId`; changeable later on the profile screen.
 */
export default function CharacterPick({ onPick }: CharacterPickProps) {
  const [hovered, setHovered] = useState<AnimalId | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    for (const animal of ANIMALS) preloadAnimal(animal.id);
  }, []);

  return (
    <main className="page pick-screen">
      <h1>Pick your climber</h1>
      <p className="page__lead">
        Choose who climbs with you. You can switch later from your profile.
      </p>
      <div className="pick-grid" data-testid="character-grid">
        {ANIMALS.map((animal) => (
          <button
            key={animal.id}
            type="button"
            className="pick-card"
            style={{ '--accent-card': animal.accent } as React.CSSProperties}
            data-testid={`character-option-${animal.id}`}
            onMouseEnter={() => setHovered(animal.id)}
            onMouseLeave={() => setHovered((current) => (current === animal.id ? null : current))}
            onFocus={() => setHovered(animal.id)}
            onBlur={() => setHovered((current) => (current === animal.id ? null : current))}
            onClick={() => {
              playCue('select');
              onPick(animal.id);
            }}
          >
            <span className="pick-card__stage" aria-hidden="true">
              <Suspense fallback={<span className="scene-fallback" />}>
                <AnimalShowcase
                  animalId={animal.id}
                  accent={animal.accent}
                  pose={hovered === animal.id ? 'cheer' : 'idle'}
                  reducedMotion={reducedMotion}
                />
              </Suspense>
            </span>
            <span className="pick-card__name">{animal.name}</span>
            <span className="pick-card__tagline">{animal.tagline}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
