import { useState } from 'react';
import { PEAKS } from '../../engine/peaks';
import CharacterPick from '../screens/CharacterPick';
import Climb from '../screens/Climb';
import Fell from '../screens/Fell';
import Intro from '../screens/Intro';
import Map from '../screens/Map';
import ProfileSelect from '../screens/ProfileSelect';
import Review from '../screens/Review';
import Summit from '../screens/Summit';
import AnalogClock from '../widgets/AnalogClock';
import DatePicker from '../widgets/DatePicker';
import NumberEntry from '../widgets/NumberEntry';
import type { Profile } from '../../storage/types';
import type { TimeOfDay } from '../../engine/timeMath';

const SAMPLE_PROFILES: Profile[] = [
  {
    id: 'a',
    name: 'Riley',
    characterId: 'sunny',
    createdAt: Date.now(),
    progress: {
      1: {
        difficulty: 4,
        highestDifficultyCleared: 4,
        bestTimeMsByDifficulty: { 4: 92000 },
        attempts: 2,
        bails: 0,
      },
      2: {
        difficulty: 4,
        highestDifficultyCleared: null,
        bestTimeMsByDifficulty: {},
        attempts: 1,
        bails: 0,
      },
    },
    stats: {},
    goals: [],
    climbLog: [
      {
        id: 'log-1',
        peakId: 1,
        difficulty: 4,
        startedAt: Date.now() - 3 * 86400000,
        endedAt: Date.now() - 3 * 86400000 + 92000,
        result: 'summited',
      },
      {
        id: 'log-2',
        peakId: 2,
        difficulty: 4,
        startedAt: Date.now() - 86400000,
        endedAt: Date.now() - 86400000 + 45000,
        result: 'fell',
      },
      {
        id: 'log-3',
        peakId: 1,
        difficulty: 5,
        startedAt: Date.now(),
        endedAt: Date.now() + 15000,
        result: 'bailed',
      },
    ],
  },
  {
    id: 'b',
    name: 'Sam',
    characterId: 'boulder',
    createdAt: Date.now(),
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
  },
];

/**
 * Dev-only gallery for the game screens, rendered standalone (not wired into
 * the real app-state navigation `App.tsx` drives) — the point is visual QA
 * of each screen in isolation, one section per screen. The real end-to-end
 * flow is verified separately by playing the actual game.
 */
