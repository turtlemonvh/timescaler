import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChoiceGrid from './ChoiceGrid';

const OPTIONS = ['9:00 AM', '9:15 AM', '9:30 AM', '9:45 AM'];

describe('ChoiceGrid', () => {
  it('renders one option per entry', () => {
    render(<ChoiceGrid options={OPTIONS} />);
    OPTIONS.forEach((option, index) => {
      expect(screen.getByTestId(`choice-option-${index}`)).toHaveTextContent(option);
    });
  });

  it('reports the clicked index when onSelect is given', () => {
    const onSelect = vi.fn();
    render(<ChoiceGrid options={OPTIONS} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('choice-option-2'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('is not clickable when no onSelect is given', () => {
    render(<ChoiceGrid options={OPTIONS} />);
    expect(screen.getByTestId('choice-option-0')).toBeDisabled();
  });

  it('is not clickable when disabled is set, even with onSelect', () => {
    const onSelect = vi.fn();
    render(<ChoiceGrid options={OPTIONS} onSelect={onSelect} disabled />);
    expect(screen.getByTestId('choice-option-0')).toBeDisabled();
  });

  it('marks the selected option without revealing correctness', () => {
    render(<ChoiceGrid options={OPTIONS} selectedIndex={1} />);
    expect(screen.getByTestId('choice-option-1')).toHaveAttribute('data-state', 'selected');
    expect(screen.getByTestId('choice-option-0')).not.toHaveAttribute('data-state');
  });

  it('marks the correct option during reveal, whether or not it was selected', () => {
    render(<ChoiceGrid options={OPTIONS} correctIndex={2} />);
    expect(screen.getByTestId('choice-option-2')).toHaveAttribute('data-state', 'correct');
  });

  it('marks a wrong selection as incorrect, distinct from the correct option', () => {
    render(<ChoiceGrid options={OPTIONS} selectedIndex={0} correctIndex={2} />);
    expect(screen.getByTestId('choice-option-0')).toHaveAttribute('data-state', 'incorrect');
    expect(screen.getByTestId('choice-option-2')).toHaveAttribute('data-state', 'correct');
  });

  it('marks a correct selection as correct, not incorrect', () => {
    render(<ChoiceGrid options={OPTIONS} selectedIndex={2} correctIndex={2} />);
    expect(screen.getByTestId('choice-option-2')).toHaveAttribute('data-state', 'correct');
  });

  it('auto-fits columns by default and fills a fixed column count when `columns` is set', () => {
    const { unmount } = render(<ChoiceGrid options={OPTIONS} />);
    expect(screen.getByTestId('choice-grid').style.gridTemplateColumns).toContain('auto-fit');
    unmount();
    render(<ChoiceGrid options={OPTIONS} columns={2} />);
    const grid = screen.getByTestId('choice-grid');
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    expect(grid.style.width).toBe('100%');
  });
});
