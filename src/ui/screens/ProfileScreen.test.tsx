import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileScreen from './ProfileScreen';
import { ANIMALS } from '../../scene/animals/roster';
import type { ClimbLogEntry, Profile } from '../../storage/types';

function entry(
  id: string,
  peakId: number,
  difficulty: number,
  result: ClimbLogEntry['result'],
  startedAt: number,
  elapsedMs = 60_000,
): ClimbLogEntry {
  return { id, peakId, difficulty, result, startedAt, endedAt: startedAt + elapsedMs };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p',
    name: 'Riley',
    characterId: 'fox',
    createdAt: 0,
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
    ...overrides,
  };
}

describe('ProfileScreen', () => {
  it('shows the name, the current animal on a turntable, and zeroed stats for a new profile', () => {
    render(
      <ProfileScreen
        profile={makeProfile()}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={vi.fn()}
      />,
    );
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Riley');
    expect(screen.getByTestId('profile-animal-name')).toHaveTextContent('Fox');
    expect(screen.getByTestId('animal-showcase')).toHaveAttribute('data-animal', 'fox');
    expect(screen.getByTestId('profile-coins')).toHaveTextContent('0');
    expect(screen.getByTestId('profile-peaks')).toHaveTextContent('0 / 10');
    expect(screen.getByTestId('profile-animal-fox')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByTestId('profile-trophy')).toHaveLength(0);
  });

  it('offers every animal and reports a switch without re-reporting the current one', () => {
    const onChangeAnimal = vi.fn();
    render(
      <ProfileScreen
        profile={makeProfile()}
        onChangeAnimal={onChangeAnimal}
        onBack={vi.fn()}
        onDeleteProfile={vi.fn()}
      />,
    );
    for (const animal of ANIMALS) {
      expect(screen.getByTestId(`profile-animal-${animal.id}`)).toHaveTextContent(animal.name);
    }
    fireEvent.click(screen.getByTestId('profile-animal-fox'));
    expect(onChangeAnimal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('profile-animal-stag'));
    expect(onChangeAnimal).toHaveBeenCalledWith('stag');
  });

  it('reflects a changed animal from props and cheers on the turntable', () => {
    const { rerender } = render(
      <ProfileScreen
        profile={makeProfile()}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-animal-stag'));
    rerender(
      <ProfileScreen
        profile={makeProfile({ characterId: 'stag' })}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={vi.fn()}
      />,
    );
    expect(screen.getByTestId('animal-showcase')).toHaveAttribute('data-animal', 'stag');
    expect(screen.getByTestId('animal-showcase')).toHaveAttribute('data-pose', 'cheer');
    expect(screen.getByTestId('profile-animal-stag')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows trophies on their peak shelf, earned badges, coins and the numbers', () => {
    const profile = makeProfile({
      progress: {
        1: {
          difficulty: 2,
          highestDifficultyCleared: 2,
          bestTimeMsByDifficulty: { 2: 50_000 },
          attempts: 2,
          bails: 0,
        },
      },
      stats: { readAnalog: { asked: 8, correct: 6, totalMs: 0 } },
      climbLog: [
        entry('a', 1, 2, 'summited', 1_000, 70_000),
        entry('b', 1, 2, 'summited', 100_000, 50_000),
        entry('c', 3, 1, 'fell', 200_000),
      ],
    });
    render(
      <ProfileScreen
        profile={profile}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={vi.fn()}
      />,
    );
    // First clear (5 × 2) + new best (3 × 2) = 16 coins, two trophies.
    expect(screen.getByTestId('profile-coins')).toHaveTextContent('16');
    expect(screen.getByTestId('profile-trophies')).toHaveTextContent('2');
    const shelf = screen.getByTestId('trophy-shelf-1');
    expect(shelf).toHaveTextContent('Summited · Lv 2');
    expect(shelf).toHaveTextContent('50s');
    expect(shelf.querySelectorAll('[data-testid=profile-trophy]')).toHaveLength(2);
    expect(screen.getByTestId('trophy-shelf-3')).toHaveTextContent('Not climbed yet');
    expect(screen.getByTestId('badge-firstSummit')).toHaveAttribute('data-earned', 'true');
    expect(screen.getByTestId('badge-fivePeaks')).toHaveAttribute('data-earned', 'false');
    expect(screen.getByTestId('badge-fivePeaks')).toHaveTextContent('1 / 5');
    expect(screen.getByTestId('profile-numbers')).toHaveTextContent('75%');
  });

  it('calls onBack from the back button', () => {
    const onBack = vi.fn();
    render(
      <ProfileScreen
        profile={makeProfile()}
        onChangeAnimal={vi.fn()}
        onBack={onBack}
        onDeleteProfile={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('deletes only after the climber name is typed, and Cancel backs out', () => {
    const onDeleteProfile = vi.fn();
    render(
      <ProfileScreen
        profile={makeProfile()}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={onDeleteProfile}
      />,
    );
    expect(screen.queryByTestId('profile-delete-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('profile-delete-open'));
    const confirm = screen.getByTestId('profile-delete-confirm');
    expect(confirm).toHaveTextContent('Delete Riley');
    expect(confirm).toBeDisabled();

    const input = screen.getByLabelText('Type Riley to confirm');
    fireEvent.change(input, { target: { value: 'Rile' } });
    expect(confirm).toBeDisabled();
    fireEvent.submit(input);
    expect(onDeleteProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('profile-delete-cancel'));
    expect(screen.queryByTestId('profile-delete-panel')).not.toBeInTheDocument();
    expect(onDeleteProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('profile-delete-open'));
    expect(screen.getByTestId('profile-delete-input')).toHaveValue('');
    fireEvent.change(screen.getByTestId('profile-delete-input'), {
      target: { value: '  riley ' },
    });
    expect(screen.getByTestId('profile-delete-confirm')).toBeEnabled();
    fireEvent.click(screen.getByTestId('profile-delete-confirm'));
    expect(onDeleteProfile).toHaveBeenCalledTimes(1);
  });

  it('confirms a multi-word name regardless of doubled or non-breaking spaces', () => {
    const onDeleteProfile = vi.fn();
    render(
      <ProfileScreen
        profile={makeProfile({ name: 'Mina van  heest' })}
        onChangeAnimal={vi.fn()}
        onBack={vi.fn()}
        onDeleteProfile={onDeleteProfile}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-delete-open'));
    const input = screen.getByTestId('profile-delete-input');
    fireEvent.change(input, { target: { value: 'Mina van heest' } });
    expect(screen.getByTestId('profile-delete-confirm')).toBeEnabled();
    fireEvent.change(input, { target: { value: 'Mina\u00a0van heest' } });
    expect(screen.getByTestId('profile-delete-confirm')).toBeEnabled();
    fireEvent.change(input, { target: { value: 'Minavan heest' } });
    expect(screen.getByTestId('profile-delete-confirm')).toBeDisabled();
  });
});