export default function DebugScreensPage() {
  const [introContinued, setIntroContinued] = useState(false);
  const [showEmptyProfiles, setShowEmptyProfiles] = useState(false);
  const [profileAction, setProfileAction] = useState<string | null>(null);
  const [pickedCharacterId, setPickedCharacterId] = useState<string | null>(null);
  const mapProfile = SAMPLE_PROFILES[0];
  const [mapAction, setMapAction] = useState<string | null>(null);
  const [climbKey, setClimbKey] = useState(0);
  const [climbStatus, setClimbStatus] = useState<string | null>(null);
  const [galleryTime, setGalleryTime] = useState<TimeOfDay>({ hour: 12, minute: 0, second: 0 });
  const [galleryNumber, setGalleryNumber] = useState<number | ''>('');
  const [summitAction, setSummitAction] = useState<string | null>(null);
  const [fellAction, setFellAction] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<string | null>(null);

  return (
    <main>
      <h1>Debug: screens</h1>
      <p>Dev-only. Not shipped to production — see CONTRIBUTING for how to reach this page.</p>

      <h2>Intro</h2>
      <p data-testid="screens-intro-status">{introContinued ? 'Continued' : 'Not continued yet'}</p>
      <Intro onContinue={() => setIntroContinued(true)} />

      <h2>ProfileSelect</h2>
      <p>
        <label htmlFor="screens-empty-profiles">
          <input
            id="screens-empty-profiles"
            type="checkbox"
            checked={showEmptyProfiles}
            onChange={(event) => setShowEmptyProfiles(event.target.checked)}
          />{' '}
          No existing profiles
        </label>
      </p>
      <p data-testid="screens-profile-action">{profileAction ?? 'No action yet'}</p>
      <ProfileSelect
        profiles={showEmptyProfiles ? [] : SAMPLE_PROFILES}
        onSelectProfile={(id) => setProfileAction(`Selected: ${id}`)}
        onCreateProfile={(name) => setProfileAction(`Creating: ${name}`)}
      />

      <h2>CharacterPick</h2>
      <p data-testid="screens-picked-character">
        {pickedCharacterId ? `Picked: ${pickedCharacterId}` : 'Nothing picked yet'}
      </p>
      <CharacterPick onPick={setPickedCharacterId} />

      <h2>Map</h2>
      <p data-testid="screens-map-action">{mapAction ?? 'No action yet'}</p>
      <Map
        profile={mapProfile}
        onClimb={(peakId, difficulty) =>
          setMapAction(`Climb: peak ${peakId} at level ${difficulty}`)
        }
        onReview={() => setMapAction('Opened Review')}
        onViewFullHistory={(peakId, difficulty) =>
          setMapAction(`Viewed full history: peak ${peakId} level ${difficulty}`)
        }
        onOpenProfile={(section) => setMapAction(`Opened profile: ${section}`)}
      />

      <h2>Review</h2>
      <p data-testid="screens-review-status">{reviewAction ?? 'No action yet'}</p>
      <Review
        profile={mapProfile}
        onBack={() => setReviewAction('Returned to map')}
        onAddGoal={(peakId, difficulty, targetDate) =>
          setReviewAction(`Added goal: peak ${peakId} level ${difficulty} by ${targetDate}`)
        }
        onImportProfile={(imported) => setReviewAction(`Imported profile: ${imported.name}`)}
      />

      <h2>Climb</h2>
      <p data-testid="screens-climb-status">{climbStatus ?? 'In progress'}</p>
      <p>
        <button
          type="button"
          data-testid="screens-climb-restart"
          onClick={() => {
            setClimbKey((key) => key + 1);
            setClimbStatus(null);
          }}
        >
          Restart Climb
        </button>
      </p>
      <Climb
        key={climbKey}
        peak={PEAKS[0]}
        difficulty={5}
        animalId="fox"
        seed={climbKey}
        onSummit={(state, elapsedMs) =>
          setClimbStatus(`Summited at position ${state.position} in ${elapsedMs}ms`)
        }
        onFall={(state) => setClimbStatus(`Fell at position ${state.position}`)}
        onBail={(elapsedMs) => setClimbStatus(`Bailed after ${elapsedMs}ms`)}
      />

      <h2>Answer kinds</h2>
      <p>
        No registered generator produces <code>setHands</code>/<code>number</code>/
        <code>pickDate</code> questions yet (M5 is still building them out) — these are static
        fixtures showing how <code>Climb.tsx</code> renders and captures each answer kind, ahead of
        any real generator existing to drive it live.
      </p>
      <h3>setHands</h3>
      <div data-testid="gallery-set-hands">
        <AnalogClock time={galleryTime} precision="quarter" onHandChange={setGalleryTime} />
        <p>
          <button type="button">Submit</button>
        </p>
      </div>
      <h3>number</h3>
      <div data-testid="gallery-number">
        <NumberEntry value={galleryNumber} onChange={setGalleryNumber} unit="minutes" />
        <p>
          <button type="button" disabled={galleryNumber === ''}>
            Submit
          </button>
        </p>
      </div>
      <h3>pickDate</h3>
      <div data-testid="gallery-pick-date">
        <DatePicker initialYear={2026} initialMonthIndex={5} />
      </div>

      <h2>Summit</h2>
      <p data-testid="screens-summit-action">{summitAction ?? 'No action yet'}</p>
      <Summit
        peak={PEAKS[0]}
        animalId="fox"
        elapsedMs={92000}
        tier="firstAtDifficulty"
        difficulty={4}
        onContinue={() => setSummitAction('Continued to map')}
      />

      <h2>Fell</h2>
      <p data-testid="screens-fell-action">{fellAction ?? 'No action yet'}</p>
      <Fell
        peak={PEAKS[0]}
        animalId="fox"
        onRetry={() => setFellAction('Retry')}
        onReturnToMap={() => setFellAction('Returned to map')}
      />
    </main>
  );
}
