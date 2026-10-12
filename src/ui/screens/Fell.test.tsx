import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Fell from './Fell';
import type { Peak } from '../../engine/peaks';

const peak: Peak = { id: 1, name: 'Basecamp Bluff', emphasis: 'Reading analog clocks', height: 20 };

describe('Fell', () => {
  it('shows the peak name', () => {
    render(<Fell peak={peak} animalId="fox" onRetry={vi.fn()} onReturnToMap={vi.fn()} />);
    expect(screen.getByRole('main')).toHaveTextContent('Basecamp Bluff');
  });

  it('shows one of the known encouraging messages', () => {
    render(<Fell peak={peak} animalId="fox" onRetry={vi.fn()} onReturnToMap={vi.fn()} />);
    const shown = screen.getByTestId('fell-message').textContent;
    const knownMessages = [
      'Whoops! Even mountain goats trip sometimes.',
      'Gravity: 1, You: 0. Rematch?',
      'That slope was extra slippery today!',
      'Your paws needed a snack break. Try again!',
      'Ice happens. Climb on!',
    ];
    expect(knownMessages.some((m) => shown?.includes(m))).toBe(true);
  });

  it('keeps the same message across re-renders rather than re-rolling it', () => {
    const { rerender } = render(
      <Fell peak={peak} animalId="fox" onRetry={vi.fn()} onReturnToMap={vi.fn()} />,
    );
    const first = screen.getByTestId('fell-message').textContent;
    rerender(<Fell peak={peak} animalId="fox" onRetry={vi.fn()} onReturnToMap={vi.fn()} />);
    expect(screen.getByTestId('fell-message')).toHaveTextContent(first ?? '');
  });

  it('calls onRetry when "Try Again" is clicked', () => {
    const onRetry = vi.fn();
    render(<Fell peak={peak} animalId="fox" onRetry={onRetry} onReturnToMap={vi.fn()} />);
    fireEvent.click(screen.getByTestId('fell-retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls onReturnToMap when "Back to Map" is clicked', () => {
    const onReturnToMap = vi.fn();
    render(<Fell peak={peak} animalId="fox" onRetry={vi.fn()} onReturnToMap={onReturnToMap} />);
    fireEvent.click(screen.getByTestId('fell-map'));
    expect(onReturnToMap).toHaveBeenCalledOnce();
  });
});
