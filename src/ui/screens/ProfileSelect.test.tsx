import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileSelect from './ProfileSelect';
import type { Profile } from '../../storage/types';

function makeProfile(id: string, name: string): Profile {
  return {
    id,
    name,
    characterId: 'sunny',
    createdAt: 1700000000000,
    progress: {},
    stats: {},
    goals: [],
    climbLog: [],
  };
}

describe('ProfileSelect', () => {
  it('shows the creation form by default when there are no profiles', () => {
    render(<ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={vi.fn()} />);
    expect(screen.getByTestId('profile-create-form')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('profile-new')).not.toBeInTheDocument();
  });

  it('does not show a cancel button when there are no other profiles to fall back to', () => {
    render(<ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={vi.fn()} />);
    expect(screen.queryByTestId('profile-create-cancel')).not.toBeInTheDocument();
  });

  it('lists existing profiles and calls onSelectProfile when one is clicked', () => {
    const onSelectProfile = vi.fn();
    const profiles = [makeProfile('a', 'Riley'), makeProfile('b', 'Sam')];
    render(
      <ProfileSelect
        profiles={profiles}
        onSelectProfile={onSelectProfile}
        onCreateProfile={vi.fn()}
      />,
    );
    expect(screen.getByTestId('profile-option-a')).toHaveTextContent('Riley');
    expect(screen.getByTestId('profile-option-b')).toHaveTextContent('Sam');
    fireEvent.click(screen.getByTestId('profile-option-b'));
    expect(onSelectProfile).toHaveBeenCalledWith('b');
  });

  it('hides the creation form behind a "+ New Climber" button when profiles exist', () => {
    render(
      <ProfileSelect
        profiles={[makeProfile('a', 'Riley')]}
        onSelectProfile={vi.fn()}
        onCreateProfile={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('profile-create-form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('profile-new'));
    expect(screen.getByTestId('profile-create-form')).toBeInTheDocument();
  });

  it('cancel returns to the profile list without creating anything', () => {
    const onCreateProfile = vi.fn();
    render(
      <ProfileSelect
        profiles={[makeProfile('a', 'Riley')]}
        onSelectProfile={vi.fn()}
        onCreateProfile={onCreateProfile}
      />,
    );
    fireEvent.click(screen.getByTestId('profile-new'));
    fireEvent.click(screen.getByTestId('profile-create-cancel'));
    expect(screen.queryByTestId('profile-create-form')).not.toBeInTheDocument();
    expect(onCreateProfile).not.toHaveBeenCalled();
  });

  it('submits the trimmed name via onCreateProfile', () => {
    const onCreateProfile = vi.fn();
    render(
      <ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={onCreateProfile} />,
    );
    fireEvent.change(screen.getByTestId('profile-name-input'), { target: { value: '  Riley  ' } });
    fireEvent.click(screen.getByTestId('profile-create-submit'));
    expect(onCreateProfile).toHaveBeenCalledWith('Riley');
  });

  it('collapses doubled and non-breaking spaces between words', () => {
    const onCreateProfile = vi.fn();
    render(
      <ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={onCreateProfile} />,
    );
    fireEvent.change(screen.getByTestId('profile-name-input'), {
      target: { value: 'Mina van \u00a0heest ' },
    });
    fireEvent.click(screen.getByTestId('profile-create-submit'));
    expect(onCreateProfile).toHaveBeenCalledWith('Mina van heest');
  });

  it('disables submit when the name is empty or whitespace-only', () => {
    render(<ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={vi.fn()} />);
    expect(screen.getByTestId('profile-create-submit')).toBeDisabled();
    fireEvent.change(screen.getByTestId('profile-name-input'), { target: { value: '   ' } });
    expect(screen.getByTestId('profile-create-submit')).toBeDisabled();
  });

  it('does not call onCreateProfile when submitting an empty name', () => {
    const onCreateProfile = vi.fn();
    render(
      <ProfileSelect profiles={[]} onSelectProfile={vi.fn()} onCreateProfile={onCreateProfile} />,
    );
    fireEvent.submit(screen.getByTestId('profile-create-form'));
    expect(onCreateProfile).not.toHaveBeenCalled();
  });
});
