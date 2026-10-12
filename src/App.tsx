import { useEffect, useState } from 'react';
import { getPeak } from './engine/peaks';
import { rewardDelta } from './engine/rewards';
import { resolveAnimal } from './scene/animals/roster';
import CharacterPick from './ui/screens/CharacterPick';
import Climb from './ui/screens/Climb';
import Fell from './ui/screens/Fell';
import Intro from './ui/screens/Intro';
import Map from './ui/screens/Map';
import ProfileScreen, { type ProfileSection } from './ui/screens/ProfileScreen';
import ProfileSelect from './ui/screens/ProfileSelect';
import Review from './ui/screens/Review';
import Summit from './ui/screens/Summit';
import {
  addGoal,
  checkGoalsAchieved,
  createProfile,
  getProfile,
  importProfile,
  recordBail,
  recordFall,
  recordQuestionStat,
  recordSummit,
  setCharacter,
  setPeakDifficulty,
  summitTier,
  type SummitTier,
} from './storage/profile';
import { loadSave, saveSave } from './storage/save';
import type { Profile, SaveFile } from './storage/types';

type Screen =
  | { name: 'intro' }
  | { name: 'profileSelect' }
  | { name: 'characterPick'; pendingName: string }
  | { name: 'map' }
  | { name: 'profile'; section: ProfileSection }
  | { name: 'review'; logFilter?: { peakId: number; difficulty: number } }
  | { name: 'climb'; peakId: number; seed: number }
  | {
      name: 'summit';
      peakId: number;
      elapsedMs: number;
      tier: SummitTier;
      difficulty: number;
      reward: { coins: number; trophy: boolean };
    }
  | { name: 'fell'; peakId: number };

function requireActiveProfile(save: SaveFile): Profile {
  const profile = save.activeProfileId ? getProfile(save, save.activeProfileId) : undefined;
  if (!profile) {
    throw new Error('requireActiveProfile: no active profile — unreachable from the screen flow');
  }
  return profile;
}

/**
 * The real game's screen-state machine, replacing the placeholder that
 * rendered `PreviewPlayer` directly. Navigation is plain app state, not a
 * router — same "screens are driven by app state" philosophy
 * `DebugRouter.tsx`'s doc comment already states for the dev-only pages.
 * `PreviewPlayer` moves to `/debug/preview`, its production job now
 * superseded by this real flow.
 */
