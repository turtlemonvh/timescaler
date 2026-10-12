import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CharacterPick from './CharacterPick';
import { ANIMALS } from '../../scene/animals/roster';

describe('CharacterPick', () => {
  it('renders one option per animal, each with a live turntable', () => {
    render(<CharacterPick onPick={vi.fn()} />);
    for (const animal of ANIMALS) {
      const option = screen.getByTestId(`character-option-${animal.id}`);
      expect(option).toHaveTextContent(animal.name);
      expect(option.querySelector('[data-testid="animal-showcase"]')).toHaveAttribute(
        'data-animal',
        animal.id,
      );
    }
  });

  it("calls onPick with the clicked animal's id", () => {
    const onPick = vi.fn();
    render(<CharacterPick onPick={onPick} />);
    const target = ANIMALS[2];
    fireEvent.click(screen.getByTestId(`character-option-${target.id}`));
    expect(onPick).toHaveBeenCalledWith(target.id);
  });

  it('calls onPick exactly once per click, with the right id each time', () => {
    const onPick = vi.fn();
    render(<CharacterPick onPick={onPick} />);
    fireEvent.click(screen.getByTestId(`character-option-${ANIMALS[0].id}`));
    fireEvent.click(screen.getByTestId(`character-option-${ANIMALS[1].id}`));
    expect(onPick).toHaveBeenNthCalledWith(1, ANIMALS[0].id);
    expect(onPick).toHaveBeenNthCalledWith(2, ANIMALS[1].id);
  });

  it('makes the hovered animal cheer', () => {
    render(<CharacterPick onPick={vi.fn()} />);
    const option = screen.getByTestId(`character-option-${ANIMALS[0].id}`);
    fireEvent.mouseEnter(option);
    expect(option.querySelector('[data-testid="animal-showcase"]')).toHaveAttribute(
      'data-pose',
      'cheer',
    );
    fireEvent.mouseLeave(option);
    expect(option.querySelector('[data-testid="animal-showcase"]')).toHaveAttribute(
      'data-pose',
      'idle',
    );
  });
});
