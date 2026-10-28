import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProfileSwitcher from './ProfileSwitcher';
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

const OTHERS = [makeProfile('b', 'Sam'), makeProfile('c', 'Jo')];

function renderSwitcher(overrides: Partial<Parameters<typeof ProfileSwitcher>[0]> = {}) {
  const props = {
    otherProfiles: OTHERS,
    onSwitchProfile: vi.fn(),
    onNewProfile: vi.fn(),
    ...overrides,
  };
  render(<ProfileSwitcher {...props} />);
  return props;
}

describe('ProfileSwitcher', () => {
  it('starts closed, with a labelled menu button', () => {
    renderSwitcher();
    const toggle = screen.getByRole('button', { name: 'Switch climber' });
    expect(toggle).toHaveAttribute('aria-haspopup', 'menu');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens a menu of the other climbers plus "+ New climber", focusing the first item', () => {
    renderSwitcher();
    const toggle = screen.getByTestId('profile-switch-toggle');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Switch climber' });
    expect(toggle).toHaveAttribute('aria-controls', menu.id);
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAccessibleName('Sam');
    expect(items[1]).toHaveAccessibleName('Jo');
    expect(items[2]).toHaveAccessibleName('+ New climber');
    expect(items[0]).toHaveFocus();
  });

  it('reports the picked climber and closes', () => {
    const { onSwitchProfile } = renderSwitcher();
    fireEvent.click(screen.getByTestId('profile-switch-toggle'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Jo' }));
    expect(onSwitchProfile).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('offers "+ New climber" even when there is nobody else to switch to', () => {
    const { onNewProfile } = renderSwitcher({ otherProfiles: [] });
    fireEvent.click(screen.getByTestId('profile-switch-toggle'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('profile-switch-new'));
    expect(onNewProfile).toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the toggle', () => {
    const { onSwitchProfile } = renderSwitcher();
    const toggle = screen.getByTestId('profile-switch-toggle');
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(onSwitchProfile).not.toHaveBeenCalled();
  });

  it('moves focus with the arrow keys, wrapping at the ends', () => {
    renderSwitcher();
    fireEvent.click(screen.getByTestId('profile-switch-toggle'));
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(items[2]).toHaveFocus();
  });

  it('opens from the keyboard with ArrowDown on the toggle', () => {
    renderSwitcher();
    fireEvent.keyDown(screen.getByTestId('profile-switch-toggle'), { key: 'ArrowDown' });
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
  });

  it('closes on a press outside the menu', () => {
    renderSwitcher();
    fireEvent.click(screen.getByTestId('profile-switch-toggle'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
