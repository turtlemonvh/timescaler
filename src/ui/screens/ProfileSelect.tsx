import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Profile } from '../../storage/types';

export interface ProfileSelectProps {
  profiles: Profile[];
  onSelectProfile: (profileId: string) => void;
  /**
   * Reports only the chosen name — creation isn't finished here.
   * `App.tsx` holds the pending name and completes profile creation once
   * `CharacterPick` (a separate screen) reports a `characterId`, since a
   * profile needs both.
   */
  onCreateProfile: (name: string) => void;
  /** Opens with the "new climber" form showing even when profiles exist — the Map's switcher
   * menu uses this for its "+ New climber" item. */
  startCreating?: boolean;
}

/**
 * Lists existing profiles to continue with, plus an inline "new climber"
 * form — one screen with two states rather than two separate nav states,
 * since there's nothing else on the "create" state that needs its own
 * screen. Shows the creation form by default when there are no profiles
 * yet, since there's nothing else useful to show.
 */
export default function ProfileSelect({
  profiles,
  onSelectProfile,
  onCreateProfile,
  startCreating = false,
}: ProfileSelectProps) {
  const [creating, setCreating] = useState(startCreating || profiles.length === 0);
  const [name, setName] = useState('');

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreateProfile(trimmed);
  }

  return (
    <main className="page profile-select">
      <div className="profile-select__card">
        <h1>Who&apos;s climbing?</h1>

        {profiles.length > 0 && (
          <div data-testid="profile-list" className="profile-select__list">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                data-testid={`profile-option-${profile.id}`}
                onClick={() => onSelectProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>
        )}

        {!creating && (
          <button
            type="button"
            data-variant="ghost"
            data-testid="profile-new"
            className="profile-select__new"
            onClick={() => setCreating(true)}
          >
            + New Climber
          </button>
        )}

        {creating && (
          <form
            onSubmit={handleCreate}
            data-testid="profile-create-form"
            className="profile-select__form"
          >
            <label htmlFor="profile-name-input">
              {profiles.length > 0 ? "New climber's name" : 'Your name'}
            </label>
            <input
              id="profile-name-input"
              data-testid="profile-name-input"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <div className="profile-select__actions">
              {profiles.length > 0 && (
                <button
                  type="button"
                  data-variant="secondary"
                  data-testid="profile-create-cancel"
                  onClick={() => {
                    setCreating(false);
                    setName('');
                  }}
                >
                  Cancel
                </button>
              )}
              <button type="submit" data-testid="profile-create-submit" disabled={!name.trim()}>
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