export default function App() {
  const [save, setSave] = useState<SaveFile>(() => loadSave());
  const [screen, setScreen] = useState<Screen>({ name: 'intro' });

  useEffect(() => {
    saveSave(save);
  }, [save]);

  switch (screen.name) {
    case 'intro':
      return <Intro onContinue={() => setScreen({ name: 'profileSelect' })} />;

    case 'profileSelect':
      return (
        <ProfileSelect
          profiles={save.profiles}
          onSelectProfile={(profileId) => {
            setSave((current) => ({ ...current, activeProfileId: profileId }));
            setScreen({ name: 'map' });
          }}
          onCreateProfile={(name) => setScreen({ name: 'characterPick', pendingName: name })}
        />
      );

    case 'characterPick':
      return (
        <CharacterPick
          onPick={(characterId) => {
            setSave((current) => createProfile(current, screen.pendingName, characterId));
            setScreen({ name: 'map' });
          }}
        />
      );

    case 'map': {
      const profile = requireActiveProfile(save);
      return (
        <Map
          profile={profile}
          onClimb={(peakId, difficulty) => {
            setSave((current) => setPeakDifficulty(current, profile.id, peakId, difficulty));
            setScreen({ name: 'climb', peakId, seed: Date.now() });
          }}
          onReview={() => setScreen({ name: 'review' })}
          onViewFullHistory={(peakId, difficulty) =>
            setScreen({ name: 'review', logFilter: { peakId, difficulty } })
          }
          onOpenProfile={(section) => setScreen({ name: 'profile', section })}
        />
      );
    }

    case 'profile': {
      const profile = requireActiveProfile(save);
      return (
        <ProfileScreen
          profile={profile}
          initialSection={screen.section}
          onChangeAnimal={(animalId) =>
            setSave((current) => setCharacter(current, profile.id, animalId))
          }
          onBack={() => setScreen({ name: 'map' })}
        />
      );
    }

    case 'review': {
      const profile = requireActiveProfile(save);
      return (
        <Review
          profile={profile}
          onBack={() => setScreen({ name: 'map' })}
          onAddGoal={(peakId, difficulty, targetDate) =>
            setSave((current) => addGoal(current, profile.id, peakId, difficulty, targetDate))
          }
          onImportProfile={(imported) => {
            setSave((current) => {
              const collision = current.profiles.some((p) => p.id === imported.id);
              if (
                collision &&
                !window.confirm(`A profile named "${imported.name}" already exists. Overwrite it?`)
              ) {
                return current;
              }
              return importProfile(current, imported);
            });
          }}
          initialLogFilter={screen.logFilter}
        />
      );
    }

    case 'climb': {
      const profile = requireActiveProfile(save);
      const peakId = screen.peakId;
      const difficulty = profile.progress[peakId]?.difficulty ?? 1;
      return (
        <Climb
          peak={getPeak(peakId)}
          difficulty={difficulty}
          animalId={resolveAnimal(profile.characterId).id}
          seed={screen.seed}
          onQuestionAnswered={(typeId, correct, elapsedMs) =>
            setSave((current) =>
              recordQuestionStat(current, profile.id, typeId, correct, elapsedMs),
            )
          }
          onSummit={(_finalState, elapsedMs) => {
            // Computed from `profile` — the pre-summit state still held in
            // this render's closure — before recordSummit below updates it,
            // per summitTier's own doc comment on why ordering matters here.
            const tier = summitTier(profile.progress[peakId], difficulty, elapsedMs);
            // Same ordering rule for the coins/trophy line: replay the log
            // before and after this summit (rewardDelta applies the coin cap
            // and the first-new-best-only rule exactly as the Map's totals do).
            const after = getProfile(
              recordSummit(save, profile.id, peakId, difficulty, elapsedMs),
              profile.id,
            );
            const reward = after ? rewardDelta(profile, after) : { coins: 0, trophy: false };
            setSave((current) => {
              const summited = recordSummit(current, profile.id, peakId, difficulty, elapsedMs);
              return checkGoalsAchieved(summited, profile.id, peakId, difficulty);
            });
            setScreen({ name: 'summit', peakId, elapsedMs, tier, difficulty, reward });
          }}
          onBail={(elapsedMs) => {
            setSave((current) => recordBail(current, profile.id, peakId, difficulty, elapsedMs));
            setScreen({ name: 'map' });
          }}
          onFall={(_finalState, elapsedMs) => {
            setSave((current) => recordFall(current, profile.id, peakId, difficulty, elapsedMs));
            setScreen({ name: 'fell', peakId });
          }}
        />
      );
    }

    case 'summit': {
      const profile = requireActiveProfile(save);
      return (
        <Summit
          peak={getPeak(screen.peakId)}
          animalId={resolveAnimal(profile.characterId).id}
          elapsedMs={screen.elapsedMs}
          tier={screen.tier}
          difficulty={screen.difficulty}
          reward={screen.reward}
          onContinue={() => setScreen({ name: 'map' })}
        />
      );
    }

    case 'fell': {
      const profile = requireActiveProfile(save);
      const peakId = screen.peakId;
      return (
        <Fell
          peak={getPeak(peakId)}
          animalId={resolveAnimal(profile.characterId).id}
          onRetry={() => setScreen({ name: 'climb', peakId, seed: Date.now() })}
          onReturnToMap={() => setScreen({ name: 'map' })}
        />
      );
    }
  }
}
